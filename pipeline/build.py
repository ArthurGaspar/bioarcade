"""The fast half of the pipeline: turn data/genes into the site's JSON.

    python -m pipeline.build

Offline and deterministic, so CI runs it on every deploy. It reads the
committed analyses and writes web/public/data.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from . import catalog, offtargets
from .analyze import CHECKED_PER_GENE, WINDOW_NT
from .guides import BASE_SCORE, RULES
from .variants import verdict_rounds
from .codons import codon_runner_rounds

ROOT = Path(__file__).resolve().parent.parent
GENES = ROOT / "data" / "genes"
OUT = ROOT / "web" / "public" / "data"
ROUNDS = 12  # PAM Hunter rounds per playthrough
# A guide worth starting an experiment from: good sequence rules and few look-alikes.
CLEAN_SCORE, CLEAN_SPECIFICITY = 75, 95


def load_all() -> list[dict]:
    files = sorted(GENES.glob("*.json"))
    if not files:
        raise SystemExit("No analyses in data/genes; run `python -m pipeline.analyze` first.")
    return [json.loads(f.read_text(encoding="utf-8")) for f in files]


def write(name: str, data) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


def pam_hunter_rounds(genes: list[dict]) -> list[dict]:
    """One round per window. Rounds get harder as you go: the time allowed drops by two
    seconds each round, down to a floor of twelve."""
    rounds = []
    for g in genes:
        for w in g["windows"]:
            rounds.append(
                {
                    "gene": g["symbol"],
                    "chromosome": g["chromosome"],
                    "exon": w["exon"],
                    "seq": w["seq"],
                    "pams": w["pams"],
                }
            )
    rounds.sort(key=lambda r: (-len(r["pams"]), r["gene"]))
    picked = rounds[:ROUNDS]
    for i, r in enumerate(picked):
        r["seconds"] = max(12, 30 - 2 * i)
    return picked


def guide_duel_rounds(genes: list[dict]) -> list[dict]:
    """Unambiguous same-exon pairs: the winner is no worse on either metric.

    Alternate sequence lessons with equal-score specificity lessons. Only fully
    coding guides qualify, since guides outside the exome index have misleading
    specificity. Prefer large differences, different genes and unused guides.
    """
    pools = {"sequence": [], "specificity": []}
    for gene in sorted(genes, key=lambda g: g["symbol"]):
        guides = sorted(gene["guides"], key=lambda g: (g["exon"], g["cut"], g["strand"]))
        for a in guides:
            for b in guides:
                if not (a["in_cds"] and b["in_cds"]) or a["exon"] != b["exon"] or a["spacer"] == b["spacer"]:
                    continue
                score_gap = a["score"] - b["score"]
                spec_gap = a["specificity"] - b["specificity"]
                if score_gap < 0 or spec_gap < 0 or score_gap + spec_gap == 0:
                    continue
                lesson = "sequence" if score_gap > 0 else "specificity"
                gap = score_gap if score_gap > 0 else spec_gap
                pools[lesson].append((gap, gene, a, b))

    picked, used_genes, used_guides = [], set(), set()
    for i in range(ROUNDS):
        lesson = "sequence" if i % 2 == 0 else "specificity"
        candidates = [
            pair for pair in pools[lesson]
            if all((pair[1]["symbol"], g["spacer"]) not in used_guides for g in pair[2:])
        ]
        if not candidates:
            continue
        candidates.sort(key=lambda p: (p[1]["symbol"] in used_genes, -p[0], p[1]["symbol"], p[2]["cut"], p[3]["cut"]))
        _, gene, winner, other = candidates[0]
        winner_index = len(picked) % 2
        picked.append({
            "gene": gene["symbol"], "chromosome": gene["chromosome"],
            "exon": winner["exon"], "lesson": lesson,
            "guides": [winner, other] if winner_index == 0 else [other, winner],
            "winner": winner_index,
        })
        used_genes.add(gene["symbol"])
        used_guides.update((gene["symbol"], g["spacer"]) for g in (winner, other))
    return picked


def main() -> None:
    genes = load_all()
    stories = catalog.BY_SYMBOL

    index = [
        {
            "symbol": g["symbol"],
            "title": stories.get(g["symbol"], {}).get("title", ""),
            "story": stories.get(g["symbol"], {}).get("story", ""),
            "chromosome": g["chromosome"],
            "strand": g["strand"],
            "exons": len(g["exons"]),
            "cdsLength": g["cdsLength"],
            "proteinLength": g["proteinLength"],
            "guidesFound": g["guidesFound"],
            "cleanGuides": sum(1 for x in g["guides"] if x["score"] >= CLEAN_SCORE and x["specificity"] >= CLEAN_SPECIFICITY),
        }
        for g in sorted(genes, key=lambda g: g["symbol"])
    ]
    write("genes.json", index)
    for g in genes:
        # Present the checked guides best-first. Selection for checking used the rule
        # score alone, since specificity is only known afterwards.
        g["guides"].sort(key=lambda x: (-x["score"], -x["specificity"], x["cut"]))
        write(f"genes/{g['symbol']}.json", g)
    write("pam-hunter.json", pam_hunter_rounds(genes))
    write("guide-duel.json", guide_duel_rounds(genes))
    write("variant-verdict.json", verdict_rounds())
    write("codon-runner.json", codon_runner_rounds(genes))

    write(
        "meta.json",
        {
            "builtAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": {
                "genes": "Ensembl REST (rest.ensembl.org), GRCh38 canonical transcripts",
                "exome": offtargets.CDS_URL,
            },
            "counts": {
                "genes": len(genes),
                "guidesFound": sum(g["guidesFound"] for g in genes),
                "guidesChecked": sum(len(g["guides"]) for g in genes),
                "exomeSites": 5_890_572,
            },
            "method": {
                "pam": "NGG, SpCas9",
                "spacer": 20,
                "cutOffsetFromPam": 3,
                "checkedPerGene": CHECKED_PER_GENE,
                "maxMismatches": offtargets.MAX_MISMATCHES,
                "windowNt": WINDOW_NT,
                "cleanScore": CLEAN_SCORE,
                "cleanSpecificity": CLEAN_SPECIFICITY,
                "baseScore": BASE_SCORE,
                "scoreRules": RULES,
            },
        },
    )


if __name__ == "__main__":
    main()
