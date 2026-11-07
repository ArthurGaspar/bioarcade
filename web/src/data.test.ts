import { afterEach, describe, expect, it, vi } from "vitest";
import { load } from "./data";

afterEach(() => vi.unstubAllGlobals());

describe("sequence data loading", () => {
  it("shares concurrent requests for the same data", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ gene: "TP53" }) });
    vi.stubGlobal("fetch", fetch);
    const [first, second] = await Promise.all([
      load("shared.json"),
      load("shared.json"),
    ]);
    expect(first).toEqual({ gene: "TP53" });
    expect(second).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("allows a later visit to recover after an HTTP failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ["BRCA1"] });
    vi.stubGlobal("fetch", fetch);
    await expect(load("recover-http.json")).rejects.toThrow("503");
    await expect(load("recover-http.json")).resolves.toEqual(["BRCA1"]);
  });

  it("allows a later visit to recover after a network failure", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network unavailable"))
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetch);
    await expect(load("recover-network.json")).rejects.toThrow(
      "Network unavailable",
    );
    await expect(load("recover-network.json")).resolves.toEqual([]);
  });
});
