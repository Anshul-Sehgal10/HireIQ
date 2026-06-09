import os
from dotenv import load_dotenv

load_dotenv()

class Settings():
    HOST: str = os.getenv("HOST", "localhost")
    PORT: int = int(os.getenv("PORT", 8000))
    DATABASE_URL: str | None = os.getenv("DATABASE_URL")

settings = Settings()