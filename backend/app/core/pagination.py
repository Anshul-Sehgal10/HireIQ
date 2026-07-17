"""
Generic cursor pagination for created_at+id ordered feeds.

Cursor encodes (created_at, id) of the last row on the current page, so the
next page resumes exactly there — stable under concurrent inserts, unlike
OFFSET pagination which skips/repeats rows as the feed grows underneath it.
"""

import base64
import uuid
from datetime import datetime


def encode_cursor(created_at: datetime, id_: uuid.UUID) -> str:
    payload = f"{created_at.isoformat()}|{id_}"
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        payload = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts_str, id_str = payload.split("|", 1)
        return datetime.fromisoformat(ts_str), uuid.UUID(id_str)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("Invalid pagination cursor") from exc