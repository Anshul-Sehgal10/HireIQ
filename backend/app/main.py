"""
HireIQ — FastAPI application entry point.

Responsibilities:
- Create the FastAPI app instance
- Register startup / shutdown lifecycle (DB connection pool)
- Add middleware (CORS, trusted hosts)
- Mount all routers
- Register global exception handlers
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError

from app.core.config import settings
from app.db.session import engine          # AsyncEngine, created in session.py
from app.router.router import router       # combined router from router.py


# ---------------------------------------------------------------------------
# Lifespan — runs once on startup and once on shutdown
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing to do — SQLAlchemy creates the pool lazily on first use.
    # Alembic handles migrations separately (run `alembic upgrade head` before starting).
    print("HireIQ API starting up")
    yield
    # Shutdown: dispose the connection pool cleanly
    await engine.dispose()
    print("HireIQ API shut down")


# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------


app = FastAPI(
    title="HireIQ API",
    version="0.1.0",
    description="AI-native hiring platform — backend API",
    lifespan=lifespan,
    # Disable the default /docs and /redoc in production later
    docs_url="/docs",
    redoc_url="/redoc",
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,        # e.g. http://localhost:3000      # type: ignore
        "http://localhost:3000",       # always allow local dev
    ],
    allow_credentials=True,           # needed for cookies / auth headers
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------


@app.exception_handler(JWTError)
async def jwt_error_handler(request: Request, exc: JWTError):
    """Catches any unhandled JWTError and returns a clean 401."""
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "Invalid or expired token"},
        headers={"WWW-Authenticate": "Bearer"},
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    """
    Safety net — never leak stack traces to clients in production.
    Remove or gate this behind a DEBUG flag once you add proper logging.
    """
    print(f"Unhandled error on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred"},
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


app.include_router(router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# Health check — useful for Railway / Render / Docker health probes
# ---------------------------------------------------------------------------


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "version": app.version}