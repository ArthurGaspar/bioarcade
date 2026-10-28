"""Turns an Ensembl gene record into exons with coding-region coordinates.

Ensembl reports exons in genomic coordinates, but a transcript on the minus
strand reads right to left. `exon_sequences` returns each exon already on the
transcript's strand, and this module marks which slice of each exon is coding
and where that slice sits in the assembled coding sequence (CDS).

`translate` exists to check the result: a correctly assembled CDS starts with
methionine and ends with a stop codon.
"""

from dataclasses import dataclass

from . import ensembl

CODONS = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L", "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M", "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S", "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T", "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "TAT": "Y", "TAC": "Y", "TAA": "*", "TAG": "*", "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K", "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "TGT": "C", "TGC": "C", "TGA": "*", "TGG": "W", "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R", "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}


def translate(cds: str) -> str:
    return "".join(CODONS.get(cds[i : i + 3], "X") for i in range(0, len(cds) - 2, 3))


@dataclass
class Exon:
    number: int  # 1-based, in transcript order
    id: str
    seq: str  # genomic sequence on the transcript's strand
    cds_start: int  # exon-local, half-open; equals cds_end when the exon is non-coding
    cds_end: int
    cds_offset: int  # CDS coordinate of cds_start

    @property
    def coding_length(self) -> int:
        return self.cds_end - self.cds_start


@dataclass
class Transcript:
    gene: str
    gene_id: str
    transcript_id: str
    chromosome: str
    strand: int
    exons: list[Exon]

    @property
    def cds(self) -> str:
        return "".join(e.seq[e.cds_start : e.cds_end] for e in self.exons)

    @property
    def protein(self) -> str:
        return translate(self.cds)


def _coding_slice(exon_start: int, exon_end: int, strand: int, cds_lo: int, cds_hi: int) -> tuple[int, int]:
    """The coding part of one exon, as a half-open slice of its transcript-strand sequence."""
    lo, hi = max(exon_start, cds_lo), min(exon_end, cds_hi)
    if lo > hi:
        return 0, 0
    if strand == 1:
        return lo - exon_start, hi - exon_start + 1
    return exon_end - hi, exon_end - lo + 1


def build(symbol: str) -> Transcript:
    g = ensembl.gene(symbol)
    t = ensembl.canonical_transcript(g)
    translation = t.get("Translation")
    if not translation:
        raise ValueError(f"{symbol}: the canonical transcript does not code for a protein")
    cds_lo, cds_hi = translation["start"], translation["end"]
    strand = t["strand"]
    # Ensembl does list exons in transcript order, but sort anyway so the order is
    # guaranteed rather than assumed: minus-strand genes run from the highest coordinate down.
    exons_raw = sorted(t["Exon"], key=lambda e: e["start"], reverse=strand == -1)
    seqs = ensembl.sequences([e["id"] for e in exons_raw])

    exons: list[Exon] = []
    offset = 0
    for i, e in enumerate(exons_raw, start=1):
        start, end = _coding_slice(e["start"], e["end"], strand, cds_lo, cds_hi)
        exons.append(Exon(number=i, id=e["id"], seq=seqs[e["id"]], cds_start=start, cds_end=end, cds_offset=offset))
        offset += end - start
    return Transcript(
        gene=g["display_name"],
        gene_id=g["id"],
        transcript_id=t["id"],
        chromosome=g["seq_region_name"],
        strand=strand,
        exons=exons,
    )
