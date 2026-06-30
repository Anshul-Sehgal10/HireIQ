from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Core Server Settings
    HOST: str = Field(default=...)
    PORT: int = Field(default=...)
    DEBUG: bool = Field(default=...)

    # Database
    DATABASE_URL: str = Field(default=...)

    # JWT
    JWT_SECRET_KEY: SecretStr = Field(default=...)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OAuth Secrets
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: SecretStr = SecretStr("")
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: SecretStr = SecretStr("")

    # URL config — use plain str to avoid Pydantic v2 AnyUrl trailing-slash serialization.
    OAUTH_REDIRECT_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    # File storage (S3-compatible — works for both AWS S3 and Cloudflare R2)
    # For Cloudflare R2:
    #   STORAGE_ENDPOINT_URL = https://<account_id>.r2.cloudflarestorage.com
    #   STORAGE_REGION       = auto
    # For AWS S3:
    #   STORAGE_ENDPOINT_URL = (leave empty)
    #   STORAGE_REGION       = us-east-1  (or your bucket's region)
    STORAGE_ACCESS_KEY_ID: str = ""
    STORAGE_SECRET_ACCESS_KEY: SecretStr = SecretStr("")
    STORAGE_REGION: str = "auto"
    STORAGE_BUCKET: str = ""
    STORAGE_ENDPOINT_URL: str = ""  # empty = use AWS S3 default endpoint

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

# Instantiate directly.
settings = Settings()