from datetime import date
from urllib.parse import urlparse

from pipeline.variants import VERDICTS, verdict_rounds


def test_snapshot_has_sourced_complete_cases_for_every_verdict():
    snapshot = verdict_rounds()
    assert date.fromisoformat(snapshot["reviewedAt"])
    rounds = snapshot["rounds"]
    assert len(rounds) == 8
    assert len({r["id"] for r in rounds}) == len(rounds)
    assert {r["verdict"] for r in rounds} == {"pathogenic", "benign", "uncertain"}
    for r in rounds:
        assert r["verdict"] == VERDICTS[r["classification"]]
        assert len(r["clues"]) == 3
        assert all(c["title"] and c["text"] for c in r["clues"])
        assert r["transcript"].startswith("NM_")
        assert r["dna"].startswith("c.") and r["protein"].startswith("p.")
        assert r["context"] and r["scope"] and r["reviewStatus"] and r["explanation"]
        url = urlparse(r["sourceUrl"])
        assert url.scheme == "https" and url.netloc == "www.ncbi.nlm.nih.gov"
        assert r["accession"].startswith(("VCV", "RCV")) and "." in r["accession"]
        if r["accession"].startswith("RCV"):
            assert r["accession"] in url.path and "condition" in r["scope"]
        else:
            assert url.path == f"/clinvar/variation/{r['id']}/"


def test_buckets_preserve_uncertainty_and_condition_scope():
    rounds = {r["id"]: r for r in verdict_rounds()["rounds"]}
    assert rounds["1010135"]["classification"] == "Uncertain significance"
    assert rounds["7126"]["classification"] == "Conflicting classifications of pathogenicity"
    assert rounds["1010135"]["verdict"] == rounds["7126"]["verdict"] == "uncertain"
    assert rounds["2025079"]["classification"] == "Likely benign"
    # Its variant-wide record has conflicts; this answer is condition-specific.
    assert rounds["93154"]["accession"] == "RCV001007581.24"
    assert rounds["93154"]["context"] == "Cystic fibrosis"
    assert rounds["93154"]["verdict"] == "benign"
    assert verdict_rounds() == verdict_rounds()
