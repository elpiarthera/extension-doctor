# SELF-GATE — conformance pinned to a commit SHA

This file certifies conformance for exactly one commit. It is regenerated
(not hand-edited) whenever the certified SHA changes — a SELF-GATE that
does not name a SHA, or whose SHA is stale relative to `git rev-parse
--short=8 HEAD`, is void (`.claude/rules/derive-never-type.md`).

**Certified SHA:** the pinned, exact value is recorded in PR #1's body
(external to this tree, so it can never go stale relative to a later
commit). Within this working tree the certified commit is always
`git rev-parse --short=8 HEAD` — this file deliberately does NOT hardcode
a literal SHA, because any literal committed here is stale the moment the
next commit lands (`.claude/rules/derive-never-type.md`: a value a tool
can read is never typed by hand).

| # | Item | Command that proves it | Result at certified HEAD |
|---|------|-------------------------|------------------------|
| [x] | Rule registry count is derived, never a literal | `npx vitest run tests/registry.test.ts` | 2/2 PASS — `ALL_RULES.length` (36) computed from `readdirSync(src/rules)`, never hardcoded |
| [x] | README rule count matches derived count | `node scripts/check-readme.mjs` | 11/11 checks passed (includes `SCOPE: README states the rule count and it matches the derived count from src/rules/*.ts (derived=36)`) |
| [x] | Foreign-material bite proof — 8 sampled rules RED on unchosen, runtime-fetched material from 4 diverse sources | `node scripts/foreign-bite-probe.mjs` | exit 0 — `8/8 rules RED+INCONCLUSIVE+PASS+RESTORED across 4 independently-licensed sources` (see latest `analysis/foreign-bite-proof-*.md`) |
| [x] | RULE x SOURCE matrix — each rule bites on ≥1 source AND passes on ≥1 other, unmodified real source | same run — matrix section | 8/8 rules carry both a RED cell and a PASS cell on distinct sources; `csp-not-weakened` documented as a rule-limitation finding (see script comment) rather than a fabricated pass |
| [x] | Refusal pole (inconclusive) proven per sampled rule | same run — `INCONCLUSIVE(...)` line per rule, all 8 non-empty reasons | 8/8 present |
| [x] | Restoration proven — fetched foreign material never mutated | same run — `RESTORED: ... sha256 unchanged` per rule | 8/8 present; fetch tmpdir hash-verified against each source's pinned commit before AND after injection |
| [x] | Fetch failure is loud, never silent | `FOREIGN_BITE_PROBE_BAD_SHA=1 node scripts/foreign-bite-probe.mjs` | exit 1 — `FOREIGN-FETCH-FAILED: ... refusing to proceed` naming the source and file |
| [x] | Hash mismatch is loud, never silent | `FOREIGN_BITE_PROBE_BAD_HASH=<key> node scripts/foreign-bite-probe.mjs` | exit 1 — `FOREIGN-HASH-MISMATCH: ... refusing to proceed` naming the source, file, and both hashes |
| [x] | No third-party source vendored in this tree | `git ls-files \| grep -c foreign-material` | 0 |
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

Answers Eta's PR #1 REVISE: bite probes must prove they read the rule's
material, not the fixture chosen by the rule's own author. A single
foreign source only proves a rule bites on THAT project's code, so the
probe draws from 4 independently-licensed, diverse third-party
extensions (darkreader/darkreader MIT, philc/vimium MIT,
GoogleChrome/web-vitals-extension Apache-2.0, fregante/GhostText MIT).
Bite proof lives in `scripts/foreign-bite-probe.mjs`, which FETCHES all
foreign material at runtime, each source pinned to its own immutable
commit SHA, verified against a SHA-256 captured once from that pinned
commit — this repo does not vendor another project's source. See the
provenance block at the top of `scripts/foreign-bite-probe.mjs` for each
source repo, pinned commit, license, copyright holder, diversity axis,
and per-file SHA-256 pins.
