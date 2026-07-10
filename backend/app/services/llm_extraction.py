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

Also assign job categories that best describe this candidate's domain(s) of
experience, chosen strictly from the allowed category list. Most candidates
span more than one domain — err toward capturing that breadth:
- Assign 2-3 categories whenever the resume reasonably supports it (e.g. a
  backend engineer who also writes deployment scripts and touches AWS should
  get both `backend` and `devops_cloud`; someone with real experience on
  both ends of the stack should get `frontend` and `backend`, reserving
  `fullstack` for when that's literally how their experience is framed).
- Only assign a single category when the resume is narrowly and
  unambiguously focused on one domain with no meaningful secondary skill set.
- Accuracy comes first — never invent a category the resume doesn't
  support just to hit a count — but don't default to the single most
  obvious category out of caution either.

Resume text:
---
{text}
---
"""

JD_EXTRACTION_PROMPT = """\
You are parsing a job description into a normalized structured format.
Extract responsibilities and required/preferred skills faithfully — do not
invent requirements that aren't stated or clearly implied.

Also assign job categories that best describe this role's domain(s), chosen
strictly from the allowed category list. Most roles touch more than one
domain — err toward capturing that breadth:
- Assign 2-3 categories whenever the description reasonably supports it
  (e.g. a backend role that also owns CI/CD and cloud infra should get both
  `backend` and `devops_cloud`).
- Only assign a single category when the role is narrowly and unambiguously
  focused on one domain.
- Accuracy comes first — never invent a category the description doesn't
  support just to hit a count — but don't default to the single most
  obvious category out of caution either.

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