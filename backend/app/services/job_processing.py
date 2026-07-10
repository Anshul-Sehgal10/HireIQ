from app.core.logging import logger
from app.db.models.job import JobPosting
from app.services.llm_extraction import extract_jd
from app.services.embeddings import embed_text, structured_extraction_to_embedding_text


async def process_job_extraction(job: JobPosting) -> bool:
    """Runs JD extraction + embedding for a job, mutating it in place."""
    try:
        extraction = await extract_jd(job.description)
        embedding_text = structured_extraction_to_embedding_text(extraction.model_dump())
        embedding = await embed_text(embedding_text)

        job.parsed_data = extraction.model_dump(mode="json")
        job.categories = [c.value for c in extraction.categories]
        job.jd_embedding = embedding
        return True
    except Exception as exc:
        logger.error(f"JD extraction/embedding failed for job {job.id}: {exc}")
        return False