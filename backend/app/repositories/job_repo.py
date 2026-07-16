import uuid
from typing import Optional, List
from sqlalchemy import select, or_
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.job import JobPosting, JobStatus
from app.db.models.organization import Organization

async def create_job(db: AsyncSession, org_id: uuid.UUID, created_by: uuid.UUID, data: dict) -> JobPosting:
    job = JobPosting(org_id=org_id, created_by=created_by, **data)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job

async def get_job(db: AsyncSession, job_id: uuid.UUID) -> Optional[JobPosting]:
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    return result.scalar_one_or_none()

async def list_jobs_by_org(db: AsyncSession, org_id: uuid.UUID) -> List[JobPosting]:
    result = await db.execute(
        select(JobPosting)
        .where(JobPosting.org_id == org_id)
        .order_by(JobPosting.created_at.desc())
    )
    return list(result.scalars().all())

async def list_published_jobs(
    db: AsyncSession,
    categories: Optional[List[str]] = None,
    search: Optional[str] = None,
    location: Optional[str] = None,
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None,
) -> List[JobPosting]:
    query = (
        select(JobPosting)
        .options(joinedload(JobPosting.organization))
        .where(JobPosting.status == JobStatus.PUBLISHED)
    )
    if categories:
        query = query.where(
            or_(
                JobPosting.categories.overlap(categories),
                JobPosting.categories.is_(None),
            )
        )
    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                JobPosting.title.ilike(like),
                JobPosting.organization.has(Organization.name.ilike(like)),
            )
        )
    if location:
        query = query.where(JobPosting.location.ilike(f"%{location}%"))
    if salary_min is not None:
        # A job matches if its range could plausibly satisfy the candidate's
        # floor — an unset salary_max is treated as "unspecified", not "$0".
        query = query.where(
            or_(JobPosting.salary_max.is_(None), JobPosting.salary_max >= salary_min)
        )
    if salary_max is not None:
        query = query.where(
            or_(JobPosting.salary_min.is_(None), JobPosting.salary_min <= salary_max)
        )
    query = query.order_by(JobPosting.created_at.desc())
    result = await db.execute(query)
    return list(result.unique().scalars().all())

async def update_job(db: AsyncSession, job: JobPosting, updates: dict) -> JobPosting:
    for key, value in updates.items():
        if value is not None:
            setattr(job, key, value)
    await db.commit()
    await db.refresh(job)
    return job

async def publish_job(db: AsyncSession, job: JobPosting) -> JobPosting:
    from datetime import datetime, timezone
    from app.services.job_processing import process_job_extraction

    await process_job_extraction(job)  # best-effort — publish proceeds either way

    job.status = JobStatus.PUBLISHED
    job.published_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(job)
    return job

async def reprocess_job(db: AsyncSession, job: JobPosting) -> tuple[JobPosting, bool]:
    from app.services.job_processing import process_job_extraction
    success = await process_job_extraction(job)
    if success:
        await db.commit()
        await db.refresh(job)
    return job, success


async def close_job(db: AsyncSession, job: JobPosting) -> JobPosting:
    job.status = JobStatus.CLOSED
    await db.commit()
    await db.refresh(job)
    return job


async def get_job_with_org(db: AsyncSession, job_id: uuid.UUID) -> Optional[JobPosting]:
    result = await db.execute(
        select(JobPosting)
        .options(joinedload(JobPosting.organization))
        .where(JobPosting.id == job_id)
    )
    return result.unique().scalar_one_or_none()