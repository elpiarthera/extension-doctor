/**
 * Dogfood proof — runs the shipped rules against REAL code extracted from
 * gptpowerups-extension's actual git history, committed as fixtures under
 * tests/fixtures/dogfood/ so the proof is rejouable by anyone (including
 * CI) without a sibling worktree on the machine.
 *
 * Every fixture file carries a "FIXTURE PROVENANCE" header comment naming
 * the source file + branch/ref it was extracted from — see
 * tests/fixtures/dogfood/**\/*.ts and *.tsx.
 *
 * This replaced an earlier version that conditionally skipped its describe
 * blocks against ephemeral /tmp worktrees local to one machine — that made
 * the dogfood proof invisible in CI and to any third party (7/10 tests
 * silently skipped, docstring claiming "loud console note" while emitting
 * zero console output — Eta REVISE blocker, T3-SHIP).
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { netBroadcastUnfiltered } from "../src/rules/net-broadcast-unfiltered.js";
import { i18nKeyCoverageGap } from "../src/rules/i18n-key-coverage-gap.js";
import { swContextInvalidatedGuard } from "../src/rules/sw-context-invalidated-guard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures/dogfood");

const NET_BROADCAST_FAIL = join(FIXTURES, "net-broadcast-fail");
const NET_BROADCAST_PASS = join(FIXTURES, "net-broadcast-pass");
const SW_CONTEXT_FAIL = join(FIXTURES, "sw-context-fail");
const SW_CONTEXT_PASS = join(FIXTURES, "sw-context-pass");
const I18N_FAIL = join(FIXTURES, "i18n-fail");
const I18N_PASS = join(FIXTURES, "i18n-pass");

describe("dogfood: net-broadcast-unfiltered", () => {
  it("MUST_BLOCK: fails on origin/chi/d137-baseline-green (3 unfiltered broadcasts)", async () => {
    const result = await netBroadcastUnfiltered.run(NET_BROADCAST_FAIL);
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("src/background/conversations-handler.ts");
    expect(files).toContain("src/background/media-handler.ts");
    expect(files).toContain("src/background/projects-handler.ts");
  });

  it("MUST_PASS: passes on origin/chi/d137-backlog-fixes-v2 (host-filtered broadcast)", async () => {
    const result = await netBroadcastUnfiltered.run(NET_BROADCAST_PASS);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("dogfood: sw-context-invalidated-guard", () => {
  it("MUST_BLOCK: flags messaging.ts on baseline-green (no guard)", async () => {
    const result = await swContextInvalidatedGuard.run(SW_CONTEXT_FAIL);
    expect(result.verdict).toBe("fail");
    const messagingFinding = result.findings.find((f) => f.file === "src/background/messaging.ts");
    expect(messagingFinding).toBeDefined();
  });

  it("MUST_PASS: messaging.ts itself no longer flagged after backlog-fixes-v2 guard", async () => {
    const result = await swContextInvalidatedGuard.run(SW_CONTEXT_PASS);
    const messagingFinding = result.findings.find((f) => f.file === "src/background/messaging.ts");
    expect(messagingFinding).toBeUndefined();
  });
});

describe("dogfood: i18n-key-coverage-gap", () => {
  const expectedKeys = ["card_menu_open", "edit", "duplicate", "unfavorite", "favorite", "move_to_project"];

  it("MUST_BLOCK: flags all 6 missing keys on rebuild-zip-v0.9.0.0", async () => {
    const result = await i18nKeyCoverageGap.run(I18N_FAIL);
    expect(result.verdict).toBe("fail");
    const flaggedKeys = result.findings.map((f) => f.message.match(/"([a-z_]+)"/)?.[1]);
    for (const key of expectedKeys) {
      expect(flaggedKeys).toContain(key);
    }
  });

  it("MUST_PASS: none of the 6 keys flagged on baseline-green (present in both locales)", async () => {
    const result = await i18nKeyCoverageGap.run(I18N_PASS);
    const flaggedKeys = result.findings.map((f) => f.message.match(/"([a-z_]+)"/)?.[1]);
    for (const key of expectedKeys) {
      expect(flaggedKeys).not.toContain(key);
    }
  });

  it("cas tordu #1: dynamic template-literal key surfaced as inconclusive, never silently dropped", async () => {
    const result = await i18nKeyCoverageGap.run(I18N_FAIL);
    const dynamic = result.inconclusive.find((i) => i.file === "ui/components/media/MediaCardShell.tsx");
    expect(dynamic).toBeDefined();
    expect(dynamic?.reason).toMatch(/dynamic/i);
  });
});
