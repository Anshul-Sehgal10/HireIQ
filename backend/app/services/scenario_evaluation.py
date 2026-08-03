"""
Scenario response evaluation — scores a candidate's written answer to their
generated scenario question.

Uses a LangGraph evaluate -> validate -> (retry) -> finalize loop, mirroring
scenario_generation.py's generate->critique->revise pattern. Unlike a plain
single-shot call, this catches the common Gemini failure mode of a parseable
response with a low-effort/empty summary and retries before giving up.
Temperature stays low across attempts — evaluation should be consistent,
not creative.
"""

from typing import Optional, TypedDict

from langgraph.graph import StateGraph, END
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.logging import logger
from app.db.models.job import JobPosting
from app.schemas.scenario_evaluation import ScenarioEvaluation
from app.services.scenario_generation import build_job_context

MAX_EVAL_ATTEMPTS = 2  # initial attempt + up to 2 retries before failing open
MIN_SUMMARY_WORDS = 8  # below this, treat the summary as low-effort/invalid

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

Your summary must be a real, specific explanation (at least a few full
sentences) — never a single word, a placeholder, or empty text.
{revision_note}
"""


class ScenarioEvalState(TypedDict):
    job_context: str
    job_level: Optional[str]
    question_text: str
    response_text: str
    attempt: int
    revision_note: str
    evaluation: Optional[ScenarioEvaluation]
    valid: bool


def _is_valid(evaluation: Optional[ScenarioEvaluation]) -> bool:
    if evaluation is None or evaluation.score is None or evaluation.summary is None:
        return False
    summary = (evaluation.summary or "").strip()
    if len(summary.split()) < MIN_SUMMARY_WORDS:
        return False
    return True


async def _evaluate_node(state: ScenarioEvalState) -> ScenarioEvalState:
    client = _get_client()
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_EXTRACTION_MODEL,
            contents=EVALUATE_PROMPT.format(
                job_context=state["job_context"],
                job_level=state["job_level"] or "unspecified",
                question_text=state["question_text"],
                response_text=state["response_text"],
                revision_note=state["revision_note"],
            ),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScenarioEvaluation,
                temperature=0.1,
            ),
        )
        evaluation = response.parsed  # type: ignore[assignment]
    except Exception as exc:
        logger.warning(f"Scenario evaluation attempt failed: {exc}")
        evaluation = None

    return {
        **state,
        "evaluation": evaluation, # type: ignore[assignment]
        "attempt": state["attempt"] + 1,
    }


def _validate_node(state: ScenarioEvalState) -> ScenarioEvalState:
    return {**state, "valid": _is_valid(state["evaluation"])}


def _route_after_validate(state: ScenarioEvalState) -> str:
    if state["valid"]:
        return "finalize"
    if state["attempt"] >= MAX_EVAL_ATTEMPTS:
        logger.warning(
            "Scenario evaluation hit max attempts without a valid result — failing open"
        )
        return "finalize"
    return "evaluate"


def _prep_retry_node(state: ScenarioEvalState) -> ScenarioEvalState:
    reason = (
        "unparseable output"
        if state["evaluation"] is None
        else "a summary that was too short/low-effort"
    )
    return {
        **state,
        "revision_note": (
            f"\nYour previous attempt was rejected for producing {reason}. "
            f"Return a valid score AND a specific, multi-sentence summary."
        ),
    }


def _finalize_node(state: ScenarioEvalState) -> ScenarioEvalState:
    return state


_graph = StateGraph(ScenarioEvalState)
_graph.add_node("evaluate", _evaluate_node)
_graph.add_node("validate", _validate_node)
_graph.add_node("prep_retry", _prep_retry_node)
_graph.add_node("finalize", _finalize_node)
_graph.set_entry_point("evaluate")
_graph.add_edge("evaluate", "validate")
_graph.add_conditional_edges(
    "validate", _route_after_validate, {"finalize": "finalize", "evaluate": "prep_retry"}
)
_graph.add_edge("prep_retry", "evaluate")
_graph.add_edge("finalize", END)
_compiled_graph = _graph.compile()


async def evaluate_scenario_response(
    job: JobPosting,
    question_text: str,
    response_text: str,
) -> ScenarioEvaluation | None:
    """
    Runs the evaluate -> validate -> retry LangGraph pipeline. Returns None
    only if every attempt failed to produce a valid (score + real summary)
    result — callers already treat None as "ungraded, let the candidate
    through anyway" (see scenario.py's submit_scenario), so this never
    blocks a submission, it just tries harder before giving up.
    """
    if not response_text or not response_text.strip():
        logger.warning("Scenario evaluation called with empty response text")
        return None

    initial_state: ScenarioEvalState = {
        "job_context": build_job_context(job),
        "job_level": job.job_level.value if job.job_level else None,
        "question_text": question_text,
        "response_text": response_text,
        "attempt": 0,
        "revision_note": "",
        "evaluation": None,
        "valid": False,
    }

    try:
        result = await _compiled_graph.ainvoke(initial_state)
    except Exception as exc:
        logger.error(f"Scenario evaluation graph failed for job {job.id}: {exc}")
        return None

    return result.get("evaluation")