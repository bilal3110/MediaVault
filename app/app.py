from fastapi import Depends, FastAPI, HTTPException
from fastapi import Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import PostRead, UserRead, UserCreate, UserUpdate
from app.db import Post, User, get_async_session, create_db_and_tables
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
from sqlalchemy import select
from app.images import imagekit
import shutil
import os
import uuid
import tempfile
from app.users import auth_backend, current_active_user, fastapi_users


def serialize_post(post: Post, email: str | None, current_user_id: uuid.UUID) -> dict:
    """Return the API shape used by both post creation and listing."""
    return {
        "id": str(post.id),
        "user_id": str(post.user_id) if post.user_id else None,
        "caption": post.caption,
        "url": post.url,
        "file_type": post.file_type,
        "file_name": post.file_name,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "is_owner": post.user_id == current_user_id,
        "email": email or "Unknown",
    }

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield
app = FastAPI(lifespan=lifespan)

# The standalone frontend is served locally during development. Keep this list
# explicit rather than allowing every browser origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)

app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(current_active_user)],
    responses={404: {"model": UserRead}},
)

@app.post("/posts/", response_model=PostRead, status_code=201)
async def create_post(
    file: UploadFile = File(...),
    caption: str = Form(...),
    current_user: User = Depends(current_active_user),
    async_session: AsyncSession = Depends(get_async_session)
):
    temp_file_path = None
    
    try:
        with tempfile.NamedTemporaryFile(delete=False,suffix=os.path.splitext(file.filename)[1]) as temp_file:
            temp_file_path = temp_file.name
            shutil.copyfileobj(file.file, temp_file)
            
            with open(temp_file_path, "rb") as upload_file:
                upload_result = imagekit.files.upload(
                    file=upload_file,
                    file_name=file.filename,
                    use_unique_file_name=True,
                    tags=["backend", "fastapi"],
                )

            post = Post(
                user_id=current_user.id,
                caption=caption,
                url=upload_result.url,
                file_type=upload_result.file_type,
                file_name=file.filename,
            )
            async_session.add(post)
            await async_session.commit()
            await async_session.refresh(post)
            return serialize_post(post, current_user.email, current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        await file.close()

@app.get("/posts/", response_model=list[PostRead])
async def get_posts(
    current_user: User = Depends(current_active_user),
    async_session: AsyncSession = Depends(get_async_session)
):
    result = await async_session.execute(select(Post).order_by(Post.created_at.desc()))
    posts = result.scalars().all()

    users_result = await async_session.execute(select(User.id, User.email))
    user_dict = {user_id: email for user_id, email in users_result.all()}

    return [
        serialize_post(post, user_dict.get(post.user_id), current_user.id)
        for post in posts
    ]

@app.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    current_user: User = Depends(current_active_user),
    async_session: AsyncSession = Depends(get_async_session),
):
    try:
        post_uuid = uuid.UUID(post_id)
        result = await async_session.execute(select(Post).where(Post.id == post_uuid))
        post = result.scalar_one_or_none()
        
        if post is None:
            raise HTTPException(status_code=404, detail="Post not found")

        if post.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete this post",
            )
        
        await async_session.delete(post)
        await async_session.commit()
        return {"message": "Post deleted successfully"}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
