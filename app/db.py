from collections.abc import AsyncGenerator
from datetime import datetime
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, inspect, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from fastapi_users.db import SQLAlchemyUserDatabase, SQLAlchemyBaseUserTableUUID
from fastapi import Depends

DATABASE_URL = "sqlite+aiosqlite:///./test.db"

class Base(DeclarativeBase):
    pass

class User(SQLAlchemyBaseUserTableUUID, Base):
    posts = relationship("Post", back_populates="user")


class Post(Base):
    __tablename__ = "posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)
    caption = Column(Text)
    url = Column(String(255), nullable=False)
    file_type = Column(String(255), nullable=False)
    file_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="posts")
    
engine = create_async_engine(DATABASE_URL)

async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

async def create_db_and_tables():
    async with engine.begin() as conn:
        def create_tables_and_migrate(sync_conn):
            Base.metadata.create_all(sync_conn)
            post_columns = {column["name"] for column in inspect(sync_conn).get_columns("posts")}
            if "user_id" not in post_columns:
                sync_conn.execute(
                    text("ALTER TABLE posts ADD COLUMN user_id UUID REFERENCES user (id)")
                )
            if "file_name" not in post_columns:
                sync_conn.execute(text("ALTER TABLE posts ADD COLUMN file_name VARCHAR(255)"))

        await conn.run_sync(create_tables_and_migrate)
        
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User)
