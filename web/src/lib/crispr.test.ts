import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findGuides, pamSites, revcomp, scoreSpacer } from "./crispr";
import { codingSlice } from "./ensembl";

/**
 * The browser scores guides for genes fetched live, while Python scores the
 * analysed ones. If the two ever disagree, the same gene would get different
 * answers depending on how you reached it, so every published guide is
 * re-scored here and must come out identical.
 */
const GENES = join(import.meta.dirname, "../../../data/genes");

interface PublishedGuide {
  spacer: string;
  pam: string;
  strand: string;
  score: number;
  reasons: string[];
}

interface Published {
  symbol: string;
  guides: PublishedGuide[];
  windows: { seq: string; pams: { pos: number; strand: string }[] }[];
}

function published(): Published[] {
  let files: string[] = [];
  try {
    files = readdirSync(GENES).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  return files.map((f) => JSON.parse(readFileSync(join(GENES, f), "utf8")) as Published);
}

describe("revcomp", () => {
  it("reverses and complements", () => {
    expect(revcomp("ATGCCGT")).toBe("ACGGCAT");
  });
  it("round-trips", () => {
    expect(revcomp(revcomp("ACGTTGCA"))).toBe("ACGTTGCA");
  });
});

describe("scoreSpacer", () => {
  it("rewards a balanced guide", () => {
    const { score, reasons } = scoreSpacer("GCGATCGATCGATCGATAGC");
    expect(score).toBe(90);
    expect(reasons).toHaveLength(3);
  });

  it("punishes the poly-T terminator hardest", () => {
    expect(scoreSpacer("GCGATCGATGTTTCGATAGC").score - scoreSpacer("GCGATCGATTTTTCGATAGC").score).toBeGreaterThanOrEqual(40);
  });

  it("stays within 0 and 100", () => {
    for (const s of ["TTTTTTTTTTTTTTTTTTTT", "GCGCGCGCGCGCGCGCGCGC", "AAAAAAAAAAAAAAAAAAAA"]) {
      const { score } = scoreSpacer(s);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("findGuides", () => {
  const exon = (seq: string, cdsStart = 0, cdsEnd = seq.length, cdsOffset = 0) => [{ number: 1, seq, cdsStart, cdsEnd, cdsOffset }];

  it("finds a sense guide and its cut position", () => {
    const spacer = "ACGTACGTACGTACGTACGT";
    const [g] = findGuides(exon(spacer + "AGG" + "TTTTT")).filter((x) => x.strand === "+");
    expect([g.spacer, g.pam, g.cut]).toEqual([spacer, "AGG", 17]);
  });

  it("finds an antisense guide", () => {
    const spacer = "ACGTACGTACGTACGTACGT";
    const [g] = findGuides(exon("TTTTT" + "CCT" + revcomp(spacer))).filter((x) => x.strand === "-");
    expect([g.spacer, g.pam, g.cut]).toEqual([spacer, "AGG", 11]);
  });

  it("skips cuts outside the coding region", () => {
    const seq = "ACGTACGTACGTACGTACGT" + "AGG" + "TTTTT";
    expect(findGuides(exon(seq, 18, seq.length))).toHaveLength(0);
  });
});

describe("codingSlice", () => {
  it("matches the Python cases", () => {
    expect(codingSlice(100, 199, 1, 50, 300)).toEqual([0, 100]);
    expect(codingSlice(100, 199, 1, 120, 300)).toEqual([20, 100]);
    expect(codingSlice(100, 199, -1, 50, 180)).toEqual([19, 100]);
    expect(codingSlice(100, 199, 1, 500, 900)).toEqual([0, 0]);
    expect(codingSlice(100, 199, -1, 130, 170)).toEqual([29, 70]);
  });
});

describe("parity with the Python pipeline", () => {
  const genes = published();

  it("has analyses to compare against", () => {
    expect(genes.length, "run `python -m pipeline.analyze` first").toBeGreaterThan(0);
  });

  it("re-scores every published guide identically", () => {
    let checked = 0;
    for (const gene of genes) {
      for (const g of gene.guides) {
        const { score, reasons } = scoreSpacer(g.spacer);
        // The pipeline appends an off-target sentence the browser cannot know.
        expect(score, `${gene.symbol} ${g.spacer}`).toBe(g.score);
        expect(reasons, `${gene.symbol} ${g.spacer}`).toEqual(g.reasons.slice(0, reasons.length));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("finds the same PAM sites in every game window", () => {
    for (const gene of genes) {
      for (const w of gene.windows) {
        expect(pamSites(w.seq), gene.symbol).toEqual(w.pams);
      }
    }
  });
});
