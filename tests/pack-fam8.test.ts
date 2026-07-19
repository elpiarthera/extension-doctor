/**
 * Dogfood proof for the fam8 Preact/DOM rule pack (Shadow DOM style
 * isolation + hooks hygiene + render purity).
 *
 * Each rule gets MUST_BLOCK + MUST_PASS + MUST_REFUSE (tripolar) coverage,
 * mirroring tests/dogfood.test.ts's contract: verdict vocabulary is never
 * silently binary (core/types.ts "pass" | "fail" | "inconclusive").
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { shadowDomStyleLeak } from "../src/rules/shadow-dom-style-leak.js";
import { hookEffectCleanupMissing } from "../src/rules/hook-effect-cleanup-missing.js";
import { hookDepsIncomplete } from "../src/rules/hook-deps-incomplete.js";
import { renderSideEffectImpure } from "../src/rules/render-side-effect-impure.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures/dogfood");

describe("dogfood: shadow-dom-style-leak", () => {
  it("MUST_BLOCK: style element appended to document/document.head instead of a shadow root", async () => {
    const result = await shadowDomStyleLeak.run(join(FIXTURES, "shadow-dom-style-leak-fail"));
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("src/ui/overlay-mount.ts");
    expect(files).toContain("src/ui/adopted-sheet.ts");
  });

  it("MUST_PASS: style appended to a shadow root, or adopted on a shadow root", async () => {
    const result = await shadowDomStyleLeak.run(join(FIXTURES, "shadow-dom-style-leak-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no src/content, src/ui or ui root -> inconclusive, never a silent pass", async () => {
    const result = await shadowDomStyleLeak.run(join(FIXTURES, "shadow-dom-style-leak-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings).toEqual([]);
    expect(result.inconclusive.length).toBeGreaterThan(0);
  });

  it("MUST_PASS: the trigger pattern appears only inside a quoted string literal (log message / help copy), never executes — same defect class already closed in hook-deps-incomplete", async () => {
    const result = await shadowDomStyleLeak.run(join(FIXTURES, "shadow-dom-style-leak-pass"));
    expect(result.verdict).toBe("pass");
    const files = result.findings.map((f) => f.file);
    expect(files).not.toContain("src/content/cs.ts");
    expect(files).not.toContain("src/ui/panel.tsx");
  });
});

describe("dogfood: hook-effect-cleanup-missing", () => {
  it("MUST_BLOCK: useEffect adds a listener and returns no cleanup function", async () => {
    const result = await hookEffectCleanupMissing.run(join(FIXTURES, "hook-effect-cleanup-missing-fail"));
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("ui/UseEffectLeak.tsx");
    expect(result.findings[0]?.message).toContain("addEventListener");
  });

  it("MUST_PASS: symmetric add/remove, a pure effect with no resource acquisition, and a declared exception", async () => {
    const result = await hookEffectCleanupMissing.run(join(FIXTURES, "hook-effect-cleanup-missing-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no ui/ or src/ui root -> inconclusive", async () => {
    const result = await hookEffectCleanupMissing.run(join(FIXTURES, "hook-effect-cleanup-missing-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings).toEqual([]);
    expect(result.inconclusive.length).toBeGreaterThan(0);
  });

  it("MUST_PASS: the trigger shape appears only inside a quoted string literal (documentation/help copy), never executes — same defect class already closed in hook-deps-incomplete", async () => {
    const result = await hookEffectCleanupMissing.run(join(FIXTURES, "hook-effect-cleanup-missing-pass"));
    expect(result.verdict).toBe("pass");
    const files = result.findings.map((f) => f.file);
    expect(files).not.toContain("ui/panel.tsx");
    expect(files).not.toContain("ui/App.tsx");
  });
});

describe("dogfood: hook-deps-incomplete", () => {
  it("MUST_BLOCK: state value read inside useEffect body is missing from the dependency array", async () => {
    const result = await hookDepsIncomplete.run(join(FIXTURES, "hook-deps-incomplete-fail"));
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("ui/DepsMissing.tsx");
    expect(result.findings[0]?.message).toContain("count");
  });

  it("MUST_PASS: dependency listed, declared run-once exception, and setter-only usage", async () => {
    const result = await hookDepsIncomplete.run(join(FIXTURES, "hook-deps-incomplete-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_PASS: state identifier appears only inside a quoted string literal (DOM event name) inside the effect body — real case from gptpowerups-extension MediaActionBar.tsx/SlashTrigger.tsx", async () => {
    const result = await hookDepsIncomplete.run(join(FIXTURES, "hook-deps-incomplete-pass"));
    expect(result.verdict).toBe("pass");
    const files = result.findings.map((f) => f.file);
    expect(files).not.toContain("ui/DepsStringLiteralOnly.tsx");
  });

  it("MUST_REFUSE: no ui/ or src/ui root -> inconclusive", async () => {
    const result = await hookDepsIncomplete.run(join(FIXTURES, "hook-deps-incomplete-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings).toEqual([]);
    expect(result.inconclusive.length).toBeGreaterThan(0);
  });
});

describe("dogfood: render-side-effect-impure", () => {
  it("MUST_BLOCK: localStorage write directly in the component's render body", async () => {
    const result = await renderSideEffectImpure.run(join(FIXTURES, "render-side-effect-impure-fail"));
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("ui/ImpureRender.tsx");
  });

  it("MUST_PASS: the same write moved into useEffect and into an event handler", async () => {
    const result = await renderSideEffectImpure.run(join(FIXTURES, "render-side-effect-impure-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no ui/ or src/ui root -> inconclusive", async () => {
    const result = await renderSideEffectImpure.run(join(FIXTURES, "render-side-effect-impure-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings).toEqual([]);
    expect(result.inconclusive.length).toBeGreaterThan(0);
  });
});
