/**
 * export-graph — cross-file import/export reachability from Vite / manifest
 * entry points.
 *
 * No full TypeScript AST parser is used (regex on stripComments output,
 * as in every other rule in this pack) — sufficient for well-formatted
 * TS/TSX source, not a general-purpose bundler.
 *
 * NEVER returns an empty reachableFiles set silently as "nothing
 * reachable" when entry points could not be resolved at all — that is the
 * fail-open trap banned by docs/analysis matrix §1.5 and
 * .claude/rules/derive-never-type.md ("if (rien_trouvé) return []" is
 * banned). When no entry point can be resolved, `unresolvedEntryReason`
 * names EXACTLY what was missing, and callers MUST convert that into an
 * InconclusiveReason rather than treating reachableFiles as meaningful.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { walk, fileExists } from "./walk.js";
import { stripComments } from "./text.js";

export interface ExportGraphResult {
  /** Files (relative to extensionRoot) transitively reachable from resolved entry points. */
  reachableFiles: Set<string>;
  /** All .ts/.tsx/.js/.jsx source files found under extensionRoot (relative paths). */
  allSourceFiles: string[];
  /**
   * Non-null iff NO entry point could be resolved at all — names exactly
   * what was checked and missing (manifest.json, vite config). When this is
   * non-null, `reachableFiles` is EMPTY BY CONSTRUCTION and must not be
   * read as "nothing is reachable"; callers must surface this as
   * inconclusive, never as a passing/clean result.
   */
  unresolvedEntryReason: string | null;
}

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const RESOLVE_CANDIDATES = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

const MANIFEST_CANDIDATES = ["manifest.json", "public/manifest.json", "src/manifest.json"];
const VITE_CONFIG_CANDIDATES = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"];

/**
 * Build the transitive import closure of `extensionRoot` starting from
 * manifest.json entry points (background.service_worker,
 * content_scripts[].js, action.default_popup) and/or a discovered Vite
 * config's declared inputs (best-effort regex extraction of `input:` /
 * string literals ending in a source extension inside the config file —
 * this is NOT a full Vite config evaluator).
 */
export function buildExportGraph(extensionRoot: string): ExportGraphResult {
  const allSourceFiles = walk(extensionRoot, { extensions: SOURCE_EXTENSIONS });

  const entryPointsAbs = new Set<string>();
  const checked: string[] = [];

  // 1. manifest.json entry points
  let manifestPath: string | null = null;
  for (const candidate of MANIFEST_CANDIDATES) {
    const abs = join(extensionRoot, candidate);
    checked.push(candidate);
    if (fileExists(abs)) {
      manifestPath = abs;
      break;
    }
  }

  if (manifestPath) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const manifestDir = dirname(manifestPath);
      const swPath = manifest?.background?.service_worker;
      if (typeof swPath === "string") {
        addResolvedEntry(entryPointsAbs, manifestDir, swPath);
      }
      const contentScripts = Array.isArray(manifest?.content_scripts) ? manifest.content_scripts : [];
      for (const cs of contentScripts) {
        const jsFiles = Array.isArray(cs?.js) ? cs.js : [];
        for (const js of jsFiles) {
          if (typeof js === "string") addResolvedEntry(entryPointsAbs, manifestDir, js);
        }
      }
      const popupPath = manifest?.action?.default_popup;
      if (typeof popupPath === "string") {
        addResolvedEntry(entryPointsAbs, manifestDir, popupPath);
      }
    } catch {
      // Malformed manifest — fall through, treat as if not found for entry
      // resolution purposes (checked[] already recorded the attempt).
    }
  }

  // 2. Vite config declared inputs (best-effort — regex over stripped comments)
  let viteConfigPath: string | null = null;
  for (const candidate of VITE_CONFIG_CANDIDATES) {
    const abs = join(extensionRoot, candidate);
    checked.push(candidate);
    if (fileExists(abs)) {
      viteConfigPath = abs;
      break;
    }
  }

  if (viteConfigPath) {
    try {
      const content = stripComments(readFileSync(viteConfigPath, "utf8"));
      const configDir = dirname(viteConfigPath);
      const literalRe = /["'`]([^"'`]+\.(?:ts|tsx|js|jsx|html))["'`]/g;
      let m: RegExpExecArray | null;
      while ((m = literalRe.exec(content)) !== null) {
        const literal = m[1]!;
        if (literal.startsWith(".") || literal.startsWith("/")) {
          addResolvedEntry(entryPointsAbs, configDir, literal.replace(/\.html$/, ".ts"));
        }
      }
    } catch {
      // Unreadable vite config — treated same as "not found" for entry purposes.
    }
  }

  if (entryPointsAbs.size === 0) {
    return {
      reachableFiles: new Set(),
      allSourceFiles,
      unresolvedEntryReason: `no resolvable entry point: checked ${checked.join(", ")} — none exist or none yielded a resolvable source entry`,
    };
  }

  // 3. BFS transitive import closure
  const reachableAbs = new Set<string>();
  const queue: string[] = [...entryPointsAbs];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (reachableAbs.has(current)) continue;
    if (!existsSync(current)) continue;
    reachableAbs.add(current);

    let content: string;
    try {
      content = stripComments(readFileSync(current, "utf8"));
    } catch {
      continue;
    }

    const importRe = /(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(content)) !== null) {
      const spec = m[1]!;
      if (!spec.startsWith(".") && !spec.startsWith("/")) continue; // skip bare/node-module specifiers
      const resolved = resolveImport(dirname(current), spec);
      if (resolved && !reachableAbs.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  const reachableFiles = new Set<string>();
  for (const abs of reachableAbs) {
    reachableFiles.add(relative(extensionRoot, abs));
  }

  return { reachableFiles, allSourceFiles, unresolvedEntryReason: null };
}

function addResolvedEntry(set: Set<string>, baseDir: string, relPath: string): void {
  const abs = resolve(baseDir, relPath);
  const resolved = resolveExisting(abs);
  if (resolved) set.add(resolved);
}

function resolveImport(fromDir: string, spec: string): string | null {
  const abs = resolve(fromDir, spec);
  return resolveExisting(abs);
}

function resolveExisting(absNoExt: string): string | null {
  if (fileExists(absNoExt)) return absNoExt;
  for (const suffix of RESOLVE_CANDIDATES) {
    const candidate = absNoExt.endsWith(suffix.slice(0, 1)) ? absNoExt : absNoExt + suffix;
    if (fileExists(candidate)) return candidate;
  }
  return null;
}
