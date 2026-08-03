"""
Scenario question generation — LangGraph pipeline.

Unlike the single-shot resume/JD extraction (see llm_extraction.py), scenario
question generation benefits from a generate -> critique -> revise loop: a
question that's too generic ("Tell me about a challenge you faced") or
unanswerable in the time limit is a bad candidate experience, and a second
LLM pass catching that before it's ever shown to a candidate is worth the
extra round trip. LangGraph is used here (not for the resume/JD extraction)
specifically because this is a genuine multi-step, conditionally-looping
flow — a plain prompt chain would need to hand-roll the same branching logic.
"""

import asyncio
from typing import Optional, TypedDict

from langgraph.graph import StateGraph, END
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.logging import logger
from app.db.models.job import JobPosting
from app.schemas.scenario_generation import ScenarioCritique, ScenarioDraft

MAX_REVISION_ATTEMPTS = 2  # generate + up to 2 revisions before forcing acceptance

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY.get_secret_value())
    return _client


# ---------------------------------------------------------------------------
# Graph state
# ---------------------------------------------------------------------------

class ScenarioGenState(TypedDict):
    job_context: str            # flattened role summary + skills + responsibilities
    job_level: Optional[str]
    draft_question: Optional[str]
    draft_time_limit: int
    critique_feedback: Optional[str]
    attempt: int
    final_question: Optional[str]
    final_time_limit: int


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

GENERATE_PROMPT = """\
You are writing a scenario-based interview question for a candidate applying
to this role. The question should describe a realistic, role-specific
situation and ask how the candidate would approach it — not a generic
behavioral question like "tell me about a time you faced a challenge."

Role context:
---
{job_context}
---
Seniority level: {job_level}

Requirements:
- The scenario must be specific enough that a generic, rehearsed answer
  would not fully address it.
- It should be answerable in writing within the suggested time limit —
  don't ask for a multi-part essay.
- Plain text only — no markdown, no HTML.
- Match difficulty to the seniority level (e.g. an intern-level scenario
  should not require system-design depth expected of a senior engineer).
{revision_note}
"""

CRITIQUE_PROMPT = """\
You are reviewing a scenario interview question before it is shown to
candidates. Be strict — this question will be timed and graded, so it must
be fair and specific.

Role context:
---
{job_context}
---
Seniority level: {job_level}

Draft question:
---
{draft_question}
---
Suggested time limit: {time_limit} seconds

Check:
1. Is it specific to this role (not generic boilerplate)?
2. Is it realistically answerable, in writing, within the time limit?
3. Does it avoid yes/no or trivia-style framing?
4. Is the difficulty appropriate for the seniority level?

If all checks pass, set passes=true. Otherwise set passes=false and give
concise, actionable feedback for the next draft.
"""


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

async def _generate_node(state: ScenarioGenState) -> ScenarioGenState:
    revision_note = (
        f"\nYour previous draft was rejected for this reason — fix it: "
        f"{state['critique_feedback']}"
        if state.get("critique_feedback")
        else ""
    )
    client = _get_client()
    response = await client.aio.models.generate_content(
        model=settings.GEMINI_EXTRACTION_MODEL,
        contents=GENERATE_PROMPT.format(
            job_context=state["job_context"],
            job_level=state["job_level"] or "unspecified",
            revision_note=revision_note,
        ),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ScenarioDraft,
            temperature=0.7,  # some creative variance is desirable here, unlike extraction
        ),
    )
    if response.parsed is None:
        raise ValueError("Scenario draft generation returned unparseable output")

    draft: ScenarioDraft = response.parsed  # type: ignore[assignment]
    return {
        **state,
        "draft_question": draft.question_text,
        "draft_time_limit": draft.suggested_time_limit_seconds,
        "attempt": state["attempt"] + 1,
    }


async def _critique_node(state: ScenarioGenState) -> ScenarioGenState:
    client = _get_client()
    response = await client.aio.models.generate_content(
        model=settings.GEMINI_EXTRACTION_MODEL,
        contents=CRITIQUE_PROMPT.format(
            job_context=state["job_context"],
            job_level=state["job_level"] or "unspecified",
            draft_question=state["draft_question"],
            time_limit=state["draft_time_limit"],
        ),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ScenarioCritique,
            temperature=0.1,  # critique should be consistent, not creative
        ),
    )
    if response.parsed is None:
        # Fail open: if critique itself breaks, accept the draft rather than
        # looping forever or discarding a possibly-fine question.
        logger.warning("Scenario critique returned unparseable output — accepting draft as-is")
        return {**state, "critique_feedback": None}

    critique: ScenarioCritique = response.parsed  # type: ignore[assignment]
    if critique.passes:
        return {**state, "critique_feedback": None}
    return {**state, "critique_feedback": critique.feedback}


def _finalize_node(state: ScenarioGenState) -> ScenarioGenState:
    return {
        **state,
        "final_question": state["draft_question"],
        "final_time_limit": state["draft_time_limit"],
    }


def _route_after_critique(state: ScenarioGenState) -> str:
    if state["critique_feedback"] is None:
        return "finalize"
    if state["attempt"] >= MAX_REVISION_ATTEMPTS:
        logger.info("Scenario generation hit max revision attempts — accepting last draft")
        return "finalize"
    return "generate"


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

_graph = StateGraph(ScenarioGenState)
_graph.add_node("generate", _generate_node)
_graph.add_node("critique", _critique_node)
_graph.add_node("finalize", _finalize_node)
_graph.set_entry_point("generate")
_graph.add_edge("generate", "critique")
_graph.add_conditional_edges(
    "critique", _route_after_critique, {"generate": "generate", "finalize": "finalize"}
)
_graph.add_edge("finalize", END)
_compiled_graph = _graph.compile()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def build_job_context(job: JobPosting) -> str:
    """
    Prefers the structured JD extraction (parsed_data) when available — it's
    already cleaned of boilerplate. Falls back to the raw description for
    jobs that haven't been through extraction yet, consistent with how
    matching degrades gracefully elsewhere.
    """
    if not job.parsed_data:
        return f"Title: {job.title}\n\n{job.description}"

    parts = [f"Title: {job.title}"]
    data = job.parsed_data
    if data.get("role_summary"):
        parts.append(f"Summary: {data['role_summary']}")
    if data.get("responsibilities"):
        parts.append("Responsibilities: " + "; ".join(data["responsibilities"]))
    skills = data.get("skills") or {}
    flat_skills = [s for group in skills.values() if isinstance(group, list) for s in group]
    if flat_skills:
        parts.append("Key skills: " + ", ".join(flat_skills))
    return "\n".join(parts)


async def generate_scenario_question(job: JobPosting) -> Optional[tuple[str, int]]:
    """
    Runs the generate -> critique -> revise LangGraph pipeline for a job
    posting. Returns (question_text, time_limit_seconds) on success, or
    None if the pipeline failed — non-fatal to caller.
    """
    initial_state: ScenarioGenState = {
        "job_context": build_job_context(job),
        "job_level": job.job_level.value if job.job_level else None,
        "draft_question": None,
        "draft_time_limit": 300,
        "critique_feedback": None,
        "attempt": 0,
        "final_question": None,
        "final_time_limit": 300,
    }
    try:
        result = await _compiled_graph.ainvoke(initial_state)
    except Exception as exc:
        logger.error(f"Scenario generation failed for job {job.id}: {exc}")
        return None

    if not result.get("final_question"):
        logger.error(f"Scenario generation for job {job.id} produced no final question")
        return None

    return result["final_question"], result["final_time_limit"]


async def generate_scenario_question_pool(
    job: JobPosting, count: int = 3
) -> list[tuple[str, int]]:
    """
    Runs `count` independent generate->critique->revise pipelines concurrently.
    Used at scenario start to pre-generate a full pool: the first result
    becomes the active question, the rest are held in reserve for
    tab-switch/paste violations later in the attempt (see scenario.py).
    Returns fewer than `count` entries if some generations fail — callers
    must handle a short (or empty) pool gracefully.
    """
    results = await asyncio.gather(
        *(generate_scenario_question(job) for _ in range(count)),
        return_exceptions=False,
    )
    return [r for r in results if r is not None]