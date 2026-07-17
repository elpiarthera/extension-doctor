# Not statically detectable — three doctrine-native rules documented as honest impossibilities (v0.1)

This document is the demonstration that folds into the README's "Not statically detectable"
section. Each entry below corresponds to a rule stub in `src/rules/` that ALWAYS returns
`verdict: "inconclusive"` with a precise, non-empty reason — never a silent pass. The stub exists
so the rule participates honestly in the pack's active-rule count (visible in
`ProvenanceEnvelope.perRule` and `scope.rulesActive`) instead of being omitted, which would make
its absence invisible.

Source: `docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md` §1.5 and §4.

---

## coexistence-collision

**Stub**: `src/rules/coexistence-collision.ts`

**What it would detect**: two contradictory tests on the same logical element, written at
different dates, where the most recent test silently wins and the older, still-nominally-passing
assertion is never re-checked against the new code path.

**Concrete example that escapes static analysis**: a test written on Day 67 asserts
`expect(getByRole("checkbox")).toBeChecked()` for a settings toggle. Five weeks later, on Day 92,
a refactor (`D92-T5`) replaces the checkbox with a styled `<button role="switch">`. A NEW test is
written asserting `expect(getByRole("switch")).toHaveAttribute("aria-checked", "true")`. Both
tests pass — the old one because the DOM still happens to expose a stray `role="checkbox"` element
elsewhere on the page (a leftover from a different component), the new one because it targets the
actual replaced control. Nothing textually links the two tests: no shared selector string, no
shared file, no shared date-adjacent commit that a diff-based heuristic could catch. The collision
is only visible to a human who knows both tests are "about the same settings toggle" — a semantic
fact, not a syntactic one.

**Why static analysis is insufficient**: deciding "these two tests target the same logical
element" requires semantic cross-file matching (matching intent, not literal strings), plus a
calibration corpus large enough to bound the false-positive rate against components that
legitimately have two render modes (e.g. a desktop checkbox and a mobile switch for the SAME
setting, which is NOT a collision). No such matching engine or calibration corpus exists in this
pipeline today. A first-jet heuristic would produce an unacceptably high false-positive/false-
negative rate without it (doctrine `hook-vitality-bite-probe.md`: "un garde qui bloque tout obtient
un score parfait sur une sonde uni-polaire — et se fait désactiver dans la semaine").

---

## test-cannot-fail

**Stub**: `src/rules/test-cannot-fail.ts`

**What it would detect**: a test whose assertion is structurally incapable of ever going red,
regardless of the correctness of the code under test.

**Concrete example that escapes static analysis**: a test mocks `chrome.storage.local.get` to
always resolve `{ theme: "dark" }`, then asserts `expect(result.theme).toBe("dark")`. Syntactically
this assertion CAN fail (it's a real `expect(...).toBe(...)` call, not `expect(true).toBe(true)` —
the pattern a naive syntactic scanner would catch). But because the mock's return value is fixed
and the code under test simply forwards whatever the mock returns, the assertion will pass no
matter what bug is introduced in the surrounding logic (e.g. deleting the `if (theme === "dark")`
branch entirely). A syntactic scan sees a legitimate-looking assertion and passes it; the assertion
is nonetheless dead weight.

**Why static analysis is insufficient**: a syntactic scan for jsdom/`chrome.*` mock density is
mechanical but produces two failure modes at once — false positives on legitimate jsdom tests over
pure functions (explicitly authorized by CLAUDE.md RULE #8, "jsdom réservé aux pure functions"),
and false negatives on assertions like the one above, which are syntactically well-formed but
runtime-dead. The only definitive proof is a bipolar mutation probe: inject a real defect into the
code under test (on matériau étranger — code the probe author did not write, per
`derive-never-type.md` §"La sonde bipolaire NE SUFFIT PAS") and confirm the test goes red.
Mutation-testing infrastructure over third-party/host code (`chrome.*`, DOM APIs) does not exist
in this pipeline yet.

---

## verified-not-activated

**Stub**: `src/rules/verified-not-activated.ts`

**What it would detect**: a correctif reported "shipped" with no proof that the version carrying
it is the one actually being served to users.

**Concrete example that escapes static analysis**: commit `abc1234` merges a fix to `main`. CI
runs green. A status message announces "fix shipped, awaiting review". But the deployed bundle
(Chrome Web Store artifact, or a self-hosted `dist/chrome.zip`) was built from a PRIOR commit and
never rebuilt/republished — the fix exists in the git history but is not in the artifact users
run. Cross-ref `derive-never-type.md` §"Corollaire — publié ≠ livré": `npm publish --tag alpha`
put a new version on the registry WITHOUT moving `latest`; every downstream consumer kept
resolving the stale version while the team's own reporting said "shipped". The git log, the CI
run, and the "shipped" status message are all individually true and collectively misleading.

**Why static analysis is insufficient**: comparing "the fix that shipped in this commit" against
"the build actually served" is mechanical IN PRINCIPLE — it only requires a build-hash embedded at
build time (e.g. a `BUILD_HASH` constant derived from the git SHA, injected via `vite.config.ts`)
and re-read from the served artifact at verification time. That convention does not exist in this
pipeline's `vite.config.ts` today (not re-verified as present — see matrix §7, "non re-vérifié
dans vite.config.ts par T0"). Even once it exists, a legitimate deploy-propagation window (CDN
cache, extension store review delay) requires a documented temporal tolerance so the rule does not
fire false-positive during a normal, in-flight rollout. Neither the build-hash convention nor the
temporal-tolerance policy exists yet — shipping a verdict without both would be a guess dressed as
a measurement.

---

## Doctrine cross-reference

All three stubs above follow `derive-never-type.md`'s "Bannis" list: none of them silently return
`[]`/pass when the precondition cannot be resolved — they always return `verdict: "inconclusive"`
with a reason string naming precisely what is missing, per `RuleResult.inconclusive` /
`InconclusiveReason.reason` ("MUST name precisely what could not be read — never a generic
'internal error'", `src/core/types.ts`). This keeps them visible in `ProvenanceEnvelope.perRule`
and counted in `scope.rulesActive` without ever inflating or deflating `score` (see
`src/core/run.ts`'s `measured` filter, which excludes `inconclusive` results from the pass-ratio
numerator/denominator on purpose).
