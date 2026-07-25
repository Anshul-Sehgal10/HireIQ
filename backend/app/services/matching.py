"""
Cosine similarity between a resume embedding and a JD embedding.

Computed in Python rather than via a SQL query, since both vectors are
already in memory at apply-time (job + resume_version are already fetched
by the route) — no reason to round-trip to Postgres for this.
"""

import math

def cosine_similarity(a: list[float] | None, b: list[float] | None) -> float | None:
    """Custom cosine similarity implementation that handles None gracefully.
    Returns None if either vector is None or has zero magnitude."""
    if a is None or b is None:
        return None
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return None
    similarity = dot / (norm_a * norm_b)
    # Clamp for float drift — cosine similarity is mathematically bounded [-1, 1]
    return max(-1.0, min(1.0, similarity))

# Cross-domain penalty applied when resume and job share no category.
# Cosine similarity between unrelated professional documents still runs
# high due to shared vocabulary/structure, not genuine relevance — this
# flat penalty keeps that from clearing the match_threshold on its own.
CROSS_DOMAIN_PENALTY = 0.6


def compute_match_score(
    resume_embedding: list[float] | None,
    jd_embedding: list[float] | None,
    resume_categories: list[str] | None,
    job_categories: list[str] | None,
) -> float | None:
    """
    Cosine similarity, adjusted for category overlap.

    If either side has no categories yet (extraction pending/failed), falls
    back to pure cosine similarity rather than penalizing — consistent with
    how the feed already treats uncategorized jobs as visible rather than
    excluded.
    """
    similarity = cosine_similarity(resume_embedding, jd_embedding)
    if similarity is None:
        return None

    if not resume_categories or not job_categories:
        return similarity

    overlap = bool(set(resume_categories) & set(job_categories))
    if not overlap:
        similarity *= CROSS_DOMAIN_PENALTY

    return similarity

# Weighted blend for composite ranking. Fixed platform-wide for now (not
# stored/configurable per job) — kept in one place so it's a one-line
# change if this needs to become per-job later, mirroring how
# match_threshold already is.
RESUME_SCORE_WEIGHT = 0.6
SCENARIO_SCORE_WEIGHT = 0.4


def compute_composite_score(
    match_score: float | None,
    scenario_score: float | None,
    scenario_enabled: bool,
) -> float | None:
    """
    Computed on read, never stored — so the weighting can change without a
    backfill migration.

    - Scenario disabled, or enabled but not yet scored → falls back to
      match_score alone (nothing to blend with).
    - match_score missing (embeddings not ready yet) but scenario_score
      present → falls back to scenario_score alone, rather than treating
      the missing signal as a zero and dragging the composite down
      unfairly.
    """
    if not scenario_enabled or scenario_score is None:
        return match_score
    if match_score is None:
        return scenario_score
    return RESUME_SCORE_WEIGHT * match_score + SCENARIO_SCORE_WEIGHT * scenario_score