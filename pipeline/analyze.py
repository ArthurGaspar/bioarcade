"""The slow half of the pipeline: fetch genes, find guides, check off-targets.

    python -m pipeline.analyze              # only genes without a result yet
    python -m pipeline.analyze --refresh    # all of them again

Needs the network and the exome index (a 35 MB download, then about four
minutes to index 5.9 million sites). Results go to data/genes/*.json, which is
committed, so the site build and CI never repeat this work.
"""

import argparse
import json
import random
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from . import catalog, guides, offtargets
from .transcripts import Transcript, build

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "genes"
# Off-target checks are the slow part, so they run on the best rule-scored guides.
CHECKED_PER_GENE = 40
# Windows of real sequence the arcade games are played on.
WINDOW_NT = 72
WINDOWS_PER_GENE = 3


def game_windows(t: Transcript, rng: random.Random) -> list[dict]:
    """Stretches of real coding sequence, preferring ones with a few PAM sites."""
    coding = [e for e in t.exons if e.coding_length >= WINDOW_NT + 24]
    if not coding:
        return []
    candidates = []
    for exon in coding:
        seq = exon.seq[exon.cds_start : exon.cds_end]
        for _ in range(12):
            start = rng.randrange(0, len(seq) - WINDOW_NT)
            window = seq[start : start + WINDOW_NT]
            if "N" in window:
                continue
            pams = pam_sites(window)
            candidates.append({"exon": exon.number, "start": start, "seq": window, "pams": pams})
    if not candidates:
        return []
    # Windows closest to four sites come first: enough to hunt for, few enough to finish.
    candidates.sort(key=lambda c: abs(len(c["pams"]) - 4))
    chosen: list[dict] = []
    for c in candidates:
        if len(chosen) == WINDOWS_PER_GENE:
            break
        if all(c["exon"] != other["exon"] for other in chosen) or len(coding) < WINDOWS_PER_GENE:
            chosen.append(c)
    return chosen


def pam_sites(seq: str) -> list[dict]:
    """Every NGG (sense) and CCN (antisense) site, by the position of the PAM's first base."""
    out = []
    for i in range(len(seq) - 2):
        if seq[i + 1 : i + 3] == "GG" and i >= 20:
            out.append({"pos": i, "strand": "+"})
        if seq[i : i + 2] == "CC" and i + 23 <= len(seq):
            out.append({"pos": i, "strand": "-"})
    return out


def analyze_gene(symbol: str, index, rng: random.Random) -> dict:
    t = build(symbol)
    protein = t.protein
    found = guides.find_guides(
        [
            {"number": e.number, "seq": e.seq, "cds_start": e.cds_start, "cds_end": e.cds_end, "cds_offset": e.cds_offset}
            for e in t.exons
        ]
    )
    found.sort(key=lambda g: (-g.score, g.cut))
    checked = found[:CHECKED_PER_GENE]
    for g in checked:
        counts = offtargets.mismatch_counts(index, g.spacer)
        g.reasons = g.reasons + [_offtarget_reason(counts, g.in_cds)]
        setattr(g, "off_targets", counts)
        setattr(g, "specificity", offtargets.specificity(counts, g.in_cds))

    return {
        "symbol": t.gene,
        "geneId": t.gene_id,
        "transcriptId": t.transcript_id,
        "chromosome": t.chromosome,
        "strand": t.strand,
        "cdsLength": len(t.cds),
        "proteinLength": len(protein) - 1,
        "proteinStart": protein[:30],
        "exons": [{"number": e.number, "length": len(e.seq), "codingLength": e.coding_length, "cdsOffset": e.cds_offset} for e in t.exons],
        "guidesFound": len(found),
        "guides": [
            {
                **{k: v for k, v in asdict(g).items() if k != "reasons"},
                "reasons": g.reasons,
                "offTargets": g.off_targets,
                "specificity": g.specificity,
            }
            for g in checked
        ],
        "windows": game_windows(t, rng),
    }


def _offtarget_reason(counts: list[int], in_cds: bool) -> str:
    near = counts[1] + counts[2]
    extra = counts[0] - (1 if in_cds else 0)
    if extra > 0:
        return f"matches {extra} other coding site(s) perfectly, which is disqualifying"
    if near == 0:
        return f"no coding site within 2 mismatches ({counts[3]} at 3), so it is specific"
    return f"{counts[1]} coding site(s) at 1 mismatch and {counts[2]} at 2, which can be cut by mistake"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--refresh", action="store_true", help="re-analyze genes that already have a result")
    parser.add_argument("--only", nargs="*", help="limit to these symbols")
    args = parser.parse_args()

    symbols = args.only or catalog.SYMBOLS
    todo = [s for s in symbols if args.refresh or not (OUT / f"{s}.json").exists()]
    if not todo:
        print("Every gene already has a result; pass --refresh to redo them.")
        return

    print("indexing the exome for off-target checks (cached after the first run)")
    index = offtargets.build_index(offtargets.download_cds())
    print(f"  {len(index):,} sites")
    OUT.mkdir(parents=True, exist_ok=True)
    for symbol in todo:
        rng = random.Random(symbol)
        data = analyze_gene(symbol, index, rng)
        data["analyzedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        (OUT / f"{symbol}.json").write_text(json.dumps(data, indent=1), encoding="utf-8")
        best = data["guides"][0] if data["guides"] else None
        print(
            f"  {symbol:6s} {data['proteinLength']:5d} aa  {data['guidesFound']:4d} guides"
            + (f"  best {best['spacer']} score {best['score']} specificity {best['specificity']}" if best else "")
        )


if __name__ == "__main__":
    main()
