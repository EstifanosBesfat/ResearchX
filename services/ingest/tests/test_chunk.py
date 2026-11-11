from ingest.chunk import chunk_document, estimate_tokens


def test_section_labels_are_kept():
    text = "\n".join(
        [
            "Abstract",
            "Antenatal care utilization was the focus.",
            "Methods",
            "We pooled household surveys.",
            "Results",
            "Attendance rose across regions.",
            "Discussion",
            "Coverage remains uneven.",
        ]
    )
    chunks = chunk_document(text)
    labels = [chunk["section"] for chunk in chunks]
    assert labels == ["abstract", "methods", "results", "discussion"]
    assert chunks[0]["chunk_index"] == 0
    assert chunks[-1]["chunk_index"] == 3


def test_long_sections_stay_near_800_to_1200_tokens_with_overlap():
    paragraph = "Community health workers recorded antenatal attendance and referral outcomes. " * 40
    text = "Methods\n\n" + "\n\n".join([paragraph] * 8)
    chunks = chunk_document(text)
    assert len(chunks) >= 2
    assert all(chunk["section"] == "methods" for chunk in chunks)
    tokens = [estimate_tokens(str(chunk["content"])) for chunk in chunks]
    assert all(token <= 1200 for token in tokens)
    assert all(token >= 800 for token in tokens[:-1])
    assert str(chunks[0]["content"])[-200:] in (str(chunks[0]["content"]) + str(chunks[1]["content"]))
    overlap = str(chunks[0]["content"])[-400:]
    assert overlap.strip()[:80] in str(chunks[1]["content"])
