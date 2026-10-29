/** Standard nuclear code (NCBI table 1), in T,C,A,G order for all three bases. */
const bases = "TCAG";
const residues = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
export const CODONS: Record<string, string> = {};
for (let i = 0; i < 64; i++) {
  CODONS[bases[Math.floor(i / 16)] + bases[Math.floor(i / 4) % 4] + bases[i % 4]] = residues[i];
}

export const AMINO_ACIDS: Record<string, string> = {
  A: "Alanine", R: "Arginine", N: "Asparagine", D: "Aspartate", C: "Cysteine",
  E: "Glutamate", Q: "Glutamine", G: "Glycine", H: "Histidine", I: "Isoleucine",
  L: "Leucine", K: "Lysine", M: "Methionine", F: "Phenylalanine", P: "Proline",
  S: "Serine", T: "Threonine", W: "Tryptophan", Y: "Tyrosine", V: "Valine", "*": "Stop",
};

export function decodeCodon(codon: string): string | null {
  return CODONS[codon.toUpperCase().replaceAll("U", "T")] ?? null;
}

export function readFrame(seq: string) {
  let stopped = false;
  const codons: { dna: string; amino: string; afterStop: boolean }[] = [];
  for (let i = 0; i + 2 < seq.length; i += 3) {
    const dna = seq.slice(i, i + 3);
    const amino = decodeCodon(dna) ?? "X";
    codons.push({ dna, amino, afterStop: stopped });
    if (amino === "*") stopped = true;
  }
  return {
    codons,
    protein: codons.filter((c) => !c.afterStop && c.amino !== "*").map((c) => c.amino).join(""),
    stop: codons.findIndex((c) => c.amino === "*"),
    trailing: seq.slice(codons.length * 3),
  };
}

/** Always delete from the original, so exploring another position never stacks edits. */
export function deleteBase(seq: string, position: number): string {
  if (!Number.isInteger(position) || position < 0 || position >= seq.length) return seq;
  return seq.slice(0, position) + seq.slice(position + 1);
}

/** Stable, varied options: rerenders and timer ticks never move the answer. */
export function codonOptions(codon: string, position: number): string[] {
  const correct = decodeCodon(codon);
  if (!correct) return [];
  const seed = [...codon].reduce((n, b) => n + b.charCodeAt(0), position);
  const pool = Object.keys(AMINO_ACIDS).filter((a) => a !== correct);
  const options = [pool[seed % pool.length], pool[(seed + 7) % pool.length], pool[(seed + 13) % pool.length]];
  options.splice(seed % 4, 0, correct);
  return options;
}
