import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import joinedload
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

async def list_published_jobs(
    db: AsyncSession, categories: Optional[List[str]] = None
) -> List[JobPosting]:
    query = select(JobPosting).where(JobPosting.status == JobStatus.PUBLISHED)
    if categories:
        query = query.where(JobPosting.categories.overlap(categories))
    query = query.order_by(JobPosting.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())

async def update_job(db: AsyncSession, job: JobPosting, updates: dict) -> JobPosting:
    for key, value in updates.items():
        if value is not None:
            setattr(job, key, value)
    await db.commit()
    await db.refresh(job)
    return job

async def publish_job(db: AsyncSession, job: JobPosting) -> JobPosting:
    from datetime import datetime, timezone
    from app.services.llm_extraction import extract_jd
    from app.services.embeddings import embed_text, structured_extraction_to_embedding_text
    from app.core.logging import logger

    try:
        extraction = await extract_jd(job.description)
        embedding_text = structured_extraction_to_embedding_text(extraction.model_dump())
        embedding = await embed_text(embedding_text)

        job.parsed_data = extraction.model_dump(mode="json")
        job.categories = [c.value for c in extraction.categories]
        job.jd_embedding = embedding
    except Exception as exc:
        logger.error(f"JD extraction/embedding failed for job {job.id}: {exc}")
        # proceed with publish anyway — same reasoning as resumes

    job.status = JobStatus.PUBLISHED
    job.published_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(job)
    return job

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