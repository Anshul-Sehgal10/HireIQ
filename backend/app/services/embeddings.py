# app/services/embeddings.py
"""
Embedding generation — shared between resumes and job descriptions.

Both are embedded with task_type=SEMANTIC_SIMILARITY since they're compared
symmetrically via cosine similarity (not asymmetric query->document retrieval).
"""

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.logging import logger

EMBEDDING_DIMENSIONS = 1536  # must match Vector(1536) columns in the schema

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY.get_secret_value())
    return _client


async def embed_text(text: str) -> list[float]:
    """
    Returns a 1536-dim embedding for a single piece of text.
    Raises on empty input or API failure — callers should decide how to
    handle that (e.g. leave embedding null and let a retry job pick it up).
    """
    if not text or not text.strip():
        raise ValueError("Cannot embed empty text")

    client = _get_client()
    response = await client.aio.models.embed_content(
        model=settings.GEMINI_EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            task_type="SEMANTIC_SIMILARITY",
            output_dimensionality=EMBEDDING_DIMENSIONS,
        ),
    )
    embedding = response.embeddings[0].values # type: ignore
    if len(embedding) != EMBEDDING_DIMENSIONS: # type: ignore
        logger.error(
            f"Unexpected embedding dimension: got {len(embedding)}, " # type: ignore
            f"expected {EMBEDDING_DIMENSIONS}"
        )
        raise ValueError("Embedding dimension mismatch")
    return embedding # type: ignore


def structured_extraction_to_embedding_text(data: dict) -> str:
    """
    Flattens a structured extraction dict (resume or JD) into clean text
    for embedding. Deliberately not raw JSON — key names and punctuation
    add noise the embedding model doesn't need.
    """
    lines: list[str] = []

    def add(label: str, value):
        if not value:
            return
        if isinstance(value, list):
            value = ", ".join(str(v) for v in value if v)
            if not value:
                return
        lines.append(f"{label}: {value}")

    # Works for both resume and JD dicts — just walks whatever keys exist.
    for key, value in data.items():
        if key == "categories":
            continue  # categories drive filtering, not the embedding text
        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                add(f"{key}.{sub_key}", sub_value)
        elif isinstance(value, list) and value and isinstance(value[0], dict):
            for i, item in enumerate(value):
                for sub_key, sub_value in item.items():
                    add(f"{key}[{i}].{sub_key}", sub_value)
        else:
            add(key, value)

    return "\n".join(lines)