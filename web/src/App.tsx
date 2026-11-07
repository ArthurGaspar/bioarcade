import { useEffect, useState } from "react";
import { Arcade } from "./Arcade";
import { Designer } from "./Designer";
import { Method } from "./Method";
import { PamHunter } from "./games/PamHunter";
import { GuideDuel } from "./games/GuideDuel";
import { VariantVerdict } from "./games/VariantVerdict";
import { CodonRunner } from "./games/CodonRunner";

type Theme = "system" | "light" | "dark";

const PAGES = [
  { hash: "#/", label: "Arcade" },
  { hash: "#/pam-hunter", label: "PAM Hunter" },
  { hash: "#/guide-duel", label: "Guide Duel" },
  { hash: "#/variant-verdict", label: "Variant Verdict" },
  { hash: "#/codon-runner", label: "Codon Runner" },
  { hash: "#/designer", label: "Designer" },
  { hash: "#/method", label: "How it works" },
];

export function App() {
  const [hash, setHash] = useState(location.hash || "#/");
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("bioarcade-theme");
      return stored === "dark" || stored === "light" || stored === "system"
        ? stored
        : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const on = () => {
      setHash(location.hash || "#/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.setAttribute(
        "data-theme",
        theme === "system" ? (preference.matches ? "dark" : "light") : theme,
      );
    apply();
    preference.addEventListener("change", apply);
    try {
      localStorage.setItem("bioarcade-theme", theme);
    } catch {
      // storage can be unavailable; the theme still applies for this visit
    }
    return () => preference.removeEventListener("change", apply);
  }, [theme]);

  const route = hash.split("?")[0];
  const page = PAGES.some((p) => p.hash === route) ? route : "#/";
  const gene = new URLSearchParams(hash.split("?")[1]).get("gene") ?? "TP53";

  useEffect(() => {
    document.title = `${PAGES.find((p) => p.hash === page)?.label ?? "Arcade"} / BioArcade`;
  }, [page]);

  return (
    <>
      <a
        className="skip-link"
        href="#content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="top">
        <a className="brand" href="#/">
          <b>
            BIO<span>ARCADE</span>
          </b>
        </a>
        <nav aria-label="Main navigation">
          {PAGES.filter((p) =>
            ["#/", "#/designer", "#/method"].includes(p.hash),
          ).map((p) => (
            <a
              key={p.hash}
              href={p.hash}
              aria-current={page === p.hash ? "page" : undefined}
            >
              {p.hash === "#/designer"
                ? "Workbench"
                : p.hash === "#/method"
                  ? "Field notes"
                  : p.label}
            </a>
          ))}
        </nav>
        <button
          className="icon-btn"
          onClick={() =>
            setTheme((t) =>
              t === "system" ? "light" : t === "light" ? "dark" : "system",
            )
          }
          aria-label={`Theme: ${theme}. Change theme`}
        >
          {theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark"}
        </button>
      </header>
      <main id="content" tabIndex={-1}>
        {page !== "#/" && (
          <a className="back-link" href="#/">
            ← All experiments
          </a>
        )}
        {page === "#/" && <Arcade />}
        {page === "#/pam-hunter" && <PamHunter />}
        {page === "#/guide-duel" && <GuideDuel />}
        {page === "#/variant-verdict" && <VariantVerdict />}
        {page === "#/codon-runner" && <CodonRunner />}
        {page === "#/designer" && <Designer key={gene} initialGene={gene} />}
        {page === "#/method" && <Method />}
      </main>
      <footer className="site-footer">
        <a className="footer-signature" href="https://github.com/ArthurGaspar">
          Arthur Gaspar
        </a>
        <span>Software × bioinformatics</span>
        <a href="https://github.com/ArthurGaspar/bioarcade">
          Source & pipeline ↗
        </a>
        <span>ENSEMBL / CLINVAR / GRCh38</span>
      </footer>
    </>
  );
}
