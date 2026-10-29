import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CodonRound } from "../data";
import { CODONS, codonOptions, decodeCodon, deleteBase, readFrame } from "./codons";

describe("standard nuclear translation", () => {
  it("covers all 64 codons and the three stop signals", () => {
    expect(Object.keys(CODONS)).toHaveLength(64);
    expect(Object.entries(CODONS).filter(([, a]) => a === "*").map(([c]) => c).sort()).toEqual(["TAA", "TAG", "TGA"]);
    expect(decodeCodon("ATG")).toBe("M");
    expect(decodeCodon("aug")).toBe("M");
    expect(decodeCodon("TGG")).toBe("W");
    expect(decodeCodon("GCT")).toBe("A");
    expect(decodeCodon("AGG")).toBe("R");
    for (const invalid of ["AT", "ATGG", "NNN", ""]) expect(decodeCodon(invalid)).toBeNull();
  });

  it("agrees with the Python translation for every published game excerpt", () => {
    const rounds = JSON.parse(readFileSync(new URL("../../public/data/codon-runner.json", import.meta.url), "utf8")) as CodonRound[];
    expect(rounds.length).toBe(6);
    for (const r of rounds) {
      const frame = readFrame(r.seq);
      expect(frame.codons.map((c) => c.amino).join(""), r.gene).toBe(r.protein);
      expect(frame.trailing).toBe("");
    }
  });

  it("stops the protein at the first stop and ignores incomplete codons", () => {
    const frame = readFrame("ATGTAACCCGG");
    expect(frame.protein).toBe("M");
    expect(frame.stop).toBe(1);
    expect(frame.codons[2]).toEqual({ dna: "CCC", amino: "P", afterStop: true });
    expect(frame.trailing).toBe("GG");
    expect(readFrame("TAA").protein).toBe("");
    expect(readFrame("ATGCCC").stop).toBe(-1);
  });

  it("re-groups triplets after exactly one deletion, which can introduce a stop", () => {
    const original = "ATGATAACCCGG";
    expect(readFrame(original).protein).toBe("MITR");
    expect(deleteBase(original, 3)).toBe("ATGTAACCCGG");
    expect(readFrame(deleteBase(original, 3)).protein).toBe("M");
    expect(deleteBase(original, 0)).toBe(original.slice(1));
    expect(deleteBase(original, original.length - 1)).toBe(original.slice(0, -1));
    for (const invalid of [-1, 0.5, original.length, NaN]) expect(deleteBase(original, invalid)).toBe(original);
  });

  it("offers four distinct stable choices with exactly one correct answer for every codon", () => {
    for (const codon of Object.keys(CODONS)) {
      for (let i = 0; i < 8; i++) {
        const options = codonOptions(codon, i);
        expect(new Set(options).size).toBe(4);
        expect(options.filter((a) => a === decodeCodon(codon))).toHaveLength(1);
        expect(options).toEqual(codonOptions(codon, i));
      }
    }
  });
});
