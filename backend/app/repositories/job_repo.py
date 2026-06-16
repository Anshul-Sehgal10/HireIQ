import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.job import JobPosting, JobStatus

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

async def list_published_jobs(db: AsyncSession) -> List[JobPosting]:
    result = await db.execute(
        select(JobPosting)
        .where(JobPosting.status == JobStatus.PUBLISHED)
        .order_by(JobPosting.created_at.desc())
    )
    return list(result.scalars().all())

async def update_job(db: AsyncSession, job: JobPosting, updates: dict) -> JobPosting:
    for key, value in updates.items():
        if value is not None:
            setattr(job, key, value)
    await db.commit()
    await db.refresh(job)
    return job

async def publish_job(db: AsyncSession, job: JobPosting) -> JobPosting:
    from datetime import datetime, timezone, timedelta
    job.status = JobStatus.PUBLISHED
    # tz_india = timezone(timedelta(hours=5, minutes=30)) # IST timezone
    job.published_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(job)
    return job

async def close_job(db: AsyncSession, job: JobPosting) -> JobPosting:
    job.status = JobStatus.CLOSED
    await db.commit()
    await db.refresh(job)
    return job