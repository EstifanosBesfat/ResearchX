from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from ingest.config import SEED_PATH
from ingest.europepmc import load_seed
from ingest.pipeline import ingest_entry


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest the ResearchX open-access seed through Europe PMC.")
    parser.add_argument("--external-id", help="Ingest one manifest entry by DOI, PMCID, or external id.")
    parser.add_argument("--pdf", help="Open-access PDF to ingest with --metadata.")
    parser.add_argument("--metadata", help="JSON metadata for --pdf.")
    parser.add_argument("--limit", type=int, help="Ingest only the first N manifest entries.")
    args = parser.parse_args(argv)

    if args.pdf:
        if not args.metadata:
            print("--pdf requires --metadata.", file=sys.stderr)
            return 1
        entry = json.loads(open(args.metadata, encoding="utf-8").read())
        if not isinstance(entry, dict):
            print("Metadata must be a JSON object.", file=sys.stderr)
            return 1
        try:
            result = ingest_entry(entry, pdf_path=args.pdf)
        except Exception as error:
            print(str(error), file=sys.stderr)
            return 1
        print(json.dumps(result))
        return 0

    papers = load_seed(SEED_PATH)
    if args.external_id:
        papers = [paper for paper in papers if _matches(paper, args.external_id)]
        if not papers:
            print(f"No seed paper matches {args.external_id}.", file=sys.stderr)
            return 1
    if args.limit is not None:
        papers = papers[: args.limit]

    failures = 0
    for paper in papers:
        try:
            result = ingest_entry(paper)
        except Exception as error:
            failures += 1
            print(f"Failed {paper.get('externalId')}: {error}", file=sys.stderr)
            continue
        print(json.dumps(result), flush=True)
    if failures:
        print(f"{failures} paper(s) failed.", file=sys.stderr)
        return 1
    return 0


def _matches(paper: dict[str, Any], external_id: str) -> bool:
    needle = external_id.casefold()
    values = [paper.get("externalId"), paper.get("doi"), paper.get("pmcid"), paper.get("pmid")]
    return any(str(value).casefold() == needle for value in values if value)


if __name__ == "__main__":
    raise SystemExit(main())
