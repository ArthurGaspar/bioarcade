import { useEffect, useRef, useState } from "react";
import {
  load,
  type GeneDetail,
  type GeneSummary,
  type Guide,
  type Meta,
} from "./data";
import { findGuides, type LiveGuide } from "./lib/crispr";
import { fetchGene } from "./lib/ensembl";
import {
  Empty,
  ExonMap,
  MismatchBars,
  ScoreBreakdown,
  Tile,
  fmt,
  useAsync,
} from "./ui";

type Row =
  Guide | (LiveGuide & { offTargets?: undefined; specificity?: undefined });

interface Live {
  symbol: string;
  chromosome: string;
  transcriptId: string;
  cdsLength: number;
  exons: { number: number; length: number; codingLength: number }[];
  guides: LiveGuide[];
}

export function Designer({ initialGene = "TP53" }: { initialGene?: string }) {
  const { data, error } = useAsync(
    () =>
      Promise.all([load<GeneSummary[]>("genes.json"), load<Meta>("meta.json")]),
    [],
  );
  const [symbol, setSymbol] = useState(
    /^[A-Z0-9-]{1,20}$/.test(initialGene) ? initialGene : "TP53",
  );
  const [detail, setDetail] = useState<GeneDetail | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(0);
  const [exon, setExon] = useState("all");
  const [cleanOnly, setCleanOnly] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const request = useRef(0);

  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  useEffect(() => {
    if (!symbol || !data) return;
    if (!data[0].some((gene) => gene.symbol === symbol)) {
      setSymbol("TP53");
      return;
    }
    const current = ++request.current;
    setDetail(null);
    setLive(null);
    setBusy(false);
    setProblem(null);
    setPicked(0);
    setExon("all");
    setCleanOnly(false);
    setCopyStatus("");
    load<GeneDetail>(`genes/${symbol}.json`).then(
      (gene) => {
        if (request.current === current) setDetail(gene);
      },
      (error) => {
        if (request.current === current)
          setProblem(String(error.message ?? error));
      },
    );
    return () => {
      request.current++;
    };
  }, [symbol, data]);

  if (error) return <Empty title="No data yet">{error}</Empty>;
  if (!data) return <Empty title="Loading…" />;
  const [genes, meta] = data;

  async function lookUp(event: React.FormEvent) {
    event.preventDefault();
    const wanted = query.trim().toUpperCase();
    if (!wanted) return;
    const known = genes.find((g) => g.symbol === wanted);
    if (known) {
      const current = ++request.current;
      setBusy(false);
      setLive(null);
      setProblem(null);
      if (known.symbol === symbol) {
        load<GeneDetail>(`genes/${known.symbol}.json`).then(
          (gene) => {
            if (request.current === current) setDetail(gene);
          },
          (error) => {
            if (request.current === current)
              setProblem(String(error.message ?? error));
          },
        );
      }
      setSymbol(known.symbol);
      location.hash = `#/designer?gene=${known.symbol}`;
      setQuery("");
      return;
    }
    const current = ++request.current;
    setBusy(true);
    setProblem(null);
    try {
      const gene = await fetchGene(wanted);
      if (request.current !== current) return;
      const guides = findGuides(gene.exons).sort(
        (a, b) => b.score - a.score || a.cut - b.cut,
      );
      setDetail(null);
      setSymbol("");
      setPicked(0);
      setExon("all");
      setCleanOnly(false);
      setCopyStatus("");
      setLive({
        symbol: gene.symbol,
        chromosome: gene.chromosome,
        transcriptId: gene.transcriptId,
        cdsLength: gene.cdsLength,
        exons: gene.exons.map((e) => ({
          number: e.number,
          length: e.seq.length,
          codingLength: e.cdsEnd - e.cdsStart,
        })),
        guides,
      });
    } catch (e) {
      if (request.current === current)
        setProblem(String((e as Error).message ?? e));
    } finally {
      if (request.current === current) setBusy(false);
    }
  }

  const shown = live
    ? {
        symbol: live.symbol,
        chromosome: live.chromosome,
        transcriptId: live.transcriptId,
        cdsLength: live.cdsLength,
        exons: live.exons,
        guides: live.guides as Row[],
        guidesFound: live.guides.length,
        checked: false,
      }
    : detail
      ? {
          symbol: detail.symbol,
          chromosome: detail.chromosome,
          transcriptId: detail.transcriptId,
          cdsLength: detail.cdsLength,
          exons: detail.exons,
          guides: detail.guides as Row[],
          guidesFound: detail.guidesFound,
          checked: true,
        }
      : null;
  const summary = genes.find((g) => g.symbol === shown?.symbol);
  const filtered =
    shown?.guides
      .map((guide, index) => ({ guide, index }))
      .filter(
        ({ guide }) =>
          (exon === "all" || guide.exon === Number(exon)) &&
          (!cleanOnly ||
            (guide.in_cds &&
              guide.score >= meta.method.cleanScore &&
              (guide.specificity ?? 0) >= meta.method.cleanSpecificity)),
      ) ?? [];
  const selection =
    filtered.find((item) => item.index === picked) ?? filtered[0];
  const guide = selection?.guide;
  const selectedIndex = selection?.index;

  function exportGuides() {
    if (!shown) return;
    const lines = [
      "gene,transcript,spacer,pam,strand,exon,cut,fully_coding,sequence_score,coding_specificity,off_targets_0mm,off_targets_1mm,off_targets_2mm,off_targets_3mm",
      ...filtered.map(({ guide }) =>
        [
          shown.symbol,
          shown.transcriptId,
          guide.spacer,
          guide.pam,
          guide.strand,
          guide.exon,
          guide.cut,
          guide.in_cds,
          guide.score,
          guide.specificity ?? "",
          ...(guide.offTargets ?? ["", "", "", ""]),
        ].join(","),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${shown.symbol}-guides.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <section>
        <p className="eyebrow">SEQUENCE / SCORE / SPECIFICITY</p>
        <h1>Guide workbench</h1>
        <p>
          Inspect candidate SpCas9 guides on either strand. Select a row to
          trace its score and coding-sequence off-targets.{" "}
          <a href="#/method">Method & limits ↗</a>
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
                request.current++;
                setSymbol(e.target.value);
                setLive(null);
                location.hash = `#/designer?gene=${e.target.value}`;
              }}
            >
              {!symbol && (
                <option value="">
                  {live ? `${live.symbol} (live)` : "choose"}
                </option>
              )}
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
              <input
                id="any"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="SOD1"
                autoComplete="off"
                spellCheck={false}
              />
              <button className="secondary" type="submit" disabled={busy}>
                {busy ? "Fetching…" : "Look up"}
              </button>
            </div>
            <span className="small">
              {busy
                ? "Ensembl can take 20 seconds or so."
                : "Any human symbol, for example SOD1 or MYC."}
            </span>
          </form>
        </div>
        {problem && (
          <p
            className="small"
            style={{ color: "var(--bad)", marginTop: 10, marginBottom: 0 }}
          >
            {problem}
          </p>
        )}
      </section>

      {!shown ? (
        <Empty title={problem ? "Gene unavailable" : "Loading sequence…"} />
      ) : (
        <>
          {summary && (
            <section>
              <h3>
                {summary.symbol} · {summary.title}
              </h3>
              <p>{summary.story}</p>
              <p className="small">
                <a
                  href={`https://www.ensembl.org/Homo_sapiens/Transcript/Summary?t=${shown.transcriptId}`}
                >
                  {shown.transcriptId} ↗
                </a>{" "}
                · GRCh38
                {detail && !live ? (
                  <>
                    {" "}
                    · Analysed {detail.analyzedAt.slice(0, 10)} ·{" "}
                    <a
                      href={`${import.meta.env.BASE_URL}data/genes/${detail.symbol}.json`}
                    >
                      Reference JSON ↗
                    </a>
                  </>
                ) : null}
              </p>
            </section>
          )}

          <div className="tiles">
            <Tile
              value={`chr ${shown.chromosome}`}
              label="Chromosome"
              sub={shown.transcriptId}
            />
            <Tile
              value={fmt.kb(shown.cdsLength)}
              label="Coding sequence"
              sub={`${Math.round(shown.cdsLength / 3) - 1} amino acids`}
            />
            <Tile
              value={fmt.int(shown.guidesFound)}
              label="Cut sites in the coding region"
              sub={
                shown.checked
                  ? `top ${shown.guides.length} checked for off-targets`
                  : "scored live in your browser"
              }
            />
            {shown.checked ? (
              <Tile
                value={
                  shown.guides.filter(
                    (g) =>
                      g.in_cds &&
                      g.score >= meta.method.cleanScore &&
                      (g.specificity ?? 0) >= meta.method.cleanSpecificity,
                  ).length
                }
                label="High-scoring coding guides"
                sub={`sequence ${meta.method.cleanScore}+ / coding specificity ${meta.method.cleanSpecificity}+`}
              />
            ) : (
              <Tile value={shown.exons.length} label="Exons" />
            )}
          </div>

          <section className="panel">
            <h2>Where the guides land</h2>
            <ExonMap
              exons={shown.exons}
              cuts={shown.guides.map((g) => ({ exon: g.exon }))}
            />
            <p className="small" style={{ marginTop: 8 }}>
              A knockout usually targets an early coding exon, so a frameshift
              wrecks the protein from near the start.
            </p>
          </section>

          {!shown.checked && (
            <div className="callout warn">
              <b>Off-targets not checked.</b> This gene was fetched live, so
              only the sequence rules were applied. The {genes.length} analysed
              genes also carry a search against all{" "}
              {fmt.int(meta.counts.exomeSites)} coding sites in the human exome.
            </div>
          )}

          <div className="grid-2">
            <section className="panel">
              <div className="row workbench-tools">
                <h2>Ranked guides</h2>
                <button
                  className="secondary"
                  onClick={exportGuides}
                  disabled={!filtered.length}
                >
                  Export CSV ↓
                </button>
              </div>
              <div className="row workbench-tools">
                <label className="small">
                  Exon{" "}
                  <select
                    aria-label="Filter guides by exon"
                    value={exon}
                    onChange={(event) => setExon(event.target.value)}
                  >
                    <option value="all">All</option>
                    {shown.exons
                      .filter((item) => item.codingLength > 0)
                      .map((item) => (
                        <option key={item.number} value={item.number}>
                          {item.number}
                        </option>
                      ))}
                  </select>
                </label>
                {shown.checked && (
                  <label className="small">
                    <input
                      type="checkbox"
                      checked={cleanOnly}
                      onChange={(event) => setCleanOnly(event.target.checked)}
                    />{" "}
                    Fully coding, score {meta.method.cleanScore}+, specificity{" "}
                    {meta.method.cleanSpecificity}+
                  </label>
                )}
              </div>
              <p className="small">
                {filtered.length} matching guides
                {filtered.length > 100
                  ? " · showing the first 100; export includes all matches"
                  : ""}
              </p>
              <div
                className="guide-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Ranked guide sequences"
              >
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
                    {filtered.slice(0, 100).map(({ guide: g, index: i }) => (
                      <tr
                        key={`${g.spacer}${g.cut}`}
                        className="clickable"
                        onClick={() => {
                          setPicked(i);
                          setCopyStatus("");
                        }}
                        aria-current={i === selectedIndex ? "true" : undefined}
                      >
                        <td>{i + 1}</td>
                        <td
                          className="mono"
                          style={{
                            fontWeight: i === selectedIndex ? 700 : 400,
                          }}
                        >
                          <button
                            className="sequence-pick"
                            aria-label={`Inspect guide ${i + 1}: ${g.spacer}`}
                            aria-pressed={i === selectedIndex}
                            onClick={() => {
                              setPicked(i);
                              setCopyStatus("");
                            }}
                          >
                            {g.spacer}
                          </button>
                        </td>
                        <td className="mono">{g.pam}</td>
                        <td className="num">{g.exon}</td>
                        <td className="num">{g.score}</td>
                        {shown.checked && (
                          <td className="num">{(g as Guide).specificity}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <p role="status">
                    No guides meet these filters. Try another exon or turn off
                    the score filter.
                  </p>
                )}
              </div>
            </section>

            {guide && selection && (
              <section className="panel guide-detail">
                <h2>Guide {selection.index + 1} in detail</h2>
                <div className="row guide-actions">
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(guide.spacer);
                        setCopyStatus("Spacer copied");
                      } catch {
                        setCopyStatus("Select the sequence below to copy it.");
                      }
                    }}
                  >
                    Copy spacer
                  </button>
                  <span className="small" role="status">
                    {copyStatus}
                  </span>
                </div>
                <p
                  className="mono"
                  style={{ fontSize: 15, wordBreak: "break-all" }}
                >
                  {guide.spacer}
                  <span style={{ color: "var(--c-2)", fontWeight: 700 }}>
                    {guide.pam}
                  </span>
                </p>
                <p className="small">
                  {guide.strand === "+"
                    ? "Same strand as the transcript"
                    : "Opposite strand"}
                  , cuts at coding base {fmt.int(guide.cut)} of{" "}
                  {fmt.int(shown.cdsLength)} (about{" "}
                  {Math.round((guide.cut / shown.cdsLength) * 100)}% through the
                  protein)
                  {guide.in_cds
                    ? ""
                    : ", and reaches past the coding region into a UTR or intron"}
                  .
                </p>
                <h3 style={{ marginTop: 14 }}>Score: {guide.score}/100</h3>
                <ScoreBreakdown
                  base={meta.method.baseScore}
                  reasons={guide.reasons}
                />
                {!guide.in_cds && (
                  <p className="callout warn small">
                    This spacer extends beyond coding sequence. Its coding-only
                    specificity is incomplete and should be excluded from
                    specificity comparisons.
                  </p>
                )}
                {"offTargets" in guide && guide.offTargets && (
                  <>
                    <h3 style={{ marginTop: 14 }}>
                      Specificity: {(guide as Guide).specificity}/100
                    </h3>
                    <MismatchBars counts={guide.offTargets} />
                    <p className="small">
                      Searched against every protein-coding sequence in the
                      genome. Sites that differ by only one or two bases are the
                      ones Cas9 is most likely to cut by mistake.
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
