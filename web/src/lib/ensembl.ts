/**
 * Live gene lookup from the browser (rest.ensembl.org sends CORS headers, so no
 * server of ours is involved). Mirrors pipeline/transcripts.py: it picks the
 * canonical transcript, fetches exon sequences on the transcript's strand, and
 * works out which slice of each exon is coding.
 */

import type { ExonWindow } from "./crispr";

const BASE = "https://rest.ensembl.org";

interface EnsemblExon {
  id: string;
  start: number;
  end: number;
}

interface EnsemblTranscript {
  id: string;
  strand: number;
  is_canonical?: number;
  start: number;
  end: number;
  Exon: EnsemblExon[];
  Translation?: { start: number; end: number };
}

interface LiveGene {
  symbol: string;
  geneId: string;
  transcriptId: string;
  chromosome: string;
  strand: number;
  exons: ExonWindow[];
  cdsLength: number;
}

async function get(path: string, init?: RequestInit): Promise<unknown> {
  const resp = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (resp.status === 400 || resp.status === 404) throw new Error("No such human gene in Ensembl. Check the symbol, for example SOD1.");
  if (!resp.ok) throw new Error(`Ensembl answered ${resp.status}. It is sometimes slow; try again.`);
  return resp.json();
}

/** The coding slice of one exon, as in `_coding_slice` in pipeline/transcripts.py. */
export function codingSlice(exonStart: number, exonEnd: number, strand: number, cdsLo: number, cdsHi: number): [number, number] {
  const lo = Math.max(exonStart, cdsLo);
  const hi = Math.min(exonEnd, cdsHi);
  if (lo > hi) return [0, 0];
  if (strand === 1) return [lo - exonStart, hi - exonStart + 1];
  return [exonEnd - hi, exonEnd - lo + 1];
}

export async function fetchGene(symbol: string): Promise<LiveGene> {
  const gene = (await get(`/lookup/symbol/homo_sapiens/${encodeURIComponent(symbol.trim())}?expand=1`)) as {
    id: string;
    display_name: string;
    seq_region_name: string;
    Transcript: EnsemblTranscript[];
  };
  const transcripts = gene.Transcript ?? [];
  const t =
    transcripts.find((x) => x.is_canonical) ??
    transcripts.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a), transcripts[0]);
  if (!t?.Translation) throw new Error(`${gene.display_name} has no protein-coding canonical transcript, so there is nothing to knock out.`);

  const ordered = [...t.Exon].sort((a, b) => (t.strand === -1 ? b.start - a.start : a.start - b.start));
  const seqs = (await get("/sequence/id", {
    method: "POST",
    body: JSON.stringify({ ids: ordered.map((e) => e.id), type: "genomic" }),
  })) as { id: string; seq: string }[];
  const byId = new Map(seqs.map((s) => [s.id, s.seq.toUpperCase()]));

  const exons: ExonWindow[] = [];
  let offset = 0;
  ordered.forEach((e, i) => {
    const [cdsStart, cdsEnd] = codingSlice(e.start, e.end, t.strand, t.Translation!.start, t.Translation!.end);
    exons.push({ number: i + 1, seq: byId.get(e.id) ?? "", cdsStart, cdsEnd, cdsOffset: offset });
    offset += cdsEnd - cdsStart;
  });
  return {
    symbol: gene.display_name,
    geneId: gene.id,
    transcriptId: t.id,
    chromosome: gene.seq_region_name,
    strand: t.strand,
    exons,
    cdsLength: offset,
  };
}
