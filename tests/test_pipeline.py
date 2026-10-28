import json
from pathlib import Path

import numpy as np
import pytest

from pipeline import offtargets
from pipeline.analyze import pam_sites
from pipeline.guides import RULES, find_guides, revcomp, score
from pipeline.transcripts import _coding_slice, translate

ROOT = Path(__file__).resolve().parent.parent


def test_revcomp():
    assert revcomp("ATGCCGT") == "ACGGCAT"
    assert revcomp(revcomp("ATGCCGTNA")) == "ATGCCGTNA"


class TestCodingSlice:
    """Exon [start, end] in genomic coordinates against a CDS that may cover part of it."""

    def test_plus_strand_fully_coding(self):
        assert _coding_slice(100, 199, 1, 50, 300) == (0, 100)

    def test_plus_strand_partly_coding(self):
        # CDS starts at 120: the first 20 bases of the exon are untranslated.
        assert _coding_slice(100, 199, 1, 120, 300) == (20, 100)

    def test_minus_strand_partly_coding(self):
        # Reading right to left, a CDS ending at 180 leaves the exon's first 19 bases untranslated.
        assert _coding_slice(100, 199, -1, 50, 180) == (19, 100)

    def test_non_coding_exon(self):
        assert _coding_slice(100, 199, 1, 500, 900) == (0, 0)

    def test_minus_strand_is_the_mirror_of_plus(self):
        start, end = _coding_slice(100, 199, -1, 130, 170)
        assert (start, end) == (29, 70)
        assert end - start == 41  # same number of coding bases either way


def test_translate_reads_codons():
    assert translate("ATGGCCTAA") == "MA*"
    assert translate("ATGGCCTA") == "MA"  # a trailing partial codon is dropped


class TestFindGuides:
    def exon(self, seq, cds_start=0, cds_end=None, number=1, offset=0):
        return [{"number": number, "seq": seq, "cds_start": cds_start, "cds_end": len(seq) if cds_end is None else cds_end, "cds_offset": offset}]

    def test_finds_sense_guide_and_cut_position(self):
        spacer = "ACGTACGTACGTACGTACGT"
        seq = spacer + "AGG" + "TTTTT"  # PAM at 20..22, cut between bases 16 and 17
        [g] = [x for x in find_guides(self.exon(seq)) if x.strand == "+"]
        assert (g.spacer, g.pam, g.cut) == (spacer, "AGG", 17)

    def test_finds_antisense_guide(self):
        spacer = "ACGTACGTACGTACGTACGT"
        # On the other strand the PAM reads CCN and sits before the protospacer.
        seq = "TTTTT" + "CCT" + revcomp(spacer)
        [g] = [x for x in find_guides(self.exon(seq)) if x.strand == "-"]
        assert (g.spacer, g.pam, g.cut) == (spacer, "AGG", 11)

    def test_skips_guides_cutting_outside_the_coding_region(self):
        seq = "ACGTACGTACGTACGTACGT" + "AGG" + "TTTTT"
        assert find_guides(self.exon(seq, cds_start=18, cds_end=len(seq))) == []

    def test_cut_is_reported_in_cds_coordinates(self):
        seq = "ACGTACGTACGTACGTACGT" + "AGG" + "TTTTT"
        [g] = [x for x in find_guides(self.exon(seq, cds_start=0, offset=300)) if x.strand == "+"]
        assert g.cut == 317

    def test_drops_guides_containing_n(self):
        seq = "ACGTACGTNCGTACGTACGT" + "AGG" + "TTTTT"
        assert [x for x in find_guides(self.exon(seq)) if x.strand == "+"] == []


class TestScore:
    # One spacer per rule, and the phrase its reason must contain.
    PROBES = {
        "gc_ok": ("GCGATCGATCGATCGATAGC", "sweet spot"),
        "gc_bad": ("AAAAAAAAAAAAAAAAAAAA", "outside 40-70%"),
        "polyt": ("GCGATCGATTTTTCGATAGC", "TTTT"),
        "homopolymer": ("GCGATCGAAAAAACGATAGC", "identical bases"),
        "gc_at_pam": ("GCGATCGATCGATCGATAGC", "next to the PAM helps"),
        "seed_gc": ("ATATATATATATGCGCGCGC", "seed next to the PAM"),
        "starts_g": ("GCGATCGATCGATCGATAGC", "starts with G"),
    }

    def test_every_declared_rule_can_fire(self):
        """The published table must match the code, so each rule needs a spacer that triggers it."""
        assert {r["id"] for r in RULES} == set(self.PROBES), "a rule was added without a probe"
        for rule_id, (spacer, phrase) in self.PROBES.items():
            reasons = " | ".join(score(spacer)[1])
            assert phrase in reasons, f"rule {rule_id} did not fire on {spacer}: {reasons}"

    def test_poly_t_is_heavily_penalized(self):
        with_t = score("GCGATCGATTTTTCGATAGC")[0]
        without = score("GCGATCGATGTTTCGATAGC")[0]
        assert without - with_t >= 40

    def test_score_is_clamped(self):
        assert 0 <= score("TTTTTTTTTTTTTTTTTTTT")[0] <= 100
        assert 0 <= score("GCGATCGATCGATCGATAGC")[0] <= 100

    def test_reasons_explain_every_adjustment(self):
        points, reasons = score("AAAAAAAAAAAAAAAAAAAA")
        assert reasons and all(("+" in r or "-" in r) for r in reasons)


class TestOffTargets:
    def test_encode_is_two_bits_per_base(self):
        assert offtargets.encode("A" * 20) == 0
        assert offtargets.encode("A" * 19 + "C") == 1
        assert offtargets.encode("A" * 19 + "T") == 3
        assert offtargets.encode("C" + "A" * 19) == 1 << 38

    def test_mismatch_counts_are_exact(self):
        # Substituting C into an all-A spacer keeps every site distinct.
        spacer = "A" * 20
        sites = ["C" * n + "A" * (20 - n) for n in range(5)]  # 0 to 4 mismatches
        index = np.array(sorted(offtargets.encode(s) for s in sites), dtype=np.uint64)
        assert offtargets.mismatch_counts(index, spacer) == [1, 1, 1, 1]

    def test_mismatch_counting_ignores_base_identity(self):
        """A to C and A to T are both one mismatch, even though they differ in two bits."""
        index = np.array([offtargets.encode("C" + "A" * 19), offtargets.encode("T" + "A" * 19)], dtype=np.uint64)
        assert offtargets.mismatch_counts(index, "A" * 20)[1] == 2

    def test_specificity_rewards_a_unique_guide(self):
        assert offtargets.specificity([1, 0, 0, 0]) == 100
        # A guide reaching into a UTR is absent from the coding index, so nothing is free.
        assert offtargets.specificity([0, 0, 0, 0], in_cds=False) == 100
        assert offtargets.specificity([1, 0, 0, 0], in_cds=False) == 60
        assert offtargets.specificity([1, 0, 0, 5]) == 95
        assert offtargets.specificity([2, 0, 0, 0]) == 60  # a second perfect match is disqualifying
        assert offtargets.specificity([1, 4, 9, 40]) == 0


def test_pam_sites_need_room_for_a_spacer():
    seq = "A" * 20 + "AGG" + "A" * 20 + "CCT" + "A" * 20
    sites = pam_sites(seq)
    assert {"pos": 20, "strand": "+"} in sites
    assert {"pos": 43, "strand": "-"} in sites
    # A PAM in the first 20 bases has no room for a protospacer in front of it.
    assert all(not (s["strand"] == "+" and s["pos"] < 20) for s in sites)


class TestAnalyses:
    """The committed analyses are the pipeline's output; check they stayed coherent."""

    @pytest.fixture(scope="class")
    @staticmethod
    def genes():
        files = sorted((ROOT / "data" / "genes").glob("*.json"))
        if not files:
            pytest.skip("no analyses yet; run `python -m pipeline.analyze`")
        return [json.loads(f.read_text(encoding="utf-8")) for f in files]

    def test_coding_lengths_are_whole_codons(self, genes):
        for g in genes:
            assert g["cdsLength"] % 3 == 0, g["symbol"]
            assert g["cdsLength"] == sum(e["codingLength"] for e in g["exons"]), g["symbol"]

    def test_proteins_start_with_methionine(self, genes):
        for g in genes:
            assert g["proteinStart"].startswith("M"), g["symbol"]

    def test_guides_are_well_formed(self, genes):
        for g in genes:
            for guide in g["guides"]:
                assert len(guide["spacer"]) == 20 and set(guide["spacer"]) <= set("ACGT"), g["symbol"]
                assert guide["pam"][1:] == "GG", f"{g['symbol']}: PAM {guide['pam']} is not NGG"
                assert 0 <= guide["cut"] < g["cdsLength"], g["symbol"]
                if guide["in_cds"]:
                    assert guide["offTargets"][0] >= 1, f"{g['symbol']}: a coding guide should match its own gene"

    def test_game_windows_match_their_pam_lists(self, genes):
        for g in genes:
            for w in g["windows"]:
                assert pam_sites(w["seq"]) == w["pams"], g["symbol"]
