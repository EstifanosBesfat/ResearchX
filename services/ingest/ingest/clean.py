from __future__ import annotations

import re
from collections import Counter

REFERENCE_HEADING = re.compile(r"(?im)^[ \t]*(references|bibliography|literature cited|works cited)\s*$")
PAGE_NUMBER = re.compile(r"^\d{1,4}$")
NOISE_LINE = re.compile(r"(?i)downloaded from|all rights reserved|creative commons attribution|doi:\s*10\.")


def drop_references(text: str) -> str:
    match = REFERENCE_HEADING.search(text)
    if not match:
        return text
    return text[: match.start()].rstrip()


def drop_repeated_edge_lines(pages: list[str]) -> str:
    edges: list[str] = []
    parsed: list[list[str]] = []
    for page in pages:
        lines = page.splitlines()
        parsed.append(lines)
        content = [line.strip() for line in lines if line.strip()]
        if not content:
            continue
        edges.append(content[0])
        if len(content) > 1:
            edges.append(content[-1])
    counts = Counter(edges)
    threshold = max(3, int(len(pages) * 0.4))
    repeated = {line for line, count in counts.items() if count >= threshold and len(line) < 140}
    kept_pages: list[str] = []
    for lines in parsed:
        kept: list[str] = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                kept.append("")
                continue
            if stripped in repeated or PAGE_NUMBER.fullmatch(stripped) or NOISE_LINE.search(stripped):
                continue
            kept.append(line.rstrip())
        kept_pages.append("\n".join(kept).strip())
    return "\n\n".join(page for page in kept_pages if page)


def clean_text(text: str) -> str:
    cleaned = drop_references(text).replace("\x00", " ")
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()
