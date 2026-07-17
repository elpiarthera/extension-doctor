/**
 * pack-fam5 — bipolar/tripolar proof for the 4 new service-worker/memory
 * rules: custom-element-orphan-registration, mem-cleanup-listeners,
 * sw-no-keepalive, sw-listeners-toplevel.
 *
 * Every fixture carries a FIXTURE PROVENANCE header naming its origin —
 * see tests/fixtures/dogfood/{custom-element,mem-cleanup,sw-keepalive,
 * sw-toplevel}-*.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { customElementOrphanRegistration } from "../src/rules/custom-element-orphan-registration.js";
import { memCleanupListeners } from "../src/rules/mem-cleanup-listeners.js";
import { swNoKeepalive } from "../src/rules/sw-no-keepalive.js";
import { swListenersToplevel } from "../src/rules/sw-listeners-toplevel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures/dogfood");

const CE_FAIL = join(FIXTURES, "custom-element-fail");
const CE_PASS = join(FIXTURES, "custom-element-pass");
const CE_NOENTRY = join(FIXTURES, "custom-element-noentry");

const MEM_FAIL = join(FIXTURES, "mem-cleanup-fail");
const MEM_PASS = join(FIXTURES, "mem-cleanup-pass");

const KEEPALIVE_FAIL = join(FIXTURES, "sw-keepalive-fail");
const KEEPALIVE_PASS = join(FIXTURES, "sw-keepalive-pass");

const TOPLEVEL_FAIL = join(FIXTURES, "sw-toplevel-fail");
const TOPLEVEL_PASS = join(FIXTURES, "sw-toplevel-pass");

describe("custom-element-orphan-registration", () => {
  it("MUST_BLOCK: flags <gptu-icon-button> whose define() site is unreachable from entry", async () => {
    const result = await customElementOrphanRegistration.run(CE_FAIL);
    expect(result.verdict).toBe("fail");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.file).toBe("src/ui/sidebar-mount.tsx");
    expect(result.findings[0]!.message).toContain("gptu-icon-button");
  });

  it("MUST_PASS: passes once sidebar-mount.tsx imports lit-ui-register", async () => {
    const result = await customElementOrphanRegistration.run(CE_PASS);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: inconclusive with named reason when no entry point resolves", async () => {
    const result = await customElementOrphanRegistration.run(CE_NOENTRY);
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive).toHaveLength(1);
    expect(result.inconclusive[0]!.reason.length).toBeGreaterThan(0);
    expect(result.inconclusive[0]!.reason).toContain("no resolvable entry point");
  });
});

describe("mem-cleanup-listeners", () => {
  it("MUST_BLOCK: flags document.addEventListener with no matching removeEventListener", async () => {
    const result = await memCleanupListeners.run(MEM_FAIL);
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((f) => f.file === "src/content/hover-card.ts")).toBe(true);
    expect(result.findings[0]!.message).toContain("mousemove");
  });

  it("MUST_PASS: passes with symmetric add/remove and a declared-permanent exception", async () => {
    const result = await memCleanupListeners.run(MEM_PASS);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: inconclusive with named reason when no content-script dir exists", async () => {
    const result = await memCleanupListeners.run(join(FIXTURES, "sw-keepalive-fail"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0]!.reason.length).toBeGreaterThan(0);
  });
});

describe("sw-no-keepalive", () => {
  it("MUST_BLOCK: flags setInterval(fn, 5000) used as a keepalive in background/*", async () => {
    const result = await swNoKeepalive.run(KEEPALIVE_FAIL);
    expect(result.verdict).toBe("fail");
    expect(result.findings[0]!.file).toBe("src/background/keepalive.ts");
    expect(result.findings[0]!.message).toContain("setInterval");
  });

  it("MUST_PASS: passes with chrome.alarms.create + a >=30s setTimeout", async () => {
    const result = await swNoKeepalive.run(KEEPALIVE_PASS);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: inconclusive with named reason when src/background is missing", async () => {
    const result = await swNoKeepalive.run(join(FIXTURES, "mem-cleanup-fail"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0]!.reason).toContain("src/background");
  });
});

describe("sw-listeners-toplevel", () => {
  it("MUST_BLOCK: flags addListener registered inside an async init() body", async () => {
    const result = await swListenersToplevel.run(TOPLEVEL_FAIL);
    expect(result.verdict).toBe("fail");
    expect(result.findings[0]!.file).toBe("src/background/service-worker.ts");
  });

  it("MUST_PASS: passes with top-level and conditional-top-level addListener", async () => {
    const result = await swListenersToplevel.run(TOPLEVEL_PASS);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: inconclusive with named reason when src/background is missing", async () => {
    const result = await swListenersToplevel.run(join(FIXTURES, "mem-cleanup-fail"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0]!.reason).toContain("src/background");
  });
});
