import io
from pypdf import PdfReader
from docx import Document

from app.core.logging import logger


def extract_text(file_bytes: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        return _extract_pdf_text(file_bytes)
    elif content_type == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return _extract_docx_text(file_bytes)
    raise ValueError(f"Unsupported content type for text extraction: {content_type}")


def _extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    text_parts = []
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            text_parts.append(extracted)
    text = "\n".join(text_parts).strip()
    if not text:
        logger.warning("PDF text extraction returned empty text — likely a scanned/image PDF")
    return text


def _extract_docx_text(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())