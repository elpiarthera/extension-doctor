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

**Falsifying input — demonstration, not assertion**: consider a purely syntactic rule that flags
"same `getByRole(...)` argument string appearing in two different `it()` blocks, closest-file-match
by name similarity, most recent commit wins." Feed it two inputs and watch it get BOTH directions
wrong:

- *False fail*: `Settings.test.tsx` has `it("shows checkbox state")` using
  `getByRole("checkbox")` for the color-scheme toggle, and a SEPARATE, unrelated
  `it("renders legacy banner checkbox")` also using `getByRole("checkbox")` for a dismissible
  banner that happens to also be a checkbox. Same role string, same file, adjacent lines — the
  syntactic rule flags a "collision" between two tests that are not about the same logical element
  at all. A human (or a semantic matcher with intent-embedding) sees two independent controls; the
  string matcher cannot.
- *False pass*: the Day 67 → Day 92 example above (checkbox → `role="switch"` refactor) uses
  **different** selector strings (`"checkbox"` vs `"switch"`) precisely because the refactor
  changed the DOM shape — which is the exact case that needs flagging. The syntactic rule's
  same-string-required trigger condition never fires, so the real collision passes silently.

A tool that tried to decide statically would therefore either flag legitimate independent controls
(false fail, eroding trust, leading to the rule being disabled within a week per the bite-probe
doctrine) or miss the actual semantic collision it exists to catch (false pass, the worse failure
mode since it is silent). **`inconclusive` is the only verdict that does not lie in either
direction** — it names precisely what is missing (a semantic intent-matching engine + calibration
corpus) rather than guessing and being wrong roughly half the time by construction.

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

**Falsifying input — demonstration, not assertion**: consider a purely syntactic rule that flags
"any `it()` block whose body calls a mocked `chrome.*` API and asserts on the literal value the
mock was configured to return" (a mock-density heuristic). Feed it two inputs:

- *False fail*: `tests/unit/theme-resolver.test.ts` mocks `chrome.storage.local.get` to resolve
  `{ theme: "dark" }`, then calls `resolveTheme(mockGet)` — a PURE function that branches on the
  input (`if (theme === "dark") return DARK_PALETTE; else return LIGHT_PALETTE;`) — and asserts
  `expect(resolveTheme(mockGet)).toEqual(DARK_PALETTE)`. This assertion CAN and DOES fail if the
  branch is deleted (verified: injecting `return LIGHT_PALETTE` unconditionally into
  `resolveTheme` turns this test red). The syntactic rule sees "mocked chrome.* + assertion on the
  mocked value" and flags it as tautological — a false fail on a legitimate, mutation-sensitive
  test.
- *False pass*: the example in the paragraph above — the test asserts `result.theme === "dark"`
  where `result` is the UNMODIFIED mock return value forwarded verbatim, with no branch of
  application logic in between. The syntactic rule's trigger condition ("mocked chrome.* +
  assertion") is IDENTICAL in shape to the false-fail case above — same call pattern, same
  assertion shape — so any static rule permissive enough to pass the theme-resolver test (true
  positive: it should stay green) is by construction also permissive enough to pass this dead
  assertion (false pass: it should be flagged).
- Both inputs produce the SAME syntactic fingerprint (`mock chrome.* → assert on returned value`)
  and OPPOSITE correct verdicts. No syntactic threshold, however tuned, separates them — only
  runtime mutation (does the assertion actually go red when a real defect is injected into the
  code path between the mock and the assertion) distinguishes "tautological" from "legitimate."

`inconclusive` is correct here because the rule literally cannot compute, from source text alone,
whether application logic sits between a mock's return value and the assertion — that requires
running a mutation and observing red/green, which is a DIFFERENT kind of proof than static
analysis produces (the same distinction `derive-never-type.md` makes for `hook-vitality-bite-probe`
gates: "la sonde bipolaire seule ne suffit pas... la seule preuve qu'un garde mord: une violation
injectée dans du code qu'il n'a PAS choisi").

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

**Falsifying input — demonstration, not assertion**: consider a purely static rule that flags
"verified-not-activated" whenever `git log -1 --format=%ci` on the latest commit touching
`src/background/service-worker.ts` is older than the latest `dist/chrome.zip` mtime (a
commit-vs-artifact freshness heuristic requiring no build-hash convention at all). Feed it two
real-shaped inputs:

- *False fail*: a maintainer runs `npm run build` locally at 14:02 to sanity-check a docs-only
  commit from 14:00 (touches only `README.md`, not `service-worker.ts`). `dist/chrome.zip`'s mtime
  (14:02) is now newer than `service-worker.ts`'s last real content change (say, 09:15 that
  morning) — the freshness heuristic reads this as "artifact is fresh, verdict: activated" even
  though NO fix was rebuilt-and-republished to the Chrome Web Store; the local `dist/` rebuild
  never left the maintainer's machine. Flagging this as "activated" is a false pass in the OTHER
  direction from the rule's own name — it under-reports risk by trusting a local mtime that says
  nothing about what users are actually running.
- *False fail (opposite polarity)*: a legitimate, already-published fix ships at Day 100. CI
  archives `dist/chrome.zip` as a build artifact and deletes the local `dist/` directory
  (standard cleanup). A later `git clone` + `npm install` on a fresh machine produces a `dist/`
  directory whose mtime is the CLONE time, not the original build time — always "older" than
  whatever commit is checked out, regardless of whether that fix is live in the Chrome Web Store or
  not. The freshness heuristic now ALWAYS reports "not activated" post-clone, even for fixes that
  have been live in production for months — a permanent false fail baked into the act of cloning.

Both failure directions come from the same root cause a static rule cannot escape: filesystem
mtimes describe the LOCAL WORKING COPY's history, not "what a Chrome Web Store user's installed
extension is currently running." Only an artifact-embedded build hash, cross-checked against the
git SHA the store review approved (a fact that lives OUTSIDE this repository, in the Chrome Web
Store dashboard / a deploy log), can answer the question honestly — and even then only within a
declared propagation-delay tolerance. Guessing from mtimes produces a confident-sounding verdict
that is wrong in both directions depending on entirely incidental local filesystem state; that is
strictly worse than `inconclusive`, which at least names the missing convention instead of
asserting a false freshness signal.

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
