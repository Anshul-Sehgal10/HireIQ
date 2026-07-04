"""
Structured extraction for resumes and job descriptions via Gemini.

One call per document: the model returns both the normalized structured
representation (used to build the embedding text) and the category labels
(used for feed filtering), in a single round trip.
"""

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.logging import logger
from app.schemas.resume_extraction import ResumeExtraction
from app.schemas.job_extraction import JDExtraction

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY.get_secret_value())
    return _client


RESUME_EXTRACTION_PROMPT = """\
You are parsing a candidate's resume into a normalized structured format.
Extract all available information faithfully — do not invent data that
isn't present; leave fields empty/null instead of guessing.

Also assign 1-3 job categories that best describe this candidate's primary
domain(s) of experience, chosen strictly from the allowed category list.

Resume text:
---
{text}
---
"""

JD_EXTRACTION_PROMPT = """\
You are parsing a job description into a normalized structured format.
Extract responsibilities and required/preferred skills faithfully — do not
invent requirements that aren't stated or clearly implied.

Also assign 1-3 job categories that best describe this role's primary
domain(s), chosen strictly from the allowed category list.

Job description text:
---
{text}
---
"""


async def extract_resume(text: str) -> ResumeExtraction:
    client = _get_client()
    response = await client.aio.models.generate_content(
        model=settings.GEMINI_EXTRACTION_MODEL,
        contents=RESUME_EXTRACTION_PROMPT.format(text=text),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ResumeExtraction,
            temperature=0.1,
        ),
    )
    if response.parsed is None:
        logger.error("Gemini resume extraction returned unparseable output")
        raise ValueError("Failed to parse resume — LLM output did not match schema")
    return response.parsed  # type: ignore[return-value]


async def extract_jd(text: str) -> JDExtraction:
    client = _get_client()
    response = await client.aio.models.generate_content(
        model=settings.GEMINI_EXTRACTION_MODEL,
        contents=JD_EXTRACTION_PROMPT.format(text=text),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=JDExtraction,
            temperature=0.1,
        ),
    )
    if response.parsed is None:
        logger.error("Gemini JD extraction returned unparseable output")
        raise ValueError("Failed to parse job description — LLM output did not match schema")
    return response.parsed  # type: ignore[return-value]