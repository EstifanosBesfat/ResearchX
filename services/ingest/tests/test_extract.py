from ingest.extract import extract_xml_text


def test_xml_keeps_section_labels_and_drops_references():
    xml = b"""<?xml version="1.0"?>
    <article>
      <front><article-meta><abstract><title>Abstract</title><p>Antenatal care was studied.</p></abstract></article-meta></front>
      <body>
        <sec><title>Methods</title><p>Surveys covered four regions.</p></sec>
        <sec><title>Results</title><p>Utilization differed by residence.</p></sec>
      </body>
      <back><ref-list><ref><mixed-citation>A closed citation that must not survive.</mixed-citation></ref></ref-list></back>
    </article>
    """
    text = extract_xml_text(xml)
    assert "Antenatal care was studied." in text
    assert "Methods" in text
    assert "Utilization differed by residence." in text
    assert "closed citation" not in text
