from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

from ingest.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL

FIELDS = ("study_location", "study_population", "methodology", "sample_size", "findings", "limitations")

SYSTEM_PROMPT = """Extract study metadata from the paper text. Return one JSON object and nothing else.
Copy only facts the text states. Use null when a field is not stated. Do not calculate a sample size.
{
  "study_location": string | null,
  "study_population": string | null,
  "methodology": string | null,
  "sample_size": string | null,
  "findings": string | null,
  "limitations": string | null
}"""


def empty_metadata() -> dict[str, str | None]:
    return {field: None for field in FIELDS}


def extract_study_metadata(text: str) -> tuple[dict[str, str | None], bool]:
    if not LLM_API_KEY:
        print("LLM_API_KEY is not set; study metadata fields left null.", file=sys.stderr)
        return empty_metadata(), False
    excerpt = text[:14000]
    body = {
        "model": LLM_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": excerpt},
        ],
    }
    request = urllib.request.Request(
        f"{LLM_BASE_URL}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = json.loads(response.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
    except (urllib.error.URLError, KeyError, TimeoutError, json.JSONDecodeError) as error:
        print(f"Study metadata extraction skipped: {error}", file=sys.stderr)
        return empty_metadata(), False
    return _sanitize(content), True


def _sanitize(content: str) -> dict[str, str | None]:
    trimmed = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        parsed = json.loads(trimmed)
    except json.JSONDecodeError:
        return empty_metadata()
    cleaned = empty_metadata()
    if not isinstance(parsed, dict):
        return cleaned
    for field in FIELDS:
        value = parsed.get(field)
        if isinstance(value, str):
            text = " ".join(value.split())
            cleaned[field] = text[:2000] if text else None
    return cleaned
