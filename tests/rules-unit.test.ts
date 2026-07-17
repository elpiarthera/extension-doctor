import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { netBroadcastUnfiltered } from "../src/rules/net-broadcast-unfiltered.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

describe("net-broadcast-unfiltered — cas tordu (url: from function call, not literal)", () => {
  it("MUST_PASS: url filter via getSupportedTabUrlPatterns() is not flagged", async () => {
    const result = await netBroadcastUnfiltered.run(join(FIXTURES, "net-broadcast-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("net-broadcast-unfiltered — faux positif redouté (query with no downstream sendMessage)", () => {
  it("MUST_PASS: query({}) used only for counting tabs is not flagged", async () => {
    const result = await netBroadcastUnfiltered.run(join(FIXTURES, "net-broadcast-fp-counting"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("net-broadcast-unfiltered — INCONCLUSIVE precondition (échec bruyant)", () => {
  it("exit 2, never 0, when src/background is absent", async () => {
    const result = await netBroadcastUnfiltered.run(join(FIXTURES, "does-not-exist"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0]?.reason).toMatch(/background source directory not found/);
  });
});
