# backend/app/services/resume_processing.py
from app.core.logging import logger
from app.db.models.resume_versions import ResumeVersion
from app.db.models.candidate_profiles import CandidateProfile
from app.storage import get_storage
from app.services.resume_parser import extract_text
from app.services.llm_extraction import extract_resume
from app.services.embeddings import embed_text, structured_extraction_to_embedding_text


async def process_resume_extraction(
    rv: ResumeVersion,
    profile: CandidateProfile | None = None,
) -> bool:
    """
    Runs text extraction + structured extraction + embedding for a resume
    version, mutating it in place. Keeps the candidate profile's cached
    embedding/categories in sync if this version is their current one.
    Returns True on success, False on failure (non-fatal to caller).
    """
    storage = get_storage()
    try:
        file_bytes, content_type = storage.read_file(rv.s3_key)
        raw_text = extract_text(file_bytes, content_type)
        if not raw_text.strip():
            logger.warning(f"Resume {rv.id}: extracted text is empty")
            return False

        extraction = await extract_resume(raw_text)
        embedding_text = structured_extraction_to_embedding_text(extraction.model_dump())
        embedding = await embed_text(embedding_text)

        rv.parsed_data = extraction.model_dump(mode="json")
        rv.categories = [c.value for c in extraction.categories]
        rv.embedding = embedding

        if profile is not None and profile.current_resume_version_id == rv.id:
            profile.resume_embedding = embedding
            profile.categories = rv.categories

        return True
    except Exception as exc:
        logger.error(f"Resume extraction/embedding failed for {rv.id}: {exc}")
        return False