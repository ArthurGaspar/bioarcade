from copy import deepcopy

import pytest

from pipeline.build import load_all
from pipeline.codons import QUIZ_CODONS, RUNNER_GENES, RUNNER_NT, codon_runner_rounds
from pipeline.transcripts import translate


def test_runner_excerpts_match_real_windows_and_cds_reading_frames():
    genes = load_all()
    original = deepcopy(genes)
    rounds = codon_runner_rounds(genes)
    assert [r["gene"] for r in rounds] == list(RUNNER_GENES)
    assert rounds == codon_runner_rounds(list(reversed(genes)))
    assert genes == original
    for r in rounds:
        gene = next(g for g in genes if g["symbol"] == r["gene"])
        assert r["cdsStart"] % 3 == 0
        assert len(r["seq"]) == RUNNER_NT and set(r["seq"]) <= set("ACGT")
        assert r["protein"] == translate(r["seq"])
        assert "*" not in r["protein"][:-1]
        assert r["quizCodons"] == QUIZ_CODONS
        assert r["transcriptId"] == gene["transcriptId"]
        exon = next(e for e in gene["exons"] if e["number"] == r["exon"])
        assert any(
            w["seq"][r["cdsStart"] - exon["cdsOffset"] - w["start"]:][:RUNNER_NT] == r["seq"]
            for w in gene["windows"] if w["exon"] == r["exon"]
        )
    assert rounds[0]["seconds"] > rounds[-1]["seconds"] > 0


@pytest.mark.parametrize("phase", [0, 1, 2])
def test_alignment_uses_cds_offset_even_on_minus_strand(phase):
    trim = (-phase) % 3
    gene = dict(symbol="HBB", strand=-1, transcriptId="TEST", chromosome="1",
                exons=[dict(number=1, cdsOffset=phase)],
                windows=[dict(exon=1, start=0, seq="C" * trim + "ATG" * 20 + "CC")])
    [r] = codon_runner_rounds([gene])
    assert r["seq"] == "ATG" * 20
    assert r["protein"] == "M" * 20
    assert r["cdsStart"] == phase + trim


def test_unusable_windows_are_skipped_without_inventing_sequence():
    gene = dict(symbol="HBB", transcriptId="TEST", chromosome="1",
                exons=[dict(number=1, cdsOffset=0)], windows=[])
    for seq in ["ATG", "N" * 72, "TAA" + "ATG" * 23]:
        gene["windows"] = [dict(exon=1, start=0, seq=seq)]
        assert codon_runner_rounds([gene]) == []
    assert codon_runner_rounds([]) == []
