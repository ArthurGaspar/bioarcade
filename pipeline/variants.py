"""Publish the curated ClinVar teaching snapshot without a network dependency.

Update data/variants.json after reviewing its linked records. The date records
that review, not the date a submitter last evaluated a variant.
"""
import json
from pathlib import Path

VERDICTS = {
    "Pathogenic": "pathogenic",
    "Likely pathogenic": "pathogenic",
    "Pathogenic/Likely pathogenic": "pathogenic",
    "Benign": "benign",
    "Likely benign": "benign",
    "Benign/Likely benign": "benign",
    "Uncertain significance": "uncertain",
    "Conflicting classifications of pathogenicity": "uncertain",
}


def verdict_rounds() -> dict:
    snapshot = json.loads((Path(__file__).resolve().parent.parent / "data" / "variants.json").read_text(encoding="utf-8"))
    for variant in snapshot["rounds"]:
        # Fail on an unfamiliar label rather than silently guessing a verdict.
        variant["verdict"] = VERDICTS[variant["classification"]]
    return snapshot
