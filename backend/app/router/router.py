from fastapi import APIRouter

from .routes.auth import router as auth_router
from .routes.oauth import router as oauth_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(oauth_router)