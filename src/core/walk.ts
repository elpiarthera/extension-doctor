/**
 * Minimal recursive file walker — zero heavy dependency, TypeScript strict,
 * Node/Bun compatible.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DEFAULT_IGNORE = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".claude",
  "qa",
  "scripts",
  "tests",
  ".claude-worktrees",
  "worktrees",
]);

export interface WalkOptions {
  /** Directory names to skip entirely (in addition to the default ignore set). */
  extraIgnore?: string[];
  /** Only return files whose extension (with leading dot) is in this list. */
  extensions?: string[];
}

/**
 * Walk `root` recursively and return paths relative to `root`.
 * Never throws on a missing root — callers are responsible for the
 * "precondition missing -> INCONCLUSIVE" contract described in the rule pack.
 */
export function walk(root: string, options: WalkOptions = {}): string[] {
  const ignore = new Set([...DEFAULT_IGNORE, ...(options.extraIgnore ?? [])]);
  const results: string[] = [];

  function visit(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.has(entry)) continue;
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        visit(full);
      } else if (st.isFile()) {
        if (options.extensions) {
          const ext = extOf(entry);
          if (!options.extensions.includes(ext)) continue;
        }
        results.push(relative(root, full));
      }
    }
  }

  visit(root);
  return results;
}

function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx);
}

export function dirExists(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function fileExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
