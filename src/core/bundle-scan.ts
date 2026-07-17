/**
 * bundle-scan — read built bundle (dist/**) files as text for grep-based
 * rules. Consumes the `buildDir` produced by requireFreshBuild() —
 * callers MUST check build-precondition first; this module does not itself
 * decide pass/fail/inconclusive.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walk } from "./walk.js";

export interface BundleFile {
  /** Path relative to buildDir. */
  relPath: string;
  /** Absolute path on disk. */
  absPath: string;
}

/**
 * List bundle files (.js/.mjs) under buildDir. Reuses walk() with an
 * explicit extensions filter — note walk()'s DEFAULT_IGNORE set skips
 * "dist"/"build" DIRECTORY NAMES when walking a repo root, but here
 * buildDir IS the dist/build directory itself, so walk() recurses inside
 * it normally (the ignore list only matches child directory names, and a
 * nested "dist" or "build" folder inside a build output is not expected in
 * this project's layout).
 */
export function listBundleFiles(buildDir: string): BundleFile[] {
  const relPaths = walk(buildDir, { extensions: [".js", ".mjs"] });
  return relPaths.map((relPath) => ({ relPath, absPath: join(buildDir, relPath) }));
}

/**
 * Read a bundle file as text. Throws if unreadable — callers should wrap in
 * try/catch and emit an InconclusiveReason naming the file, per the "loud
 * refusal, never silent" contract (see core/types.ts).
 */
export function readBundleFile(file: BundleFile): string {
  return readFileSync(file.absPath, "utf8");
}
