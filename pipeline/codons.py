"""Reading-frame-aligned game excerpts from committed Ensembl coding windows."""
from .transcripts import translate

RUNNER_GENES = ("HBB", "CFTR", "TP53", "BRCA1", "DMD", "INS")
RUNNER_NT = 60
QUIZ_CODONS = 8


def codon_runner_rounds(genes: list[dict]) -> list[dict]:
    rounds = []
    by_symbol = {g["symbol"]: g for g in genes}
    for symbol in RUNNER_GENES:
        gene = by_symbol.get(symbol)
        if gene is None:
            continue
        exons = {e["number"]: e for e in gene["exons"]}
        for window in gene["windows"]:
            # Window starts are relative to the coding portion of this exon.
            # Transcript-strand sequence is already oriented 5′→3′, even for
            # minus-strand genes. Align to CDS, not to the exon or window start.
            offset = exons[window["exon"]]["cdsOffset"] + window["start"]
            trim = (-offset) % 3
            seq = window["seq"][trim:trim + RUNNER_NT]
            if len(seq) != RUNNER_NT or set(seq) - set("ACGT"):
                continue
            protein = translate(seq)
            if "*" in protein[:-1]:
                continue
            rounds.append({
                "gene": symbol, "transcriptId": gene["transcriptId"],
                "chromosome": gene["chromosome"], "exon": window["exon"],
                "cdsStart": offset + trim, "seq": seq, "protein": protein,
                "quizCodons": QUIZ_CODONS, "seconds": 60 - 5 * len(rounds),
            })
            break
    return rounds
