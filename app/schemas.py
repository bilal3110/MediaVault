from datetime import datetime
from fastapi_users import schemas
from pydantic import BaseModel
import uuid

class PostRead(BaseModel):
    """The post fields that may be returned to an authenticated client."""

    id: str
    user_id: str | None
    caption: str | None
    url: str
    file_type: str
    file_name: str | None
    created_at: str | None
    is_owner: bool
    email: str

class UserRead(schemas.BaseUser[uuid.UUID]):
    pass

class UserCreate(schemas.BaseUserCreate):
    pass

class UserUpdate(schemas.BaseUserUpdate):
    pass
