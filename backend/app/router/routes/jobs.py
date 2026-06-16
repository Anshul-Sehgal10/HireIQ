from typing import List
from uuid import UUID
from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import EmployerUser, CandidateUser, get_db
from app.repositories.job_repo import (
    create_job, get_job, list_jobs_by_org,
    list_published_jobs, update_job, publish_job, close_job
)
from app.repositories.org_repo import get_org_for_user
from app.schemas.job import JobCreate, JobUpdate, JobResponse
from typing import Annotated
from fastapi import Depends

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: JobCreate,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    org = await get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(400, "You must belong to an organisation before posting jobs")
    job = await create_job(db, org.id, user.id, body.model_dump())
    return job

@router.get("/mine", response_model=List[JobResponse])
async def list_mine(user: EmployerUser, db: Annotated[AsyncSession, Depends(get_db)]):
    org = await get_org_for_user(db, user.id)
    if not org:
        return []
    return await list_jobs_by_org(db, org.id)

@router.get("/feed", response_model=List[JobResponse])
async def feed(user: CandidateUser, db: Annotated[AsyncSession, Depends(get_db)]):
    # Plain list for now — cosine ranking comes in step ③
    return await list_published_jobs(db)

@router.get("/{job_id}", response_model=JobResponse)
async def get_one(job_id: UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job

@router.patch("/{job_id}", response_model=JobResponse)
async def update(
    job_id: UUID,
    body: JobUpdate,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")
    return await update_job(db, job, body.model_dump(exclude_none=True))

@router.post("/{job_id}/publish", response_model=JobResponse)
async def publish(job_id: UUID, user: EmployerUser, db: Annotated[AsyncSession, Depends(get_db)]):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")
    return await publish_job(db, job)

@router.post("/{job_id}/close", response_model=JobResponse)
async def close(job_id: UUID, user: EmployerUser, db: Annotated[AsyncSession, Depends(get_db)]):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")
    return await close_job(db, job)