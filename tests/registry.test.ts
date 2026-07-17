import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_RULES } from "../src/rules/index.js";

const RULES_DIR = join(import.meta.dirname, "..", "src", "rules");

describe("registry — ALL_RULES must mirror src/rules/*.ts (derived, never a literal)", () => {
  it("MUST_PASS: ALL_RULES.length equals the number of rule files on disk (excluding index.ts)", () => {
    const fileCount = readdirSync(RULES_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts").length;
    expect(ALL_RULES.length).toBe(fileCount);
  });

  it("MUST_PASS: every rule id is unique", () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
