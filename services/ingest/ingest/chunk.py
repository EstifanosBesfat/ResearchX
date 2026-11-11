from __future__ import annotations

import re

SECTION_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("abstract", re.compile(r"^abstract\b", re.IGNORECASE)),
    ("methods", re.compile(r"^(materials and methods|patients and methods|methods|methodology)\b", re.IGNORECASE)),
    ("results", re.compile(r"^results\b", re.IGNORECASE)),
    ("discussion", re.compile(r"^(discussion|conclusion|conclusions)\b", re.IGNORECASE)),
    ("introduction", re.compile(r"^(introduction|background)\b", re.IGNORECASE)),
]

TARGET_CHARS = 4000
MAX_CHARS = 4800
OVERLAP_CHARS = 600


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def split_sections(text: str) -> list[tuple[str, str]]:
    label = "other"
    buffer: list[str] = []
    sections: list[tuple[str, list[str]]] = []
    for line in text.splitlines():
        stripped = line.strip()
        matched = None
        if stripped and len(stripped) <= 80:
            for candidate, pattern in SECTION_RULES:
                if pattern.match(stripped):
                    matched = candidate
                    break
        if matched:
            if any(part.strip() for part in buffer):
                sections.append((label, buffer))
            label = matched
            buffer = []
            continue
        buffer.append(line)
    if any(part.strip() for part in buffer):
        sections.append((label, buffer))
    rendered = [("\n".join(lines).strip()) for _, lines in sections]
    return [(name, body) for (name, _), body in zip(sections, rendered, strict=True) if body]


def slice_section(label: str, text: str) -> list[dict[str, str]]:
    if len(text) <= MAX_CHARS:
        return [{"section": label, "content": text}]
    pieces: list[dict[str, str]] = []
    start = 0
    while start < len(text):
        end = min(start + TARGET_CHARS, len(text))
        if end < len(text):
            window = text[start:end]
            cut = max(window.rfind("\n\n"), window.rfind("\n"), window.rfind(" "))
            if cut >= 3400:
                end = start + cut
        if end <= start:
            end = min(start + TARGET_CHARS, len(text))
        piece = text[start:end].strip()
        if piece:
            pieces.append({"section": label, "content": piece})
        if end >= len(text):
            break
        next_start = max(end - OVERLAP_CHARS, start + 1)
        if next_start <= start:
            break
        start = next_start
    return pieces


def chunk_document(text: str) -> list[dict[str, object]]:
    chunks: list[dict[str, object]] = []
    for label, section in split_sections(text):
        for piece in slice_section(label, section):
            chunks.append(
                {
                    "section": piece["section"],
                    "chunk_index": len(chunks),
                    "content": piece["content"],
                }
            )
    return chunks
