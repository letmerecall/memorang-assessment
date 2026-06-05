import fitz  # PyMuPDF


class NoExtractableTextError(ValueError):
    pass


def extract_text(file_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise NoExtractableTextError(f"could not open file as PDF: {e}") from e
    text = "".join(page.get_text() for page in doc)
    doc.close()
    text = text.strip()
    if not text:
        raise NoExtractableTextError("no extractable text found in this PDF")
    return text


def trim_to_budget(text: str, max_chars: int = 80_000) -> str:
    return text[:max_chars]
