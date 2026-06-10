# app/db/dependencies.py

from app.db.session import AsyncSessionLocal


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session