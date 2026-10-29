"""Game answers must be justified by the published guides, never by a trade-off."""
from pipeline.build import ROUNDS, guide_duel_rounds, load_all


def test_duels_use_real_same_exon_guides_with_unambiguous_answers():
    genes = load_all()
    rounds = guide_duel_rounds(genes)
    assert len(rounds) == ROUNDS
    assert rounds == guide_duel_rounds(list(reversed(genes)))
    assert len({r["gene"] for r in rounds}) == ROUNDS
    assert {r["winner"] for r in rounds} == {0, 1}
    assert sum(r["lesson"] == "specificity" for r in rounds) == ROUNDS // 2
    sources = {g["symbol"]: g for g in genes}
    seen = set()
    for r in rounds:
        a, b = r["guides"][r["winner"]], r["guides"][1 - r["winner"]]
        assert a["score"] >= b["score"] and a["specificity"] >= b["specificity"]
        assert (a["score"], a["specificity"]) != (b["score"], b["specificity"])
        if r["lesson"] == "specificity":
            assert a["score"] == b["score"]
        for guide in r["guides"]:
            assert guide in sources[r["gene"]]["guides"]
            assert guide["in_cds"] and guide["offTargets"][0] >= 1
            assert guide["exon"] == r["exon"]
            identity = (r["gene"], guide["spacer"])
            assert identity not in seen
            seen.add(identity)


def test_duels_reject_ties_tradeoffs_different_exons_and_unindexed_guides():
    def guide(spacer, score=80, specificity=100, exon=1, in_cds=True):
        return dict(spacer=spacer, score=score, specificity=specificity,
                    exon=exon, in_cds=in_cds, cut=10, strand="+")

    a = guide("A" * 20)
    for b in [
        guide("C" * 20),  # tied
        guide("C" * 20, score=90, specificity=90),  # trade-off
        guide("C" * 20, score=70, exon=2),
        guide("C" * 20, score=70, in_cds=False),
        guide("A" * 20, score=70),  # same spacer cannot be a duel
    ]:
        assert guide_duel_rounds([dict(symbol="TEST", chromosome="1", guides=[a, b])]) == []
    assert guide_duel_rounds([]) == []


def test_duels_allow_sequence_and_specificity_lessons_without_mutating_sources():
    guides = [
        dict(spacer="A" * 20, score=90, specificity=100, exon=1, in_cds=True, cut=10, strand="+"),
        dict(spacer="C" * 20, score=75, specificity=100, exon=1, in_cds=True, cut=20, strand="+"),
        dict(spacer="G" * 20, score=90, specificity=100, exon=2, in_cds=True, cut=30, strand="+"),
        dict(spacer="T" * 20, score=90, specificity=60, exon=2, in_cds=True, cut=40, strand="+"),
    ]
    gene = dict(symbol="TEST", chromosome="1", guides=guides)
    original = [g.copy() for g in guides]
    rounds = guide_duel_rounds([gene])
    assert [r["lesson"] for r in rounds] == ["sequence", "specificity"]
    assert gene["guides"] == original
