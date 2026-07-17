# SELF-GATE — conformance pinned to a commit SHA

This file certifies conformance for exactly one commit. It is regenerated
(not hand-edited) whenever the certified SHA changes — a SELF-GATE that
does not name a SHA, or whose SHA is stale relative to `git rev-parse
--short=8 HEAD`, is void (`.claude/rules/derive-never-type.md`).

**Certified SHA:** `e8223b89` (this branch, `chi/d137-foreign-bite-proof`,
tip at the time this file was written — re-verify with `git rev-parse
--short=8 HEAD` before trusting any checkbox below).

| # | Item | Command that proves it | Result at `e8223b89` |
|---|------|-------------------------|------------------------|
| [x] | Rule registry count is derived, never a literal | `npx vitest run tests/registry.test.ts` | 2/2 PASS — `ALL_RULES.length` (36) computed from `readdirSync(src/rules)`, never hardcoded |
| [x] | README rule count matches derived count | `node scripts/check-readme.mjs` | 11/11 checks passed (includes `SCOPE: README states the rule count and it matches the derived count from src/rules/*.ts (derived=36)`) |
| [x] | Foreign-material bite proof — 8 sampled rules RED on unchosen material | `node scripts/foreign-bite-probe.mjs` | exit 0 — `8/8 rules RED+INCONCLUSIVE+RESTORED on foreign material` (see `analysis/foreign-bite-proof-e8223b89.md`) |
| [x] | Refusal pole (inconclusive) proven per sampled rule | same run — `INCONCLUSIVE(...)` line per rule, all 8 non-empty reasons | 8/8 present |
| [x] | Restoration proven — committed foreign material never mutated | same run — `RESTORED: ... git diff --stat empty` per rule | 8/8 present; `git diff --stat -- scripts/foreign-material/` also empty standalone |
| [x] | 3 static-impossible rules demonstrated (not asserted) | `docs/not-statically-detectable.md` §coexistence-collision, §test-cannot-fail, §verified-not-activated | each section carries a concrete falsifying input + why "inconclusive" is the correct 3rd state |
| [x] | Full suite green | `npx vitest run` | 117/117 tests passed, 12/12 files |
| [x] | Typecheck clean | `npm run build` (`tsc -p tsconfig.json`) | 0 errors |

## How to re-verify this file against a different SHA

```
git rev-parse --short=8 HEAD   # compare against "Certified SHA" above — if different, this file is STALE, do not trust it
npm run build && npx vitest run
node scripts/check-readme.mjs
node scripts/foreign-bite-probe.mjs
```

If any command's result diverges from the table, the table is wrong for
the current HEAD — do not patch the table by hand; re-run this checklist
and rewrite the file (or note the regression loudly).

## Cross-ref

Answers Eta's PR #1 REVISE: "Tes sondes mordent sur matériau que TU
choisis => prouve que les règles lisent leurs fixtures, pas la classe."
Bite proof lives in `scripts/foreign-bite-probe.mjs` +
`scripts/foreign-material/mem0-chrome-extension/PROVENANCE.md` (real,
third-party, MIT, pinned-commit source files never used as any rule's own
fixture).
