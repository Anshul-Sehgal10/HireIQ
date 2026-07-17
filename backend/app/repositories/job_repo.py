import uuid
from typing import Optional, List
from sqlalchemy import select, or_, and_, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.job import JobPosting, JobStatus
from app.core.pagination import decode_cursor


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
    cursor: Optional[str] = None,
    limit: int = 10,
    q: Optional[str] = None,
    location: Optional[str] = None,
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None,
) -> tuple[List[JobPosting], bool]:
    """
    Returns (jobs, has_more). Fetches limit+1 rows to cheaply detect a next
    page without a separate COUNT query.

    Filtering contract: every filter here is driven purely by what's passed
    in — there is no server-side fallback to a candidate's resume categories.
    The caller (the /jobs/feed route) decides what "no categories passed"
    means; this function just applies whatever it's given.
    """
    query = select(JobPosting).where(JobPosting.status == JobStatus.PUBLISHED)

    if categories:
        query = query.where(
            or_(
                JobPosting.categories.overlap(categories),
                JobPosting.categories.is_(None),
            )
        )

    if q:
        like = f"%{q.strip()}%"
        query = query.where(
            or_(JobPosting.title.ilike(like), JobPosting.description.ilike(like))
        )

    if location:
        query = query.where(JobPosting.location.ilike(f"%{location.strip()}%"))

    # Salary filters are inclusive-overlap, not strict bounds — a job with no
    # salary info at all is never hidden by a salary filter (missing data
    # shouldn't be penalized), and a job missing only one of min/max falls
    # back to whichever value it does have.
    if salary_min is not None:
        query = query.where(
            or_(
                and_(JobPosting.salary_min.is_(None), JobPosting.salary_max.is_(None)),
                func.coalesce(JobPosting.salary_max, JobPosting.salary_min) >= salary_min,
            )
        )
    if salary_max is not None:
        query = query.where(
            or_(
                and_(JobPosting.salary_min.is_(None), JobPosting.salary_max.is_(None)),
                func.coalesce(JobPosting.salary_min, JobPosting.salary_max) <= salary_max,
            )
        )

    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        query = query.where(
            or_(
                JobPosting.created_at < cursor_created_at,
                and_(
                    JobPosting.created_at == cursor_created_at,
                    JobPosting.id < cursor_id,
                ),
            )
        )

    query = query.order_by(
        JobPosting.created_at.desc(), JobPosting.id.desc()
    ).limit(limit + 1)

    result = await db.execute(query)
    jobs = list(result.scalars().all())
    has_more = len(jobs) > limit
    return jobs[:limit], has_more



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