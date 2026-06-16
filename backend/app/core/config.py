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
    # e.g. AnyUrl("http://localhost:3000") stringifies to "http://localhost:3000/" which
    # breaks f-string URL construction (produces double slashes).
    OAUTH_REDIRECT_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

# Instantiate directly.
settings = Settings()