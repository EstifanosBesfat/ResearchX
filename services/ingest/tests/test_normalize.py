from ingest.normalize import normalize_title


def test_normalized_title_ignores_case_and_punctuation():
    assert normalize_title("Antenatal Care, in Ethiopia!") == normalize_title("antenatal care in ethiopia")


def test_distinct_titles_stay_distinct():
    left = normalize_title("Malaria epidemiology and interventions in Ethiopia from 2001 to 2016.")
    right = normalize_title("Burden of malaria in Ethiopia, 2000-2016.")
    assert left != right
