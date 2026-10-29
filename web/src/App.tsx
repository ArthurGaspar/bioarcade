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
      return (localStorage.getItem("bioarcade-theme") as Theme) || "system";
    } catch {
      return "system";
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
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("bioarcade-theme", theme);
    } catch {
      // storage can be unavailable; the theme still applies for this visit
    }
  }, [theme]);

  const page = PAGES.some((p) => p.hash === hash) ? hash : "#/";

  return (
    <>
      <header className="top">
        <a className="brand" href="#/">
          <b>BIOARCADE</b>
          <span>genomics you can play</span>
        </a>
        <nav>
          {PAGES.map((p) => (
            <a key={p.hash} href={p.hash} aria-current={page === p.hash ? "page" : undefined}>
              {p.label}
            </a>
          ))}
        </nav>
        <button className="icon-btn" onClick={() => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"))} aria-label={`Theme: ${theme}`}>
          {theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark"}
        </button>
      </header>
      <main>
        {page === "#/" && <Arcade />}
        {page === "#/pam-hunter" && <PamHunter />}
        {page === "#/guide-duel" && <GuideDuel />}
        {page === "#/variant-verdict" && <VariantVerdict />}
        {page === "#/codon-runner" && <CodonRunner />}
        {page === "#/designer" && <Designer />}
        {page === "#/method" && <Method />}
      </main>
    </>
  );
}
