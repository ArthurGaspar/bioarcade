import { load, type Meta } from "./data";
import { Empty, fmt, useAsync } from "./ui";

export function Method() {
  const { data: meta, error } = useAsync(() => load<Meta>("meta.json"), []);
  if (error) return <Empty title="No build yet">{error}</Empty>;
  if (!meta) return <Empty title="Loading…" />;
  const m = meta.method;

  return (
    <article className="field-notes">
      <section>
        <p className="eyebrow">DATA / RULES / LIMITS</p>
        <h1>Field notes</h1>
        <p>
          Python prepares the reference data; TypeScript runs the games and
          scores live lookups. The analysed collection is served as static JSON.
        </p>
        <p className="small">
          Built by <a href="https://github.com/ArthurGaspar">Arthur Gaspar</a> ·
          software developer with bioinformatics research experience at UFABC.
        </p>
      </section>

      <section className="panel">
        <h2>The pipeline</h2>
        <ol
          style={{ paddingLeft: 20, color: "var(--ink-2)", maxWidth: "78ch" }}
        >
          <li>
            <b>Fetch.</b> For each gene, Ensembl's REST API gives the canonical
            transcript, its exons and their sequences on the transcript's
            strand.
          </li>
          <li>
            <b>Assemble the coding sequence.</b> Exons are trimmed to the
            translated region and joined. The check that this is right: the
            result must start with methionine, end with a stop codon, and divide
            evenly into codons.
          </li>
          <li>
            <b>Find cut sites.</b> Every 20-base stretch followed by {m.pam} on
            either strand, keeping only those whose cut ({m.cutOffsetFromPam}{" "}
            bases in from the PAM) lands inside the coding sequence.
          </li>
          <li>
            <b>Score.</b> The rules below, each one adding or removing points
            from a base of {m.baseScore}.
          </li>
          <li>
            <b>Check off-targets.</b> The best {m.checkedPerGene} guides per
            gene are compared against {fmt.int(meta.counts.exomeSites)} sites:
            every NGG-adjacent 20-mer in all human protein-coding sequence, both
            strands. Each 20-mer is packed two bits per base, so one comparison
            is an XOR and a bit count.
          </li>
          <li>
            <b>Build.</b> A second, offline step turns the analyses into the
            site's JSON and the game rounds.
          </li>
        </ol>
      </section>

      <section className="panel">
        <h2>The scoring rules</h2>
        <p>
          Sequence scores start at {m.baseScore}, apply these rules, and are
          clamped to 0–100. These heuristic scores are separate from
          coding-sequence specificity and do not predict experimental
          efficiency.
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
                  <td
                    className="num"
                    style={{
                      color: r.points > 0 ? "var(--gain)" : "var(--penalty)",
                      fontWeight: 600,
                    }}
                  >
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
        <h2>Interpretation limits</h2>
        <ul
          style={{ paddingLeft: 20, color: "var(--ink-2)", maxWidth: "78ch" }}
        >
          <li>
            <b>Educational use.</b> Real experiments use trained efficiency
            models and genome-wide off-target searches, then validate in cells.
          </li>
          <li>
            <b>Off-targets cover coding sequence only.</b> Most of the genome is
            non-coding, and a guide can cut there too. The count is a floor, not
            a total.
          </li>
          <li>
            <b>Joined exons create a few sites that do not exist.</b> The search
            index is spliced coding sequence, so a handful of apparent matches
            straddle a junction that only exists in the finished RNA.
          </li>
          <li>
            <b>
              Guides that reach into a UTR or intron are invisible to the
              search.
            </b>{" "}
            They are marked, and their specificity number should be ignored.
          </li>
          <li>
            <b>One transcript per gene.</b> Alternative splicing is ignored, and
            a guide good for the canonical transcript may miss another isoform.
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2>Sources</h2>
        <p>
          <a href="#/codon-runner">Codon Runner</a> uses real coding windows
          aligned to the assembled transcript's codon boundaries. It applies the
          standard nuclear code. The deletion lab makes hypothetical edits,
          stops translation at the first stop codon and leaves incomplete
          triplets untranslated. Its short excerpts do not predict protein
          function.
        </p>
        <p>
          <a href="#/variant-verdict">Variant Verdict</a> uses a separate,
          curated snapshot of ClinVar records. Cases preserve the exact
          classification, condition scope, accession and review status. Clues
          are educational summaries; classifications can change. Each answer
          links to its source, and the snapshot review date appears in the game.
        </p>
        <ul style={{ paddingLeft: 20, color: "var(--ink-2)" }}>
          <li>
            Variant evidence and classifications:{" "}
            <a href="https://www.ncbi.nlm.nih.gov/clinvar/">NCBI ClinVar</a>.
          </li>
          <li>
            Codon translation:{" "}
            <a href="https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG1">
              NCBI standard nuclear code, table 1
            </a>
            .
          </li>
          <li>
            Genes and sequences:{" "}
            <a href="https://rest.ensembl.org">Ensembl REST</a> ({m.spacer}-base
            spacers, GRCh38 canonical transcripts).
          </li>
          <li>
            Off-target reference:{" "}
            <a href={meta.source.exome}>Ensembl human CDS FASTA</a>.
          </li>
        </ul>
        <p className="small">
          Site data built {new Date(meta.builtAt).toLocaleString("en-GB")}. This
          is a build timestamp, not the date the source databases were updated.
          Gene analysis dates are recorded in the exported JSON.
        </p>
      </section>
    </article>
  );
}
