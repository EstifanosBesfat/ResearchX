from __future__ import annotations

from typing import Any

import psycopg
from psycopg.types.json import Json

from ingest.config import DATABASE_URL
from ingest.normalize import normalize_title


def connect() -> psycopg.Connection:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set.")
    return psycopg.connect(DATABASE_URL)


def vector_literal(values: list[float]) -> str:
    if len(values) != 1536:
        raise RuntimeError(f"Expected 1536 embedding dimensions, got {len(values)}.")
    if any(value != value or value in (float("inf"), float("-inf")) for value in values):
        raise RuntimeError("Embedding contains a non-finite number.")
    return "[" + ",".join(f"{value:.8f}" for value in values) + "]"


def upsert_paper(
    connection: psycopg.Connection,
    entry: dict[str, Any],
    chunks: list[dict[str, Any]],
    embeddings: list[list[float]],
    metadata: dict[str, str | None],
    metadata_extracted: bool,
    digest: str,
) -> dict[str, str | None]:
    title = str(entry["title"]).strip()
    title_key = normalize_title(title)
    external_id = (entry.get("externalId") or None) and str(entry["externalId"]).strip()
    scope = entry.get("scope")
    if scope not in {"ethiopia", "international"}:
        scope = "ethiopia" if "ethiopia" in title.casefold() else "international"
    authors = entry.get("authors") or []
    if not isinstance(authors, list):
        authors = []
    tags = entry.get("diseaseTags") or []
    if not isinstance(tags, list):
        tags = []

    with connection.transaction():
        with connection.cursor() as cursor:
            existing = _find_existing(cursor, external_id, title_key)
            if existing is None:
                cursor.execute(
                    """
                    INSERT INTO papers (
                      external_id, title, title_normalized, authors, year, journal, abstract,
                      study_location, study_population, methodology, sample_size, scope,
                      disease_tags, source_url, pdf_url, content_hash, findings, limitations
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s
                    )
                    RETURNING id
                    """,
                    _insert_values(entry, title, title_key, external_id, authors, tags, scope, metadata, digest),
                )
                paper_id = str(cursor.fetchone()[0])
                _replace_chunks(cursor, paper_id, chunks, embeddings)
                return {"paperId": paper_id, "externalId": external_id, "action": "inserted"}

            paper_id = str(existing[0])
            stored_hash = existing[1]
            stored_external_id = existing[2]
            cursor.execute(
                """
                SELECT count(*) FILTER (WHERE embedding IS NOT NULL), count(*)
                FROM chunks WHERE paper_id = %s
                """,
                (paper_id,),
            )
            embedded_count, chunk_count = cursor.fetchone()
            same_body = stored_hash == digest and embedded_count == chunk_count == len(chunks) and chunk_count > 0
            _update_paper(
                cursor,
                paper_id,
                entry,
                title,
                title_key,
                stored_external_id or external_id,
                authors,
                tags,
                scope,
                metadata,
                metadata_extracted,
                digest,
            )
            if same_body:
                return {"paperId": paper_id, "externalId": stored_external_id or external_id, "action": "unchanged"}
            _replace_chunks(cursor, paper_id, chunks, embeddings)
            return {"paperId": paper_id, "externalId": stored_external_id or external_id, "action": "updated"}


def _find_existing(cursor: psycopg.Cursor, external_id: str | None, title_key: str) -> tuple[Any, Any, Any] | None:
    if external_id:
        cursor.execute(
            "SELECT id, content_hash, external_id FROM papers WHERE external_id = %s",
            (external_id,),
        )
        row = cursor.fetchone()
        if row:
            return row
    cursor.execute(
        "SELECT id, content_hash, external_id FROM papers WHERE title_normalized = %s",
        (title_key,),
    )
    return cursor.fetchone()


def _insert_values(
    entry: dict[str, Any],
    title: str,
    title_key: str,
    external_id: str | None,
    authors: list[Any],
    tags: list[Any],
    scope: str,
    metadata: dict[str, str | None],
    digest: str,
) -> tuple[Any, ...]:
    return (
        external_id,
        title,
        title_key,
        Json([str(author) for author in authors]),
        entry.get("year"),
        entry.get("journal"),
        entry.get("abstract"),
        metadata.get("study_location"),
        metadata.get("study_population"),
        metadata.get("methodology"),
        metadata.get("sample_size"),
        scope,
        [str(tag) for tag in tags],
        entry.get("sourceUrl"),
        entry.get("pdfUrl"),
        digest,
        metadata.get("findings"),
        metadata.get("limitations"),
    )


def _update_paper(
    cursor: psycopg.Cursor,
    paper_id: str,
    entry: dict[str, Any],
    title: str,
    title_key: str,
    external_id: str | None,
    authors: list[Any],
    tags: list[Any],
    scope: str,
    metadata: dict[str, str | None],
    metadata_extracted: bool,
    digest: str,
) -> None:
    if metadata_extracted:
        location = metadata.get("study_location")
        population = metadata.get("study_population")
        methodology = metadata.get("methodology")
        sample_size = metadata.get("sample_size")
        findings = metadata.get("findings")
        limitations = metadata.get("limitations")
    else:
        cursor.execute(
            """
            SELECT study_location, study_population, methodology, sample_size, findings, limitations
            FROM papers WHERE id = %s
            """,
            (paper_id,),
        )
        location, population, methodology, sample_size, findings, limitations = cursor.fetchone()
    cursor.execute(
        """
        UPDATE papers SET
          external_id = %s,
          title = %s,
          title_normalized = %s,
          authors = %s,
          year = %s,
          journal = %s,
          abstract = COALESCE(%s, abstract),
          study_location = %s,
          study_population = %s,
          methodology = %s,
          sample_size = %s,
          scope = %s,
          disease_tags = %s,
          source_url = COALESCE(%s, source_url),
          pdf_url = COALESCE(%s, pdf_url),
          content_hash = %s,
          findings = %s,
          limitations = %s
        WHERE id = %s
        """,
        (
            external_id,
            title,
            title_key,
            Json([str(author) for author in authors]),
            entry.get("year"),
            entry.get("journal"),
            entry.get("abstract"),
            location,
            population,
            methodology,
            sample_size,
            scope,
            [str(tag) for tag in tags],
            entry.get("sourceUrl"),
            entry.get("pdfUrl"),
            digest,
            findings,
            limitations,
            paper_id,
        ),
    )


def _replace_chunks(
    cursor: psycopg.Cursor,
    paper_id: str,
    chunks: list[dict[str, Any]],
    embeddings: list[list[float]],
) -> None:
    cursor.execute("DELETE FROM chunks WHERE paper_id = %s", (paper_id,))
    for chunk, embedding in zip(chunks, embeddings, strict=True):
        cursor.execute(
            """
            INSERT INTO chunks (paper_id, section, chunk_index, content, embedding)
            VALUES (%s, %s, %s, %s, %s::vector)
            """,
            (
                paper_id,
                chunk["section"],
                chunk["chunk_index"],
                chunk["content"],
                vector_literal(embedding),
            ),
        )
