import { useEffect, useState } from "react";
import { load, type GeneDetail, type GeneSummary, type Guide, type Meta } from "./data";
import { findGuides, type LiveGuide } from "./lib/crispr";
import { fetchGene } from "./lib/ensembl";
import { Empty, ExonMap, MismatchBars, ScoreBreakdown, Tile, fmt, useAsync } from "./ui";

type Row = Guide | (LiveGuide & { offTargets?: undefined; specificity?: undefined });

interface Live {
  symbol: string;
  chromosome: string;
  transcriptId: string;
  cdsLength: number;
  exons: { number: number; length: number; codingLength: number }[];
  guides: LiveGuide[];
}

export function Designer() {
  const { data, error } = useAsync(() => Promise.all([load<GeneSummary[]>("genes.json"), load<Meta>("meta.json")]), []);
  const [symbol, setSymbol] = useState("TP53");
  const [detail, setDetail] = useState<GeneDetail | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(0);

  useEffect(() => {
    if (!symbol) return;
    setLive(null);
    setProblem(null);
    setPicked(0);
    load<GeneDetail>(`genes/${symbol}.json`).then(setDetail, (e) => setProblem(String(e.message ?? e)));
  }, [symbol]);

  if (error) return <Empty title="No data yet">{error}</Empty>;
  if (!data) return <Empty title="Loading…" />;
  const [genes, meta] = data;

  async function lookUp(event: React.FormEvent) {
    event.preventDefault();
    const wanted = query.trim().toUpperCase();
    if (!wanted) return;
    const known = genes.find((g) => g.symbol === wanted);
    if (known) {
      setSymbol(known.symbol);
      setQuery("");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const gene = await fetchGene(wanted);
      const guides = findGuides(gene.exons).sort((a, b) => b.score - a.score || a.cut - b.cut);
      setDetail(null);
      setSymbol("");
      setPicked(0);
      setLive({
        symbol: gene.symbol,
        chromosome: gene.chromosome,
        transcriptId: gene.transcriptId,
        cdsLength: gene.cdsLength,
        exons: gene.exons.map((e) => ({ number: e.number, length: e.seq.length, codingLength: e.cdsEnd - e.cdsStart })),
        guides,
      });
    } catch (e) {
      setProblem(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const shown = live
    ? { symbol: live.symbol, chromosome: live.chromosome, transcriptId: live.transcriptId, cdsLength: live.cdsLength, exons: live.exons, guides: live.guides as Row[], guidesFound: live.guides.length, checked: false }
    : detail
      ? { symbol: detail.symbol, chromosome: detail.chromosome, transcriptId: detail.transcriptId, cdsLength: detail.cdsLength, exons: detail.exons, guides: detail.guides as Row[], guidesFound: detail.guidesFound, checked: true }
      : null;
  const summary = genes.find((g) => g.symbol === shown?.symbol);
  const guide = shown?.guides[picked];

  return (
    <>
      <section>
        <h1>Guide designer</h1>
        <p>
          Every 20-base stretch of coding sequence that sits in front of an <code>NGG</code> PAM is a candidate guide RNA. These
          are ranked by rules you can read, not by a black box: each line of the breakdown is one rule from{" "}
          <a href="#/method">the method</a>.
        </p>
      </section>

      <section className="panel">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="gene">Analysed genes ({genes.length})</label>
            <select
              id="gene"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setLive(null);
              }}
            >
              {!symbol && <option value="">{live ? `${live.symbol} (live)` : "choose"}</option>}
              {genes.map((g) => (
                <option key={g.symbol} value={g.symbol}>
                  {g.symbol} · {g.title}
                </option>
              ))}
            </select>
          </div>
          <form className="field" onSubmit={lookUp} style={{ minWidth: 240 }}>
            <label htmlFor="any">Or any human gene, fetched live</label>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input id="any" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="SOD1" autoComplete="off" spellCheck={false} />
              <button className="secondary" type="submit" disabled={busy}>
                {busy ? "Fetching…" : "Look up"}
              </button>
            </div>
            <span className="small">{busy ? "Ensembl can take 20 seconds or so." : "Any human symbol, for example SOD1 or MYC."}</span>
          </form>
        </div>
        {problem && (
          <p className="small" style={{ color: "var(--bad)", marginTop: 10, marginBottom: 0 }}>
            {problem}
          </p>
        )}
      </section>

      {!shown ? (
        <Empty title="Pick a gene" />
      ) : (
        <>
          {summary && (
            <section>
              <h3>
                {summary.symbol} · {summary.title}
              </h3>
              <p>{summary.story}</p>
            </section>
          )}

          <div className="tiles">
            <Tile value={`chr ${shown.chromosome}`} label="Chromosome" sub={shown.transcriptId} />
            <Tile value={fmt.kb(shown.cdsLength)} label="Coding sequence" sub={`${Math.round(shown.cdsLength / 3) - 1} amino acids`} />
            <Tile value={fmt.int(shown.guidesFound)} label="Cut sites in the coding region" sub={shown.checked ? `top ${shown.guides.length} checked for off-targets` : "scored live in your browser"} />
            {shown.checked ? (
              <Tile
                value={shown.guides.filter((g) => g.score >= meta.method.cleanScore && (g.specificity ?? 0) >= meta.method.cleanSpecificity).length}
                label="Clean guides"
                sub={`score ${meta.method.cleanScore}+ and specificity ${meta.method.cleanSpecificity}+`}
              />
            ) : (
              <Tile value={shown.exons.length} label="Exons" />
            )}
          </div>

          <section className="panel">
            <h2>Where the guides land</h2>
            <ExonMap exons={shown.exons} cuts={shown.guides.map((g) => ({ exon: g.exon }))} />
            <p className="small" style={{ marginTop: 8 }}>
              A knockout usually targets an early coding exon, so a frameshift wrecks the protein from near the start.
            </p>
          </section>

          {!shown.checked && (
            <div className="callout warn">
              <b>Off-targets not checked.</b> This gene was fetched live, so only the sequence rules were applied. The{" "}
              {genes.length} analysed genes also carry a search against all {fmt.int(meta.counts.exomeSites)} coding sites in the
              human exome.
            </div>
          )}

          <div className="grid-2">
            <section className="panel">
              <h2>Ranked guides</h2>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Spacer (5′→3′)</th>
                      <th>PAM</th>
                      <th className="num">Exon</th>
                      <th className="num">Score</th>
                      {shown.checked && <th className="num">Specificity</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.guides.slice(0, 25).map((g, i) => (
                      <tr key={`${g.spacer}${g.cut}`} className="clickable" onClick={() => setPicked(i)} aria-current={i === picked ? "true" : undefined}>
                        <td>{i + 1}</td>
                        <td className="mono" style={{ fontWeight: i === picked ? 700 : 400 }}>
                          {g.spacer}
                        </td>
                        <td className="mono">{g.pam}</td>
                        <td className="num">{g.exon}</td>
                        <td className="num">{g.score}</td>
                        {shown.checked && <td className="num">{(g as Guide).specificity}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {guide && (
              <section className="panel">
                <h2>Guide {picked + 1} in detail</h2>
                <p className="mono" style={{ fontSize: 15, wordBreak: "break-all" }}>
                  {guide.spacer}
                  <span style={{ color: "var(--c-2)", fontWeight: 700 }}>{guide.pam}</span>
                </p>
                <p className="small">
                  {guide.strand === "+" ? "Same strand as the transcript" : "Opposite strand"}, cuts at coding base {fmt.int(guide.cut)}{" "}
                  of {fmt.int(shown.cdsLength)} (about {Math.round((guide.cut / shown.cdsLength) * 100)}% through the protein)
                  {guide.in_cds ? "" : ", and reaches past the coding region into a UTR or intron"}.
                </p>
                <h3 style={{ marginTop: 14 }}>Score: {guide.score}/100</h3>
                <ScoreBreakdown base={meta.method.baseScore} reasons={guide.reasons} />
                {"offTargets" in guide && guide.offTargets && (
                  <>
                    <h3 style={{ marginTop: 14 }}>Specificity: {(guide as Guide).specificity}/100</h3>
                    <MismatchBars counts={guide.offTargets} />
                    <p className="small">
                      Searched against every protein-coding sequence in the genome. Sites that differ by only one or two bases are
                      the ones Cas9 is most likely to cut by mistake.
                    </p>
                  </>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </>
  );
}
