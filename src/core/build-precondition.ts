/**
 * build-precondition — assert a fresh built bundle exists before any rule
 * scans dist/** output. Bundle-scanning rules MUST call this first and
 * convert an { ok: false } result into an InconclusiveReason with exit
 * code 2, rather than silently treating "no bundle" as a clean pass.
 */
import { join } from "node:path";
import { dirExists } from "./walk.js";
import { readdirSync, statSync } from "node:fs";

export type BuildPreconditionResult = { ok: true; buildDir: string } | { ok: false; reason: string };

const DEFAULT_OUT_DIR_CANDIDATES = ["dist/chrome", "dist", "build"];

/**
 * Walk() ignores "dist" and "build" by default (see walk.ts DEFAULT_IGNORE)
 * since those are normally build output that source-scanning rules must
 * skip. Bundle-scanning rules need the OPPOSITE — so this function does its
 * own directory listing rather than reusing walk() for the existence/.js
 * check, to avoid depending on walk()'s ignore list staying compatible.
 */
export function requireFreshBuild(
  extensionRoot: string,
  outDirCandidates: string[] = DEFAULT_OUT_DIR_CANDIDATES,
): BuildPreconditionResult {
  const checkedDirs: string[] = [];
  const existingButEmpty: string[] = [];

  for (const candidate of outDirCandidates) {
    const abs = join(extensionRoot, candidate);
    checkedDirs.push(candidate);
    if (!dirExists(abs)) continue;

    const jsFiles = listJsFilesRecursive(abs);
    if (jsFiles.length > 0) {
      return { ok: true, buildDir: abs };
    }
    existingButEmpty.push(candidate);
  }

  const emptyNote =
    existingButEmpty.length > 0 ? ` (${existingButEmpty.join(", ")} exist but contain no .js/.mjs files)` : "";

  return {
    ok: false,
    reason: `no built bundle: checked ${checkedDirs.join(", ")} — none exist or contain built output${emptyNote}`,
  };
}

function listJsFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  function visit(d: string): void {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(d, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) visit(full);
      else if (st.isFile() && (entry.endsWith(".js") || entry.endsWith(".mjs"))) results.push(full);
    }
  }
  visit(dir);
  return results;
}
