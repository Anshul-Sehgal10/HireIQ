"""
Outer entry point — run with:  python main.py
Or directly:                   uvicorn app.main:app --reload
"""

import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,       # auto-reload on file changes (dev only)
        log_level="info",
    )