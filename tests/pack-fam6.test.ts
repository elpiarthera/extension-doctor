/**
 * Dogfood proof for the fam6 i18n + code-hygiene rule pack.
 *
 * Each rule gets MUST_BLOCK + MUST_PASS + MUST_REFUSE (tripolar) coverage,
 * mirroring tests/dogfood.test.ts's contract: verdict vocabulary is never
 * silently binary (core/types.ts "pass" | "fail" | "inconclusive").
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { i18nLocaleJsonValidity } from "../src/rules/i18n-locale-json-validity.js";
import { noGiantComponent } from "../src/rules/no-giant-component.js";
import { noBarrelImport } from "../src/rules/no-barrel-import.js";
import { styleFileKebabCase } from "../src/rules/style-file-kebab-case.js";
import { unusedFileExport } from "../src/rules/unused-file-export.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures/dogfood");

describe("dogfood: i18n-locale-json-validity", () => {
  it("MUST_BLOCK: flags reserved @@ key + undefined placeholder ref", async () => {
    const result = await i18nLocaleJsonValidity.run(join(FIXTURES, "i18n-locale-json-validity-fail"));
    expect(result.verdict).toBe("fail");
    const messages = result.findings.map((f) => f.message);
    expect(messages.some((m) => m.includes("@@extension_id") && m.includes("reserved"))).toBe(true);
    expect(messages.some((m) => m.includes("SCORE") && m.includes("not defined"))).toBe(true);
  });

  it("MUST_PASS: valid en/fr locale files produce no findings", async () => {
    const result = await i18nLocaleJsonValidity.run(join(FIXTURES, "i18n-locale-json-validity-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no _locales dir -> inconclusive, never a silent pass", async () => {
    const result = await i18nLocaleJsonValidity.run(join(FIXTURES, "i18n-locale-json-validity-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings).toEqual([]);
    expect(result.inconclusive.length).toBeGreaterThan(0);
    expect(result.inconclusive[0]?.reason).toContain("_locales");
  });
});

describe("dogfood: no-giant-component", () => {
  it("MUST_BLOCK: flags a 300+ line component file", async () => {
    const result = await noGiantComponent.run(join(FIXTURES, "no-giant-component-fail"));
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("ui/GiantComponent.tsx");
    expect(result.findings[0]?.message).toContain("300");
  });

  it("MUST_PASS: a short component is not flagged", async () => {
    const result = await noGiantComponent.run(join(FIXTURES, "no-giant-component-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no ui/ or src/ root -> inconclusive", async () => {
    const result = await noGiantComponent.run(join(FIXTURES, "no-giant-component-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings).toEqual([]);
    expect(result.inconclusive[0]?.reason).toContain("source root");
  });
});

describe("dogfood: no-barrel-import", () => {
  it("MUST_BLOCK: import resolving to an index.ts barrel with a direct module available", async () => {
    const result = await noBarrelImport.run(join(FIXTURES, "no-barrel-import-fail"));
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("src/consumer.ts");
  });

  it("MUST_PASS: direct module import is not flagged", async () => {
    const result = await noBarrelImport.run(join(FIXTURES, "no-barrel-import-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_PASS (allowlisted): a barrel declared in .extension-doctor.json allowedBarrels is not flagged", async () => {
    const result = await noBarrelImport.run(join(FIXTURES, "no-barrel-import-allowlisted"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no src/ or ui/ root -> inconclusive", async () => {
    const result = await noBarrelImport.run(join(FIXTURES, "no-barrel-import-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings).toEqual([]);
  });
});

describe("dogfood: style-file-kebab-case", () => {
  it("MUST_BLOCK: flags MultiStepOrchestrator.ts (REAL, dot-skills-proven filename)", async () => {
    const result = await styleFileKebabCase.run(join(FIXTURES, "style-file-kebab-case-fail"));
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("src/orchestration/MultiStepOrchestrator.ts");
  });

  it("MUST_PASS: multi-step-orchestrator.ts (kebab-case) is not flagged", async () => {
    const result = await styleFileKebabCase.run(join(FIXTURES, "style-file-kebab-case-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_PASS (exempted): Button.tsx under a declared pascalCaseDirs directory is not flagged", async () => {
    const result = await styleFileKebabCase.run(join(FIXTURES, "style-file-kebab-case-exempted"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no src/ or ui/ root -> inconclusive", async () => {
    const result = await styleFileKebabCase.run(join(FIXTURES, "style-file-kebab-case-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings).toEqual([]);
  });
});

describe("dogfood: unused-file-export", () => {
  it("MUST_BLOCK: flags a dead barrel not reachable from the manifest entry point", async () => {
    const result = await unusedFileExport.run(join(FIXTURES, "unused-file-export-fail"));
    expect(result.verdict).toBe("fail");
    const files = result.findings.map((f) => f.file);
    expect(files).toContain("src/components/dead-barrel.ts");
  });

  it("MUST_PASS: every file reachable from the manifest entry point", async () => {
    const result = await unusedFileExport.run(join(FIXTURES, "unused-file-export-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no manifest.json/vite.config resolvable -> inconclusive with unresolvedEntryReason, never a fail-open pass", async () => {
    const result = await unusedFileExport.run(join(FIXTURES, "unused-file-export-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings).toEqual([]);
    expect(result.inconclusive.length).toBeGreaterThan(0);
    expect(result.inconclusive[0]?.reason).toContain("no resolvable entry point");
  });
});
