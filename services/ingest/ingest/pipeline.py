from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from typing import Any

from ingest.chunk import chunk_document
from ingest.db import connect, upsert_paper
from ingest.embed import embed_texts
from ingest.europepmc import cached_pdf_path, download_pdf, fetch_full_text_xml
from ingest.extract import extract_pdf_text, extract_xml_text
from ingest.metadata import extract_study_metadata
from ingest.normalize import content_hash


def acquire_text(entry: dict[str, Any], pdf_path: str | None = None) -> str:
    if pdf_path:
        text = extract_pdf_text(pdf_path)
        if text:
            return text
    pdf_url = entry.get("pdfUrl")
    key = str(entry.get("pmcid") or entry.get("externalId") or "upload")
    if isinstance(pdf_url, str) and pdf_url.startswith("https://"):
        destination = cached_pdf_path(key)
        cached = destination.exists() and destination.read_bytes()[:5] == b"%PDF"
        if cached or download_pdf(pdf_url, destination):
            text = extract_pdf_text(str(destination))
            if len(text) > 400:
                return text
    pmcid = entry.get("pmcid")
    if isinstance(pmcid, str) and pmcid:
        xml_bytes = fetch_full_text_xml(pmcid)
        if xml_bytes:
            try:
                text = extract_xml_text(xml_bytes)
            except ET.ParseError:
                text = ""
            if len(text) > 400:
                return text
    abstract = str(entry.get("abstract") or "").strip()
    if abstract:
        print(f"Using the abstract only for {entry.get('externalId')}.", file=sys.stderr)
        return f"Abstract\n\n{abstract}"
    raise RuntimeError(f"No open-access text for {entry.get('externalId') or entry.get('title')}.")


def ingest_entry(entry: dict[str, Any], pdf_path: str | None = None) -> dict[str, str | None]:
    if not str(entry.get("title") or "").strip():
        raise RuntimeError("A paper title is required.")
    text = acquire_text(entry, pdf_path)
    chunks = chunk_document(text)
    if not chunks:
        raise RuntimeError(f"No chunks produced for {entry.get('title')}.")
    embeddings = embed_texts([str(chunk["content"]) for chunk in chunks])
    metadata, extracted = extract_study_metadata(text)
    digest = content_hash(text)
    with connect() as connection:
        result = upsert_paper(connection, entry, chunks, embeddings, metadata, extracted, digest)
    print(
        f"{result['action']} {result['paperId']} {entry.get('title')}",
        file=sys.stderr,
    )
    return result
