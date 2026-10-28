"""Exome-wide off-target counts for SpCas9 guides.

Indexes every 20-mer followed by an NGG PAM, on both strands, in all human
protein-coding sequences (Ensembl's cds.all.fa). Each 20-mer is packed into a
40-bit integer (2 bits per base), so comparing a guide with millions of sites
is one vectorized XOR plus a bit count.

Limits, stated in the dashboard too: this covers coding sequence only, not the
whole genome (intergenic and intronic sites are not checked); identical sites
shared by several transcripts of a gene count once; and spliced CDS creates a
few artificial sites across exon junctions.
"""

import gzip
import re
from pathlib import Path

import numpy as np
import requests

CDS_URL = "https://ftp.ensembl.org/pub/current_fasta/homo_sapiens/cds/Homo_sapiens.GRCh38.cds.all.fa.gz"
CACHE = Path(__file__).resolve().parent / "cache"
CODE = {"A": 0, "C": 1, "G": 2, "T": 3}
EVEN_BITS = int("01" * 20, 2)  # one bit per base after folding each 2-bit pair
MAX_MISMATCHES = 3


def encode(kmer: str) -> int:
    v = 0
    for ch in kmer:
        v = (v << 2) | CODE[ch]
    return v


def _revcomp(seq: str) -> str:
    return seq.translate(str.maketrans("ACGT", "TGCA"))[::-1]


def _sites(seq: str):
    """20-mers followed by NGG in seq."""
    for m in re.finditer(r"(?=([ACGT]{20})[ACGT]GG)", seq):
        yield m.group(1)


def download_cds(force: bool = False) -> Path:
    path = CACHE / "cds.all.fa.gz"
    if path.exists() and not force:
        return path
    CACHE.mkdir(parents=True, exist_ok=True)
    with requests.get(CDS_URL, stream=True, timeout=300) as resp:
        resp.raise_for_status()
        tmp = path.with_suffix(".part")
        with open(tmp, "wb") as fh:
            for chunk in resp.iter_content(1 << 20):
                fh.write(chunk)
        tmp.replace(path)
    return path


def build_index(fasta_gz: Path) -> np.ndarray:
    """Sorted unique 40-bit codes of every NGG-adjacent 20-mer on both strands."""
    cache = CACHE / "exome-sites.npy"
    if cache.exists() and cache.stat().st_mtime >= fasta_gz.stat().st_mtime:
        return np.load(cache)
    codes: set[int] = set()
    seq: list[str] = []

    def flush():
        s = "".join(seq).upper()
        for strand in (s, _revcomp(s)):
            codes.update(encode(k) for k in _sites(strand))

    with gzip.open(fasta_gz, "rt") as fh:
        for line in fh:
            if line.startswith(">"):
                if seq:
                    flush()
                seq = []
            else:
                seq.append(line.strip())
        if seq:
            flush()
    arr = np.fromiter(codes, dtype=np.uint64, count=len(codes))
    arr.sort()
    np.save(cache, arr)
    return arr


def mismatch_counts(index: np.ndarray, spacer: str) -> list[int]:
    """How many indexed sites differ from the spacer by 0, 1, 2 and 3 bases."""
    x = np.bitwise_xor(index, np.uint64(encode(spacer)))
    folded = (x | (x >> np.uint64(1))) & np.uint64(EVEN_BITS)
    mm = np.bitwise_count(folded)
    return [int(np.count_nonzero(mm == k)) for k in range(MAX_MISMATCHES + 1)]


def specificity(counts: list[int], in_cds: bool = True) -> int:
    """0-100: 100 when the guide matches only itself; near matches cost more the closer they are.

    A guide inside coding sequence matches its own site, so the first perfect match is
    free. Guides that run into a UTR or intron are absent from this index, which is why
    the count can be zero."""
    own = 1 if in_cds else 0
    penalty = 40 * max(0, counts[0] - own) + 15 * counts[1] + 4 * counts[2] + 1 * counts[3]
    return max(0, 100 - penalty)
