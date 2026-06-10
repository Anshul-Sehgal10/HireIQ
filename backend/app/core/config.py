import os
from dotenv import load_dotenv

load_dotenv()

class Settings():
    HOST: str = os.getenv("HOST", "localhost")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    DATABASE_URL: str = os.getenv("DATABASE_URL")

settings = Settings()