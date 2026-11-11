from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from ingest.clean import clean_text, drop_repeated_edge_lines


def extract_pdf_pages(path: str) -> list[str]:
    import pymupdf

    document = pymupdf.open(path)
    try:
        return [page.get_text("text") or "" for page in document]
    finally:
        document.close()


def extract_pdf_text(path: str) -> str:
    return clean_text(drop_repeated_edge_lines(extract_pdf_pages(path)))


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _clean_inline(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _text_of(element: ET.Element) -> str:
    parts: list[str] = []
    if element.text:
        parts.append(element.text)
    for child in list(element):
        if _local(child.tag) == "xref":
            if child.tail:
                parts.append(child.tail)
            continue
        parts.append(_text_of(child))
        if child.tail:
            parts.append(child.tail)
    return "".join(parts)


def _find_first(root: ET.Element, name: str) -> ET.Element | None:
    for element in root.iter():
        if _local(element.tag) == name:
            return element
    return None


def _render_section(section: ET.Element) -> str:
    title = ""
    paragraphs: list[str] = []
    for element in section.iter():
        name = _local(element.tag)
        if name == "title" and not title and element is not section:
            title = _clean_inline(_text_of(element))
        elif name == "p":
            paragraph = _clean_inline(_text_of(element))
            if paragraph:
                paragraphs.append(paragraph)
        elif name == "tr":
            cells = [
                _clean_inline(_text_of(cell))
                for cell in list(element)
                if _local(cell.tag) in {"td", "th"}
            ]
            line = " | ".join(cell for cell in cells if cell)
            if line:
                paragraphs.append(line)
    # The section's own title is the first title descendant, which may be itself.
    own_title = ""
    for child in list(section):
        if _local(child.tag) == "title":
            own_title = _clean_inline(_text_of(child))
            break
    body = "\n\n".join(paragraphs)
    heading = own_title or title
    if heading and body:
        return f"{heading}\n\n{body}"
    return heading or body


def extract_xml_text(xml_bytes: bytes) -> str:
    root = ET.fromstring(xml_bytes)
    blocks: list[str] = []
    abstract = _find_first(root, "abstract")
    if abstract is not None:
        rendered = _render_section(abstract)
        blocks.append(f"Abstract\n\n{rendered}" if rendered and not rendered.lower().startswith("abstract") else rendered)
    body = _find_first(root, "body")
    if body is not None:
        for child in list(body):
            if _local(child.tag) == "sec":
                rendered = _render_section(child)
                if rendered:
                    blocks.append(rendered)
            elif _local(child.tag) == "p":
                paragraph = _clean_inline(_text_of(child))
                if paragraph:
                    blocks.append(paragraph)
    return clean_text("\n\n".join(block for block in blocks if block.strip()))
