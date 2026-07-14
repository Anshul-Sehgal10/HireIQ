from fastapi import APIRouter
 
from .routes.auth import router as auth_router
from .routes.oauth import router as oauth_router
from .routes.jobs import router as jobs_router
from .routes.orgs import router as orgs_router
from .routes.applications import router as applications_router
from .routes.resumes import router as resumes_router
from .routes.storage import router as storage_router
from .routes.scenario import router as scenario_router
 
router = APIRouter()
 
router.include_router(auth_router)
router.include_router(oauth_router)
router.include_router(jobs_router)
router.include_router(orgs_router)
router.include_router(applications_router)
router.include_router(resumes_router)
router.include_router(storage_router)
router.include_router(scenario_router)