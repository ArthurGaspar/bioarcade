import { load, type Meta } from "./data";
import { Empty, fmt, useAsync } from "./ui";

export function Method() {
  const { data: meta, error } = useAsync(() => load<Meta>("meta.json"), []);
  if (error) return <Empty title="No build yet">{error}</Empty>;
  if (!meta) return <Empty title="Loading…" />;
  const m = meta.method;

  return (
    <>
      <section>
        <h1>How it works</h1>
        <p>
          Everything on this site comes from public data and a Python pipeline. No account, no key, no server: the pipeline runs
          offline and leaves behind JSON files that GitHub Pages serves.
        </p>
      </section>

      <section className="panel">
        <h2>The pipeline</h2>
        <ol style={{ paddingLeft: 20, color: "var(--ink-2)", maxWidth: "78ch" }}>
          <li>
            <b>Fetch.</b> For each gene, Ensembl's REST API gives the canonical transcript, its exons and their sequences on the
            transcript's strand.
          </li>
          <li>
            <b>Assemble the coding sequence.</b> Exons are trimmed to the translated region and joined. The check that this is
            right: the result must start with methionine, end with a stop codon, and divide evenly into codons.
          </li>
          <li>
            <b>Find cut sites.</b> Every 20-base stretch followed by {m.pam} on either strand, keeping only those whose cut (
            {m.cutOffsetFromPam} bases in from the PAM) lands inside the coding sequence.
          </li>
          <li>
            <b>Score.</b> The rules below, each one adding or removing points from a base of {m.baseScore}.
          </li>
          <li>
            <b>Check off-targets.</b> The best {m.checkedPerGene} guides per gene are compared against{" "}
            {fmt.int(meta.counts.exomeSites)} sites: every NGG-adjacent 20-mer in all human protein-coding sequence, both
            strands. Each 20-mer is packed two bits per base, so one comparison is an XOR and a bit count.
          </li>
          <li>
            <b>Build.</b> A second, offline step turns the analyses into the site's JSON and the game rounds.
          </li>
        </ol>
      </section>

      <section className="panel">
        <h2>The scoring rules</h2>
        <p>
          A guide starts at {m.baseScore} and moves from there. This is not a trained efficiency model; it is the published
          design guidance that most tools agree on, written out so you can disagree with it.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th className="num">Points</th>
                <th>When</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {m.scoreRules.map((r) => (
                <tr key={r.id}>
                  <td className="num" style={{ color: r.points > 0 ? "var(--gain)" : "var(--penalty)", fontWeight: 600 }}>
                    {r.points > 0 ? "+" : ""}
                    {r.points}
                  </td>
                  <td>{r.what}</td>
                  <td className="small">{r.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>What this is not</h2>
        <ul style={{ paddingLeft: 20, color: "var(--ink-2)", maxWidth: "78ch" }}>
          <li>
            <b>Not a lab tool.</b> It is a teaching toy. Real experiments use trained efficiency models and genome-wide
            off-target searches, then validate in cells.
          </li>
          <li>
            <b>Off-targets cover coding sequence only.</b> Most of the genome is non-coding, and a guide can cut there too. The
            count is a floor, not a total.
          </li>
          <li>
            <b>Joined exons create a few sites that do not exist.</b> The search index is spliced coding sequence, so a handful
            of apparent matches straddle a junction that only exists in the finished RNA.
          </li>
          <li>
            <b>Guides that reach into a UTR or intron are invisible to the search.</b> They are marked, and their specificity
            number should be ignored.
          </li>
          <li>
            <b>One transcript per gene.</b> Alternative splicing is ignored, and a guide good for the canonical transcript may
            miss another isoform.
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2>Sources</h2>
        <ul style={{ paddingLeft: 20, color: "var(--ink-2)" }}>
          <li>
            Genes and sequences: <a href="https://rest.ensembl.org">Ensembl REST</a> ({m.spacer}-base spacers, GRCh38 canonical
            transcripts).
          </li>
          <li>
            Off-target reference: <a href={meta.source.exome}>Ensembl human CDS FASTA</a>.
          </li>
        </ul>
        <p className="small">
          Built {new Date(meta.builtAt).toLocaleString("en-GB")}. Ensembl is released under the Apache 2.0 licence and its data
          is free to use with attribution.
        </p>
      </section>
    </>
  );
}
