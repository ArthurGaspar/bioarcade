/** Types and loaders for the JSON that pipeline/build.py publishes. */

export interface Guide {
  spacer: string;
  pam: string;
  strand: "+" | "-";
  cut: number;
  exon: number;
  in_cds: boolean;
  score: number;
  reasons: string[];
  offTargets: [number, number, number, number];
  specificity: number;
}

export interface Exon {
  number: number;
  length: number;
  codingLength: number;
  cdsOffset: number;
}

interface PamSite {
  pos: number;
  strand: "+" | "-";
}

export interface GeneDetail {
  symbol: string;
  geneId: string;
  transcriptId: string;
  chromosome: string;
  strand: number;
  cdsLength: number;
  proteinLength: number;
  proteinStart: string;
  exons: Exon[];
  guidesFound: number;
  guides: Guide[];
  windows: { exon: number; start: number; seq: string; pams: PamSite[] }[];
  analyzedAt: string;
}

export interface GeneSummary {
  symbol: string;
  title: string;
  story: string;
  chromosome: string;
  strand: number;
  exons: number;
  cdsLength: number;
  proteinLength: number;
  guidesFound: number;
  cleanGuides: number;
}

export interface Round {
  gene: string;
  chromosome: string;
  exon: number;
  seq: string;
  pams: PamSite[];
  seconds: number;
}

export interface DuelRound {
  gene: string;
  chromosome: string;
  exon: number;
  lesson: "sequence" | "specificity";
  guides: [Guide, Guide];
  winner: 0 | 1;
}

export type Verdict = "pathogenic" | "benign" | "uncertain";

export interface CodonRound {
  gene: string;
  transcriptId: string;
  chromosome: string;
  exon: number;
  cdsStart: number;
  seq: string;
  protein: string;
  quizCodons: number;
  seconds: number;
}

export interface VerdictRound {
  id: string;
  gene: string;
  transcript: string;
  dna: string;
  protein: string;
  context: string;
  classification: string;
  verdict: Verdict;
  accession: string;
  scope: string;
  reviewStatus: string;
  sourceUrl: string;
  clues: { title: string; text: string }[];
  explanation: string;
}

export interface VerdictSnapshot {
  reviewedAt: string;
  rounds: VerdictRound[];
}

interface Rule {
  id: string;
  points: number;
  what: string;
  why: string;
}

export interface Meta {
  builtAt: string;
  source: { genes: string; exome: string };
  counts: { genes: number; guidesFound: number; guidesChecked: number; exomeSites: number };
  method: {
    pam: string;
    spacer: number;
    cutOffsetFromPam: number;
    checkedPerGene: number;
    maxMismatches: number;
    windowNt: number;
    cleanScore: number;
    cleanSpecificity: number;
    baseScore: number;
    scoreRules: Rule[];
  };
}

const cache = new Map<string, Promise<unknown>>();

export function load<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    const url = `${import.meta.env.BASE_URL}data/${name}`;
    cache.set(
      name,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url} answered ${r.status}. Run \`python -m pipeline.build\` first.`);
        return r.json();
      }),
    );
  }
  return cache.get(name) as Promise<T>;
}
