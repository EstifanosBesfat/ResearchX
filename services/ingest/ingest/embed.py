from __future__ import annotations

import json
import urllib.error
import urllib.request

from ingest.config import (
    EMBEDDING_API_KEY,
    EMBEDDING_BASE_URL,
    EMBEDDING_DIMENSION,
    EMBEDDING_MODEL,
    EMBEDDING_SEND_DIMENSIONS,
)


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if not EMBEDDING_API_KEY:
        raise RuntimeError(
            "EMBEDDING_API_KEY is not set. Ingest and query share one OpenAI-compatible embeddings endpoint."
        )
    vectors: list[list[float] | None] = [None] * len(texts)
    for start in range(0, len(texts), 16):
        batch = [text[:12000] for text in texts[start : start + 16]]
        body: dict[str, object] = {"model": EMBEDDING_MODEL, "input": batch}
        if EMBEDDING_SEND_DIMENSIONS == "true" or EMBEDDING_MODEL.startswith("text-embedding-3"):
            body["dimensions"] = EMBEDDING_DIMENSION
        request = urllib.request.Request(
            f"{EMBEDDING_BASE_URL}/embeddings",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {EMBEDDING_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"Embedding request failed with status {error.code}.") from error
        rows = sorted(payload.get("data") or [], key=lambda item: item.get("index", 0))
        if len(rows) != len(batch):
            raise RuntimeError("The embedding response did not return a vector for every chunk.")
        for offset, row in enumerate(rows):
            embedding = row.get("embedding") or []
            if len(embedding) != EMBEDDING_DIMENSION:
                raise RuntimeError(f"Expected {EMBEDDING_DIMENSION} embedding dimensions, got {len(embedding)}.")
            vectors[start + offset] = embedding
    if any(vector is None for vector in vectors):
        raise RuntimeError("Embedding batch did not cover every chunk.")
    return [vector for vector in vectors if vector is not None]
