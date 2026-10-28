/**
 * The same guide search and scoring as pipeline/guides.py, in TypeScript.
 *
 * The pipeline analyses a curated set of genes offline, including off-target
 * checks. This module lets the browser do the rest live for any gene fetched
 * from Ensembl, where off-targets cannot be checked. Both must agree, which a
 * test enforces against the published pipeline output.
 */

const BASE_SCORE = 60;

const COMPLEMENT: Record<string, string> = { A: "T", C: "G", G: "C", T: "A", N: "N" };

export function revcomp(seq: string): string {
  let out = "";
  for (let i = seq.length - 1; i >= 0; i--) out += COMPLEMENT[seq[i]] ?? "N";
  return out;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function longestRun(seq: string): number {
  let best = 1;
  let run = 1;
  for (let i = 1; i < seq.length; i++) {
    run = seq[i] === seq[i - 1] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Mirrors `score()` in pipeline/guides.py, including the wording of each reason. */
export function scoreSpacer(spacer: string): { score: number; reasons: string[] } {
  let points = BASE_SCORE;
  const reasons: string[] = [];
  const gc = [...spacer].filter((b) => b === "G" || b === "C").length / spacer.length;
  if (gc >= 0.4 && gc <= 0.7) {
    points += 15;
    reasons.push(`GC content ${pct(gc)} is in the 40-70% sweet spot (+15)`);
  } else {
    points -= 20;
    reasons.push(`GC content ${pct(gc)} is outside 40-70% (-20)`);
  }
  if (spacer.includes("TTTT")) {
    points -= 40;
    reasons.push("TTTT ends transcription from the U6 promoter early (-40)");
  }
  const longest = longestRun(spacer);
  if (longest >= 5) {
    points -= 15;
    reasons.push(`a run of ${longest} identical bases is hard to synthesize and pair (-15)`);
  }
  if ("GC".includes(spacer[spacer.length - 1])) {
    points += 10;
    reasons.push("G or C right next to the PAM helps binding (+10)");
  }
  const seed = spacer.slice(-8);
  const seedGc = [...seed].filter((b) => b === "G" || b === "C").length / 8;
  if (seedGc > 0.75) {
    points -= 10;
    reasons.push(`the 8-base seed next to the PAM is ${pct(seedGc)} GC, which raises off-target binding (-10)`);
  }
  if (spacer.startsWith("G")) {
    points += 5;
    reasons.push("starts with G, the U6 promoter's preferred first base (+5)");
  }
  return { score: Math.max(0, Math.min(100, points)), reasons };
}

export interface LiveGuide {
  spacer: string;
  pam: string;
  strand: "+" | "-";
  cut: number;
  exon: number;
  in_cds: boolean;
  score: number;
  reasons: string[];
}

export interface ExonWindow {
  number: number;
  seq: string;
  cdsStart: number;
  cdsEnd: number;
  cdsOffset: number;
}

/** Mirrors `find_guides()` in pipeline/guides.py. */
export function findGuides(exons: ExonWindow[]): LiveGuide[] {
  const out: LiveGuide[] = [];
  for (const ex of exons) {
    const { seq, cdsStart: lo, cdsEnd: hi } = ex;
    for (let i = 0; i < seq.length - 22; i++) {
      if (seq.slice(i + 21, i + 23) === "GG") {
        const cut = i + 17;
        if (cut >= lo && cut < hi) {
          out.push(make(seq.slice(i, i + 20), seq.slice(i + 20, i + 23), "+", ex.cdsOffset + cut - lo, ex.number, lo <= i && i + 23 <= hi));
        }
      }
      if (seq.slice(i, i + 2) === "CC") {
        const cut = i + 6;
        if (cut >= lo && cut < hi) {
          out.push(
            make(revcomp(seq.slice(i + 3, i + 23)), revcomp(seq.slice(i, i + 3)), "-", ex.cdsOffset + cut - lo, ex.number, lo <= i && i + 23 <= hi),
          );
        }
      }
    }
  }
  return out.filter((g) => !g.spacer.includes("N"));
}

function make(spacer: string, pam: string, strand: "+" | "-", cut: number, exon: number, inCds: boolean): LiveGuide {
  const { score, reasons } = scoreSpacer(spacer);
  return { spacer, pam, strand, cut, exon, in_cds: inCds, score, reasons };
}

/** Every NGG and CCN site in a window, matching `pam_sites()` in pipeline/analyze.py. */
export function pamSites(seq: string): { pos: number; strand: "+" | "-" }[] {
  const out: { pos: number; strand: "+" | "-" }[] = [];
  for (let i = 0; i < seq.length - 2; i++) {
    if (seq.slice(i + 1, i + 3) === "GG" && i >= 20) out.push({ pos: i, strand: "+" });
    if (seq.slice(i, i + 2) === "CC" && i + 23 <= seq.length) out.push({ pos: i, strand: "-" });
  }
  return out;
}
