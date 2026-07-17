import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { hostSignalUnverified } from "../src/rules/host-signal-unverified.js";
import { scoreScopeProvenance } from "../src/rules/score-scope-provenance.js";
import { coexistenceCollision } from "../src/rules/coexistence-collision.js";
import { testCannotFail } from "../src/rules/test-cannot-fail.js";
import { verifiedNotActivated } from "../src/rules/verified-not-activated.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

describe("host-signal-unverified — MUST_BLOCK", () => {
  it("flags a hardcoded selector literal in adapters/** with no // verified: comment", async () => {
    const result = await hostSignalUnverified.run(join(FIXTURES, "host-signal-block"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]?.message).toMatch(/verified:/);
  });
});

describe("host-signal-unverified — MUST_PASS", () => {
  it("does not flag a selector annotated // verified: <dated fixture>, or a W3C-standard API", async () => {
    const result = await hostSignalUnverified.run(join(FIXTURES, "host-signal-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("host-signal-unverified — MUST_REFUSE (inconclusive, never silent pass)", () => {
  it("exit 2, never 0, when src/adapters is absent", async () => {
    const result = await hostSignalUnverified.run(join(FIXTURES, "host-signal-no-adapters"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0]?.reason).toMatch(/adapters source directory not found/);
  });
});

describe("score-scope-provenance — participates honestly in the count", () => {
  it("returns pass, citing that provenance is enforced structurally by the envelope", async () => {
    const result = await scoreScopeProvenance.run(join(FIXTURES, "host-signal-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("documented-impossible stubs — never silently pass, always inconclusive with a precise reason", () => {
  const stubs = [
    { id: "coexistence-collision", rule: coexistenceCollision },
    { id: "test-cannot-fail", rule: testCannotFail },
    { id: "verified-not-activated", rule: verifiedNotActivated },
  ];

  for (const { id, rule } of stubs) {
    it(`${id}: verdict is inconclusive with a non-empty precise reason`, async () => {
      const result = await rule.run(join(FIXTURES, "host-signal-pass"));
      expect(result.verdict).toBe("inconclusive");
      expect(result.exitCode).toBe(2);
      expect(result.inconclusive.length).toBeGreaterThan(0);
      const reason = result.inconclusive[0]?.reason ?? "";
      expect(reason.length).toBeGreaterThan(20);
      expect(reason).not.toMatch(/^internal error$/i);
    });
  }
});
