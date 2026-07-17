/**
 * Unit tests for the shared infra core helpers (export-graph,
 * build-precondition, bundle-scan) added for T2b wave1. Fixtures live under
 * tests/fixtures/infra/**, each carrying a "synthetic infra fixture, not
 * from product history" provenance comment — these are tiny inline fixtures
 * purpose-built to exercise the helper contracts, not extracted from real
 * product code (unlike tests/dogfood.test.ts fixtures).
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildExportGraph } from "../src/core/export-graph.js";
import { requireFreshBuild } from "../src/core/build-precondition.js";
import { listBundleFiles, readBundleFile } from "../src/core/bundle-scan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures/infra");

describe("export-graph", () => {
  it("resolves a 2-file import chain from manifest.json service_worker entry, marking the orphan unreachable", () => {
    const root = join(FIXTURES, "export-graph-chain");
    const result = buildExportGraph(root);

    expect(result.unresolvedEntryReason).toBeNull();
    expect(result.reachableFiles.has("src/entry.ts")).toBe(true);
    expect(result.reachableFiles.has("src/helper.ts")).toBe(true);
    // The unimported file must NOT be in the reachable set — this is the
    // whole point of the reachability graph.
    expect(result.reachableFiles.has("src/orphan.ts")).toBe(false);
    // But it must still show up in allSourceFiles (walked, not filtered).
    expect(result.allSourceFiles).toContain("src/orphan.ts");
  });

  it("LOUD REFUSAL: returns a non-null, specific unresolvedEntryReason when no manifest.json and no vite config exist", () => {
    const root = join(FIXTURES, "export-graph-unresolved");
    const result = buildExportGraph(root);

    // Non-empty, specific reason string — not just truthy. Must name what
    // was checked (manifest.json + vite config candidates), per
    // derive-never-type.md ("fail bruyamment en nommant ce qu'il n'a pas su lire").
    expect(result.unresolvedEntryReason).not.toBeNull();
    expect(typeof result.unresolvedEntryReason).toBe("string");
    expect(result.unresolvedEntryReason!.length).toBeGreaterThan(20);
    expect(result.unresolvedEntryReason).toContain("manifest.json");
    expect(result.unresolvedEntryReason).toContain("vite.config");
    // Fail-open trap check: reachableFiles must be empty-by-construction,
    // never silently treated as "clean" — verified here by pairing with the
    // non-null reason above (an empty set alone would be ambiguous).
    expect(result.reachableFiles.size).toBe(0);
  });
});

describe("build-precondition", () => {
  it("LOUD REFUSAL: returns ok:false with a precise reason on a dir with no dist output", () => {
    const root = join(FIXTURES, "build-none");
    const result = requireFreshBuild(root);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Non-empty, specific reason string — not just truthy. Names exactly
      // which dirs were checked, per the brief's contract.
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(20);
      expect(result.reason).toContain("dist/chrome");
      expect(result.reason).toContain("dist");
      expect(result.reason).toContain("build");
    }
  });

  it("returns ok:true on a dir containing dist/chrome/x.js", () => {
    const root = join(FIXTURES, "build-present");
    const result = requireFreshBuild(root);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.buildDir).toContain("dist/chrome");
    }
  });
});

describe("bundle-scan", () => {
  it("lists and reads bundle files from a buildDir produced by requireFreshBuild", () => {
    const root = join(FIXTURES, "build-present");
    const precondition = requireFreshBuild(root);
    expect(precondition.ok).toBe(true);
    if (!precondition.ok) return;

    const files = listBundleFiles(precondition.buildDir);
    expect(files.length).toBe(1);
    expect(files[0].relPath).toBe("x.js");

    const content = readBundleFile(files[0]);
    expect(content).toContain("export const x = 1;");
  });
});
