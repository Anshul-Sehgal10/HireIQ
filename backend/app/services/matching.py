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