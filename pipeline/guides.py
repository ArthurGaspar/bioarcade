"""SpCas9 guide RNA candidates and a transparent, rule-based score.

A guide is 20 nucleotides followed by an NGG PAM on either strand; Cas9 cuts
3 bp upstream of the PAM. Only guides whose cut site falls inside the coding
part of an exon are kept, since those are the ones that can knock a gene out.

The score is not a trained efficiency model. It adds and removes points for
widely used design guidelines, each listed in `reasons` so the result can be
read and argued with.
"""

from dataclasses import dataclass, field

COMPLEMENT = str.maketrans("ACGTN", "TGCAN")


def revcomp(seq: str) -> str:
    return seq.translate(COMPLEMENT)[::-1]


@dataclass
class Guide:
    spacer: str  # 20 nt, 5'->3'
    pam: str  # NGG
    strand: str  # "+" if the spacer reads like the transcript, "-" otherwise
    cut: int  # position of the cut in the coding sequence (0-based)
    exon: int  # 1-based exon number in the transcript
    in_cds: bool = True  # whether the whole protospacer+PAM lies inside the coding sequence
    score: int = 0
    reasons: list[str] = field(default_factory=list)


# Every adjustment the scorer can make, in one place: the dashboard shows this table
# and a test checks that each rule can fire.
RULES = [
    {"id": "gc_ok", "points": 15, "what": "GC content between 40% and 70%", "why": "too little GC binds weakly, too much binds everywhere"},
    {"id": "gc_bad", "points": -20, "what": "GC content outside 40-70%", "why": "efficiency drops at both extremes"},
    {"id": "polyt", "points": -40, "what": "contains TTTT", "why": "four Ts in a row stop transcription from the U6 promoter"},
    {"id": "homopolymer", "points": -15, "what": "five or more identical bases in a row", "why": "harder to synthesize and prone to slipping"},
    {"id": "gc_at_pam", "points": 10, "what": "G or C in the base next to the PAM", "why": "this position contributes most to binding"},
    {"id": "seed_gc", "points": -10, "what": "the 8-base seed next to the PAM is over 75% GC", "why": "a sticky seed tolerates mismatches elsewhere, so off-targets rise"},
    {"id": "starts_g", "points": 5, "what": "starts with G", "why": "the U6 promoter prefers to start on G"},
]

BASE_SCORE = 60


def score(spacer: str) -> tuple[int, list[str]]:
    """0-100 from simple, documented rules; every adjustment is explained."""
    points = BASE_SCORE
    reasons = []
    gc = (spacer.count("G") + spacer.count("C")) / len(spacer)
    if 0.4 <= gc <= 0.7:
        points += 15
        reasons.append(f"GC content {gc:.0%} is in the 40-70% sweet spot (+15)")
    else:
        points -= 20
        reasons.append(f"GC content {gc:.0%} is outside 40-70% (-20)")
    if "TTTT" in spacer:
        points -= 40
        reasons.append("TTTT ends transcription from the U6 promoter early (-40)")
    longest = max(len(run) for run in _runs(spacer))
    if longest >= 5:
        points -= 15
        reasons.append(f"a run of {longest} identical bases is hard to synthesize and pair (-15)")
    if spacer[-1] in "GC":
        points += 10
        reasons.append("G or C right next to the PAM helps binding (+10)")
    seed_gc = (spacer[-8:].count("G") + spacer[-8:].count("C")) / 8
    if seed_gc > 0.75:
        points -= 10
        reasons.append(f"the 8-base seed next to the PAM is {seed_gc:.0%} GC, which raises off-target binding (-10)")
    if spacer.startswith("G"):
        points += 5
        reasons.append("starts with G, the U6 promoter's preferred first base (+5)")
    return max(0, min(100, points)), reasons


def _runs(seq: str):
    start = 0
    for i in range(1, len(seq) + 1):
        if i == len(seq) or seq[i] != seq[start]:
            yield seq[start:i]
            start = i


def find_guides(exons: list[dict]) -> list[Guide]:
    """exons: [{"number", "seq" (genomic, transcript strand), "cds_start", "cds_end" (exon-local,
    half-open), "cds_offset" (CDS position of cds_start)}]. Returns guides cutting inside the CDS."""
    out: list[Guide] = []
    for ex in exons:
        seq = ex["seq"]
        lo, hi = ex["cds_start"], ex["cds_end"]
        for i in range(len(seq) - 22):
            # Sense strand: spacer seq[i:i+20], PAM seq[i+20:i+23], cut between i+16 and i+17.
            if seq[i + 21 : i + 23] == "GG":
                cut = i + 17
                if lo <= cut < hi:
                    out.append(
                        Guide(seq[i : i + 20], seq[i + 20 : i + 23], "+", ex["cds_offset"] + cut - lo, ex["number"], lo <= i and i + 23 <= hi)
                    )
            # Antisense strand: PAM CCN at seq[i:i+3], spacer is revcomp(seq[i+3:i+23]), cut between i+5 and i+6.
            if seq[i : i + 2] == "CC":
                cut = i + 6
                if lo <= cut < hi:
                    out.append(
                        Guide(revcomp(seq[i + 3 : i + 23]), revcomp(seq[i : i + 3]), "-", ex["cds_offset"] + cut - lo, ex["number"], lo <= i and i + 23 <= hi)
                    )
    for g in out:
        g.score, g.reasons = score(g.spacer)
    return [g for g in out if "N" not in g.spacer]
