from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

from ingest.config import CACHE_DIR

USER_AGENT = "ResearchX-ingest/0.1"
MAX_PDF_BYTES = 40 * 1024 * 1024


def _request(url: str, accept: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read(MAX_PDF_BYTES + 1)


def fetch_full_text_xml(pmcid: str) -> bytes | None:
    url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"
    try:
        payload = _request(url, "application/xml")
    except (urllib.error.URLError, TimeoutError):
        return None
    if payload.lstrip().startswith(b"<") or payload.lstrip().startswith(b"<?xml") or b"<article" in payload[:400]:
        return payload
    return None


def download_pdf(url: str, destination: Path) -> bool:
    if not url.startswith("https://"):
        return False
    try:
        payload = _request(url, "application/pdf")
    except (urllib.error.URLError, TimeoutError):
        return False
    if len(payload) > MAX_PDF_BYTES or not payload.startswith(b"%PDF"):
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    return True


def cached_pdf_path(key: str) -> Path:
    safe = "".join(character if character.isalnum() else "-" for character in key)[:80]
    return CACHE_DIR / f"{safe}.pdf"


def load_seed(path: Path) -> list[dict]:
    document = json.loads(path.read_text(encoding="utf-8"))
    papers = document.get("papers", [])
    if not isinstance(papers, list):
        raise RuntimeError("Seed manifest must contain a papers array.")
    return papers
