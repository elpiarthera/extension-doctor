import type { Rule } from "../core/types.js";
import { netBroadcastUnfiltered } from "./net-broadcast-unfiltered.js";
import { i18nKeyCoverageGap } from "./i18n-key-coverage-gap.js";
import { swContextInvalidatedGuard } from "./sw-context-invalidated-guard.js";

/**
 * MVP rule set. Two rules shipped (net-broadcast-unfiltered,
 * i18n-key-coverage-gap) are the priority-1 minimum from the dispatch
 * brief. sw-context-invalidated-guard (priority 2) is also included.
 *
 * NOT shipped in this MVP pass (documented, not silently dropped):
 *   - unused-file-export (requires cross-file export-usage analysis)
 *   - custom-element-orphan-registration (requires a fresh vite build
 *     artifact under dist/chrome/** as its own precondition)
 */
export const ALL_RULES: Rule[] = [netBroadcastUnfiltered, i18nKeyCoverageGap, swContextInvalidatedGuard];

export function resolveRules(requested: string[] | null): { active: Rule[]; unknown: string[] } {
  if (requested === null) return { active: ALL_RULES, unknown: [] };
  const byId = new Map(ALL_RULES.map((r) => [r.id, r]));
  const active: Rule[] = [];
  const unknown: string[] = [];
  for (const id of requested) {
    const rule = byId.get(id);
    if (rule) active.push(rule);
    else unknown.push(id);
  }
  return { active, unknown };
}
