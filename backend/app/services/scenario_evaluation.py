"""
Scenario response evaluation — scores a candidate's written answer to their
generated scenario question.

Single-shot, unlike scenario_generation.py's generate->critique->revise loop:
grading doesn't benefit from the same self-correction pattern, and a second
pass here would just double the latency on the candidate's submit action for
little gain. Temperature is kept low for consistency across candidates
answering different (per-attempt) questions for the same job.
"""

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.logging import logger
from app.db.models.job import JobPosting
from app.schemas.scenario_evaluation import ScenarioEvaluation
from app.services.scenario_generation import build_job_context

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY.get_secret_value())
    return _client


EVALUATE_PROMPT = """\
You are grading a candidate's written answer to a scenario-based interview
question. Be fair but rigorous — this score directly affects their standing
in the hiring pipeline.

Role context:
---
{job_context}
---
Seniority level: {job_level}

Scenario question asked:
---
{question_text}
---

Candidate's response:
---
{response_text}
---

Grade the response on relevance to the scenario, practical/technical
soundness appropriate to the seniority level, and clarity of reasoning.
Do not reward length or confident tone alone — a response that avoids the
actual question or hand-waves past the hard part should score low.
"""


async def evaluate_scenario_response(
    job: JobPosting,
    question_text: str,
    response_text: str,
) -> ScenarioEvaluation | None:
    """
    Grades a candidate's scenario answer. Returns None on failure — callers
    should decide how to handle an ungraded submission (e.g. leave score
    null and let the employer see it was submitted but not yet scored).
    """
    if not response_text or not response_text.strip():
        logger.warning("Scenario evaluation called with empty response text")
        return None

    client = _get_client()
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_EXTRACTION_MODEL,
            contents=EVALUATE_PROMPT.format(
                job_context=build_job_context(job),
                job_level=job.job_level.value if job.job_level else "unspecified",
                question_text=question_text,
                response_text=response_text,
            ),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScenarioEvaluation,
                temperature=0.1,
            ),
        )
    except Exception as exc:
        logger.error(f"Scenario evaluation failed for job {job.id}: {exc}")
        return None

    if response.parsed is None:
        logger.error("Gemini scenario evaluation returned unparseable output")
        return None

    return response.parsed  # type: ignore[return-value]