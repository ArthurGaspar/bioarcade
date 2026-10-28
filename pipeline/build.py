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
