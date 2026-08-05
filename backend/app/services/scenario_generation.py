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
from typing import Optional, TypedDict, List

from google import genai
from google.genai import types
from langgraph.graph import StateGraph, END

from app.core.config import settings
from app.core.logging import logger

from app.db.models.job import JobPosting

from app.schemas.scenario_generation import (
    ScenarioBatchCritique, ScenarioBatchDraft, ScenarioCritique,
    ScenarioDraft, ScenarioSingleDraft,
)

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


MAX_BATCH_REPAIR_ROUNDS = 1  # one bounded repair pass for failing questions, then accept as-is


# ---------------------------------------------------------------------------
# Batch pool generation — single call for all 3 questions + shared time limit
# ---------------------------------------------------------------------------

GENERATE_BATCH_PROMPT = """\
You are writing THREE independent scenario-based interview questions for a
candidate applying to this role. Each question should describe a distinct,
realistic, role-specific situation and ask how the candidate would approach
it — not a generic behavioral question like "tell me about a time you faced
a challenge."

Role context:
---
{job_context}
---
Seniority level: {job_level}

Requirements:
- Generate exactly 3 questions, each testing a different angle of the role
  (different systems, different types of problems) so they don't feel like
  variations of the same question.
- All 3 should be roughly equal in difficulty and answerable in writing
  within the same time limit.
- Each must be specific enough that a generic, rehearsed answer would not
  fully address it.
- Suggest ONE shared time limit (120-300 seconds) appropriate for all 3.
- Plain text only — no markdown, no HTML.
- Match difficulty to the seniority level.
"""

CRITIQUE_BATCH_PROMPT = """\
You are reviewing a batch of 3 scenario interview questions before they're
shown to candidates as a rotating pool (a candidate sees one at a time, but
all 3 must independently meet the bar). Be strict.

Role context:
---
{job_context}
---
Seniority level: {job_level}

Time limit for each: {time_limit} seconds

Questions:
1. {q1}
2. {q2}
3. {q3}

For EACH question, check:
1. Is it specific to this role (not generic boilerplate)?
2. Is it realistically answerable, in writing, within the time limit?
3. Does it avoid yes/no or trivia-style framing?
4. Is the difficulty appropriate for the seniority level?

Return one pass/fail + feedback result per question, in the same order.
"""

REPAIR_PROMPT = """\
You are rewriting ONE scenario interview question that was rejected during
review. Keep the same role context and target difficulty; produce a
replacement that fixes the issue below.

Role context:
---
{job_context}
---
Seniority level: {job_level}

Rejected question:
---
{question}
---
Reviewer feedback (fix this): {feedback}

Time limit: {time_limit} seconds

Write ONE replacement question only. Plain text, no markdown.
"""


class ScenarioPoolGenState(TypedDict):
    job_context: str
    job_level: Optional[str]
    questions: list[str]
    time_limit: int
    feedback: list[Optional[str]]   # per-index feedback; None = passed
    round: int
    final_questions: Optional[list[str]]
    final_time_limit: int


async def _generate_batch_node(state: ScenarioPoolGenState) -> ScenarioPoolGenState:
    client = _get_client()
    response = await client.aio.models.generate_content(
        model=settings.GEMINI_EXTRACTION_MODEL,
        contents=GENERATE_BATCH_PROMPT.format(
            job_context=state["job_context"],
            job_level=state["job_level"] or "unspecified",
        ),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ScenarioBatchDraft,
            temperature=0.7,
        ),
    )
    if response.parsed is None:
        raise ValueError("Scenario batch generation returned unparseable output")

    draft: ScenarioBatchDraft = response.parsed  # type: ignore[assignment]
    return {
        **state,
        "questions": list(draft.questions),
        "time_limit": draft.suggested_time_limit_seconds,
    }


async def _critique_batch_node(state: ScenarioPoolGenState) -> ScenarioPoolGenState:
    client = _get_client()
    q1, q2, q3 = state["questions"]
    response = await client.aio.models.generate_content(
        model=settings.GEMINI_EXTRACTION_MODEL,
        contents=CRITIQUE_BATCH_PROMPT.format(
            job_context=state["job_context"],
            job_level=state["job_level"] or "unspecified",
            time_limit=state["time_limit"],
            q1=q1, q2=q2, q3=q3,
        ),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ScenarioBatchCritique,
            temperature=0.1,
        ),
    )
    if response.parsed is None:
        # Fail open, same policy as the single-question pipeline.
        logger.warning("Scenario batch critique returned unparseable output — accepting batch as-is")
        return {**state, "feedback": [None, None, None]}

    critique: ScenarioBatchCritique = response.parsed  # type: ignore[assignment]
    feedback = [r.feedback if not r.passes else None for r in critique.results]
    return {**state, "feedback": feedback}


async def _repair_single(
    job_context: str, job_level: Optional[str], question: str, feedback: Optional[str], time_limit: int
) -> Optional[str]:
    client = _get_client()
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_EXTRACTION_MODEL,
            contents=REPAIR_PROMPT.format(
                job_context=job_context,
                job_level=job_level or "unspecified",
                question=question,
                feedback=feedback or "unspecified issue",
                time_limit=time_limit,
            ),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScenarioSingleDraft,
                temperature=0.7,
            ),
        )
        return response.parsed.question_text if response.parsed else None  # type: ignore
    except Exception as exc:
        logger.warning(f"Scenario question repair failed: {exc}")
        return None


async def _repair_node(state: ScenarioPoolGenState) -> ScenarioPoolGenState:
    """Regenerates only the questions that failed critique, concurrently."""
    indices = [i for i, fb in enumerate(state["feedback"]) if fb is not None]
    repaired = await asyncio.gather(*(
        _repair_single(state["job_context"], state["job_level"], state["questions"][i], state["feedback"][i], state["time_limit"])
        for i in indices
    ))
    new_questions = list(state["questions"])
    for idx, new_q in zip(indices, repaired):
        if new_q:  # keep the original if repair itself failed — fail open
            new_questions[idx] = new_q
    return {**state, "questions": new_questions, "round": state["round"] + 1, "feedback": [None, None, None]}


def _route_after_batch_critique(state: ScenarioPoolGenState) -> str:
    if all(fb is None for fb in state["feedback"]):
        return "finalize"
    if state["round"] >= MAX_BATCH_REPAIR_ROUNDS:
        logger.info("Scenario pool generation hit max repair rounds — accepting remaining questions as-is")
        return "finalize"
    return "repair"


def _finalize_pool_node(state: ScenarioPoolGenState) -> ScenarioPoolGenState:
    return {**state, "final_questions": state["questions"], "final_time_limit": state["time_limit"]}


_pool_graph = StateGraph(ScenarioPoolGenState)
_pool_graph.add_node("generate_batch", _generate_batch_node)
_pool_graph.add_node("critique_batch", _critique_batch_node)
_pool_graph.add_node("repair", _repair_node)
_pool_graph.add_node("finalize", _finalize_pool_node)
_pool_graph.set_entry_point("generate_batch")
_pool_graph.add_edge("generate_batch", "critique_batch")
_pool_graph.add_conditional_edges(
    "critique_batch", _route_after_batch_critique, {"finalize": "finalize", "repair": "repair"}
)
_pool_graph.add_edge("repair", "critique_batch")
_pool_graph.add_edge("finalize", END)
_compiled_pool_graph = _pool_graph.compile()


async def generate_scenario_question_pool(job: JobPosting, count: int = 3) -> list[tuple[str, int]]:
    """
    Single-call batch generation with a bounded batched critique/repair
    pass, replacing the earlier "3 independent full pipelines" approach.
    Cuts LLM calls from up to ~9 down to typically 2 (generate + critique),
    worst case 4 (+ repair + re-critique). All 3 questions share one
    time_limit_seconds, since swapping between them never resets the
    candidate's clock anyway.

    `count` is currently fixed at 3 by the response schema — kept as a
    parameter for API stability, not because other values are supported.
    Returns [] if generation failed entirely (unparseable batch output).
    """
    initial_state: ScenarioPoolGenState = {
        "job_context": build_job_context(job),
        "job_level": job.job_level.value if job.job_level else None,
        "questions": [],
        "time_limit": 300,
        "feedback": [None, None, None],
        "round": 0,
        "final_questions": None,
        "final_time_limit": 300,
    }
    try:
        result = await _compiled_pool_graph.ainvoke(initial_state)
    except Exception as exc:
        logger.error(f"Scenario pool generation failed for job {job.id}: {exc}")
        return []

    questions = result.get("final_questions") or []
    time_limit = result.get("final_time_limit", 300)
    return [(q, time_limit) for q in questions]