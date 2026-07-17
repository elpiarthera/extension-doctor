/**
 * Dogfood proof — runs the shipped rules against the REAL git history of
 * gptpowerups-extension (checked out as sibling worktrees), never a
 * synthetic fixture invented to flatter the matcher. Skips gracefully (with
 * a loud console note, not a silent pass) if the worktrees are not present
 * on the machine running the test (e.g. CI without the sibling repo).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { netBroadcastUnfiltered } from "../src/rules/net-broadcast-unfiltered.js";
import { i18nKeyCoverageGap } from "../src/rules/i18n-key-coverage-gap.js";
import { swContextInvalidatedGuard } from "../src/rules/sw-context-invalidated-guard.js";

const BEFORE = "/tmp/ed-before";
const AFTER = "/tmp/ed-after";
const I18N = "/tmp/ed-i18n";

const haveWorktrees = existsSync(BEFORE) && existsSync(AFTER) && existsSync(I18N);

describe.skipIf(!haveWorktrees)("dogfood: net-broadcast-unfiltered", () => {
  it("MUST_BLOCK: fails on origin/chi/d137-baseline-green (3 unfiltered broadcasts)", async () => {
    const result = await netBroadcastUnfiltered.run(BEFORE);
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("src/background/conversations-handler.ts");
    expect(files).toContain("src/background/media-handler.ts");
    expect(files).toContain("src/background/projects-handler.ts");
  });

  it("MUST_PASS: passes on origin/chi/d137-backlog-fixes-v2 (host-filtered broadcast)", async () => {
    const result = await netBroadcastUnfiltered.run(AFTER);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe.skipIf(!haveWorktrees)("dogfood: sw-context-invalidated-guard", () => {
  it("MUST_BLOCK: flags messaging.ts on baseline-green (no guard)", async () => {
    const result = await swContextInvalidatedGuard.run(BEFORE);
    expect(result.verdict).toBe("fail");
    const messagingFinding = result.findings.find((f) => f.file === "src/background/messaging.ts");
    expect(messagingFinding).toBeDefined();
  });

  it("MUST_PASS: messaging.ts itself no longer flagged after backlog-fixes-v2 guard", async () => {
    const result = await swContextInvalidatedGuard.run(AFTER);
    const messagingFinding = result.findings.find((f) => f.file === "src/background/messaging.ts");
    expect(messagingFinding).toBeUndefined();
  });
});

describe.skipIf(!haveWorktrees)("dogfood: i18n-key-coverage-gap", () => {
  const expectedKeys = ["card_menu_open", "edit", "duplicate", "unfavorite", "favorite", "move_to_project"];

  it("MUST_BLOCK: flags all 6 missing keys on rebuild-zip-v0.9.0.0", async () => {
    const result = await i18nKeyCoverageGap.run(I18N);
    expect(result.verdict).toBe("fail");
    const flaggedKeys = result.findings.map((f) => f.message.match(/"([a-z_]+)"/)?.[1]);
    for (const key of expectedKeys) {
      expect(flaggedKeys).toContain(key);
    }
  });

  it("MUST_PASS: none of the 6 keys flagged on baseline-green (present in both locales)", async () => {
    const result = await i18nKeyCoverageGap.run(BEFORE);
    const flaggedKeys = result.findings.map((f) => f.message.match(/"([a-z_]+)"/)?.[1]);
    for (const key of expectedKeys) {
      expect(flaggedKeys).not.toContain(key);
    }
  });

  it("cas tordu #1: dynamic template-literal key surfaced as inconclusive, never silently dropped", async () => {
    const result = await i18nKeyCoverageGap.run(BEFORE);
    const dynamic = result.inconclusive.find((i) => i.file === "ui/components/media/MediaCardShell.tsx");
    expect(dynamic).toBeDefined();
    expect(dynamic?.reason).toMatch(/dynamic/i);
  });
});
