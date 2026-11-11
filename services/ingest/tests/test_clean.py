from ingest.clean import clean_text, drop_repeated_edge_lines


def test_clean_text_drops_the_reference_list():
    raw = "Results\n\nHaemorrhage was common.\n\nReferences\n\n1. Someone. A paper. 2014."
    cleaned = clean_text(raw)
    assert "Haemorrhage was common." in cleaned
    assert "Someone. A paper" not in cleaned


def test_repeated_running_headers_and_page_numbers_are_removed():
    pages = [
        "Malaria Journal\nSeasonal drivers were associated with incidence.\n12",
        "Malaria Journal\nHighland districts showed a later peak.\n13",
        "Malaria Journal\nRainfall remained the strongest correlate.\n14",
    ]
    cleaned = drop_repeated_edge_lines(pages)
    assert "Malaria Journal" not in cleaned
    assert "Seasonal drivers" in cleaned
    assert "\n12" not in cleaned
    assert "Highland districts" in cleaned
