# extension-doctor

A health linter for browser extensions (Manifest V3) that finds the bugs
that pass your demo and fail in the Chrome Web Store review: unfiltered
cross-tab broadcasts, missing i18n keys, invalidated-context crashes —
Chrome, Edge, Firefox, Brave.

## Why

**If you've just been rejected by the Chrome Web Store review, or you're
trying not to be** — this is for you. Manifest V3 extensions fail in ways
that never show up in a demo: a `chrome.tabs.query({})` with no `url:`
filter that quietly broadcasts to every open tab in the browser instead of
just the hosts the extension supports; an i18n key consumed via `t('key')`
in the UI but never added to `_locales/en/messages.json` or
`_locales/fr/messages.json`, so the user sees the raw key string instead of
a translated label; a `chrome.runtime.sendMessage(...)` call with no guard
against an invalidated extension context, throwing on the host page's
console after every reload or update while the tab stays open and looks
fine. None of these break the build. All three are common causes of Chrome
Web Store review rejections and silent production breakage.

**The thesis: one production friction resolved = one rule added.** No rule
in this pack is speculative — each was written after a real bug shipped,
not before one was imagined.

Concretely, extension-doctor found these three real bugs in our own shipped
extension, at these exact lines:

- `src/background/conversations-handler.ts:66` — `chrome.tabs.query({})`
  with no url filter feeding `chrome.tabs.sendMessage`
- `src/background/media-handler.ts:135` — same pattern
- `src/background/projects-handler.ts:67` — same pattern
- `src/background/messaging.ts:52` — `chrome.runtime.sendMessage(message)`
  with no try/catch and no `chrome.runtime.id` guard

## Proof, not promise

A linter that fails on everything proves nothing. This one is measured
bipolar, against real git history of a shipped extension — not a synthetic
fixture built to flatter the matcher.

**Before the fix**, run against the commit that shipped the bugs:

```
extension-doctor — command: extension-doctor /tmp/r-before
scope: 338 files scanned, rules 3/3 active
score: 0/100

[FAIL] net-broadcast-unfiltered (exit 1)
[INCONCLUSIVE] i18n-key-coverage-gap (exit 2)
[FAIL] sw-context-invalidated-guard (exit 1)

Findings:
  [error] net-broadcast-unfiltered — src/background/conversations-handler.ts:66
    chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.
    > chrome.tabs.query({})
  [error] net-broadcast-unfiltered — src/background/media-handler.ts:135
    chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.
    > chrome.tabs.query({})
  [error] net-broadcast-unfiltered — src/background/projects-handler.ts:67
    chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.
    > chrome.tabs.query({})
  [error] sw-context-invalidated-guard — src/background/messaging.ts:52
    chrome.runtime.sendMessage(...) called with no try/catch and no chrome.runtime.id guard — throws/rejects after every extension reload while the host tab stays open.
    > chrome.runtime.sendMessage(message);
```

**After the fix**, same tool, same rules, the commit that fixed
`net-broadcast-unfiltered`:

```
extension-doctor — command: extension-doctor /tmp/r-after
scope: 340 files scanned, rules 3/3 active
score: 50/100

[PASS] net-broadcast-unfiltered (exit 0)
[INCONCLUSIVE] i18n-key-coverage-gap (exit 2)
[FAIL] sw-context-invalidated-guard (exit 1)
```

Read that after-block carefully — this is the honesty this tool is built
around, not a marketing cut of it:

- `net-broadcast-unfiltered` goes from FAIL to PASS: the three unfiltered
  `chrome.tabs.query({})` call sites were fixed.
- `sw-context-invalidated-guard` **stays FAIL**. The fix that landed
  covered the messaging layer (`messaging.ts:52`), but other unguarded
  `chrome.runtime.sendMessage` call sites still exist elsewhere in the
  codebase. The score is 50/100, not 100/100, because the tool reports
  what is actually still broken, not what got fixed.
- `i18n-key-coverage-gap` stays **INCONCLUSIVE on both runs**, not PASS.
  One key is built dynamically — `` t(`media_type_${media.type}`) `` — and
  the rule cannot statically resolve the interpolated value to a literal
  key. Rather than guess, it reports exit code `2` and says so. A rule
  that silently treated "could not resolve" as "found nothing" would be a
  worse rule than no rule at all.

## Install

```
npm i -D extension-doctor
```

or run it directly without installing:

```
npx extension-doctor <path-to-extension> [--rules id1,id2,...] [--format human|json]
```

A reader can run this in under two minutes without opening a single source
file:

```
npx extension-doctor .
```

## Rules (36)

Table generated by `node scripts/gen-rules-table.mjs` (run `npm run build` first) — read
directly from `ALL_RULES` in `src/rules/index.ts`, never hand-typed, so it cannot drift from
the shipped registry.

| id | detects | severity |
|---|---|---|
| `banned-vulnerable-libs` | A dependency in package.json matches a small shipped blocklist of known-bad name+version pairs (e.g. event-stream@3.3.6, old lodash/jquery). Not a full CVE scanner — see in-file honest-scope note. | error |
| `coexistence-collision` | Documented impossible at v0.1: two contradictory tests on the same logical element at different dates, most recent silently winning. Requires semantic cross-file matching + a calibration corpus that does not exist yet. | warning |
| `content-script-file-exists` | manifest.json content_scripts[].js[] references a file absent from the delivered package. | error |
| `csp-not-weakened` | manifest.json content_security_policy.extension_pages reintroduces unsafe-eval or a remote script source — weakens the MV3 implicit-default CSP. | error |
| `custom-element-orphan-registration` | A custom element tag is rendered without a customElements.define(...) call reachable from a resolved manifest/Vite entry point — the tag never actually registers in the shipped bundle. | error |
| `deprecated-removed-api` | Usage of an MV2/removed WebExtension API (chrome.browserAction, chrome.pageAction, chrome.extension.sendRequest, tabs.getSelected, blocking webRequest) with a known MV3 replacement. The lookup table is intentionally partial — unknown APIs are never flagged. | error |
| `description-permission-mismatch` | A known host/product name in manifest.description (ChatGPT, Claude, Grok, Cursor, Gemini, Copilot, Perplexity, Bing) has no matching host_permissions entry. | error |
| `host-permissions-content-scripts-mismatch` | A domain granted in host_permissions has no corresponding content_scripts.matches entry and is not documented as an intentional exception. | warning |
| `host-permissions-wildcard-broad` | manifest.json host_permissions[] contains <all_urls> or *://*/* — unscoped access to every page, a documented CWS review scrutiny factor. | error |
| `host-signal-unverified` | Hardcoded host DOM selector/attribute literal in src/adapters/** without a `// verified:` comment pointing to a dated DOM fixture — an unverified wrapper-fragile bet. | warning |
| `i18n-key-coverage-gap` | An i18n key consumed via t('x') in code is absent from at least one bundled locale file. | error |
| `i18n-locale-json-validity` | A _locales/*/messages.json file with invalid JSON syntax, a reserved @@ key, an undefined placeholder reference, an invalid message/placeholder name, or empty message content. | error |
| `manifest-permission-allowlist` | manifest.json permissions[] contains an entry absent from the product-declared allowlist (.extension-doctor.json permissionAllowlist[]). | error |
| `manifest-type-no-json` | manifest.json absent at the delivered extension root (e.g. zipped one directory too deep) — the browser store cannot locate it. | error |
| `mem-cleanup-listeners` | addEventListener on a host DOM element inside a content script with no traceable removeEventListener and no declared // ed-permanent-listener: exception. | warning |
| `net-broadcast-unfiltered` | chrome.tabs.query({}) (no url filter) feeding chrome.tabs.sendMessage broadcasts to every open tab, not just supported hosts. | error |
| `network-destination-inventory` | Literal fetch()/XMLHttpRequest/WebSocket destination URLs in the built bundle must be covered by manifest host_permissions; dynamic destinations are reported indicative, never silently treated as clean. | error |
| `no-barrel-import` | An import resolves to an index.ts/index.tsx barrel file instead of the direct module path, and is not declared in .extension-doctor.json allowedBarrels. | warning |
| `no-giant-component` | A UI component (.tsx) file exceeding the configured line threshold (default 300). | warning |
| `permission-diff-between-releases` | A permission gained between the previous manifest snapshot and the current one is not mentioned in CHANGELOG.md. | error |
| `permission-required-vs-optional` | A sensitive permission (tabs, downloads, cookies, history) is declared in the mandatory permissions[] array instead of optional_permissions[]. | warning |
| `permission-unused-in-code` | A declared manifest permission with no detectable chrome.<api> use in the built bundle is likely dead weight (or a privacy/review-risk over-declaration). | warning |
| `postinstall-script-audit` | A declared dependency ships a non-trivial postinstall script not on the known-native-build allowlist (esbuild, playwright, sharp, node-gyp, ...). Inconclusive (never silently pass) when node_modules AND lockfile are both absent. | warning |
| `runtime-external-messaging-exposure` | chrome.runtime.onMessageExternal / onConnectExternal handler has no sender.id / sender.origin validation, exposing it to any external caller. | error |
| `score-scope-provenance` | A score/ratio published without the full command line that produced it is a lie in waiting — this rule confirms the tool's own ProvenanceEnvelope.command is structurally non-optional (src/core/run.ts, src/core/types.ts), never a code scan. | warning |
| `secret-in-bundle` | Built bundle contains a credential-shaped literal (Stripe secret key, AWS access key, PEM private key, or static JWT) — secrets must never ship in a distributed bundle. | error |
| `style-file-kebab-case` | A .ts/.tsx file in camelCase or PascalCase outside a directory declared as PascalCase-exempt in .extension-doctor.json pascalCaseDirs. | warning |
| `sw-context-invalidated-guard` | chrome.runtime.sendMessage() call site with no try/catch or chrome.runtime.id guard against an invalidated extension context. | error |
| `sw-listeners-toplevel` | chrome.*.addListener(...) registered inside a nested function body (incl. an async callback) instead of at module top-level — the listener may not be attached synchronously on service worker wake-up. | error |
| `sw-no-keepalive` | setInterval/setTimeout with delay < 30s inside background/* used to keep the MV3 service worker alive — use chrome.alarms instead, since the browser kills the SW regardless of pending timers. | warning |
| `test-cannot-fail` | Documented impossible at v0.1 (PARTIAL): a test whose assertion structurally can never go red. Static scan alone is insufficient — definitive proof requires a bipolar mutation probe on third-party/host code, infrastructure that does not exist yet. | warning |
| `unused-file-export` | A source file not transitively reachable from any resolved manifest.json/vite.config entry point (a dead barrel or component), excluding qa/, scripts/, tests/. | warning |
| `verified-not-activated` | Documented impossible at v0.1: a correctif reported 'shipped' with no proof the version carrying it is the one actually served. Mechanical in principle via a build-hash convention that does not exist in this pipeline yet. | warning |
| `web-accessible-resources-scope` | web_accessible_resources.matches is broader than the union of content_scripts.matches, exposing bundled resources to sites the extension does not operate on. | error |
| `zero-remote-code` | Built bundle contains eval(), new Function(), importScripts()/import() of a remote http(s) URL, or a remote <script src=http...> — remote code execution forbidden under MV3. | error |
| `zip-integrity` | A .zip present at the audited root has duplicate or unreadable central-directory entries — corrupt or double-packaged archive. | error |

`--format json` emits the same findings as structured JSON for CI
consumption. Every scored output carries its own provenance (`command`,
`scope`) in the same object as the score — a score without the command
that produced it is treated as malformed by every consumer of this tool.

## Exit codes are three-valued, on purpose

This is a design decision, not a footnote:

- `0` — nothing found
- `1` — real defects found
- `2` — **could not measure**: a missing precondition, an unreadable file,
  or a dynamic value the tool refuses to guess at (see the
  `i18n-key-coverage-gap` example above)

**`2` is never `0`.** "I could not check" and "I checked and found
nothing" are two different claims, and conflating them is a known,
documented failure mode of at least one popular npm linter in this space —
extension-doctor deliberately does not reproduce it. A rule that cannot
measure fails loudly, via exit code `2`; it does not pass silently.

## CI integration

```yaml
- name: Extension health check
  run: npx extension-doctor . --format json
```

A non-zero exit (`1` or `2`) fails the job. Treat `2` as a build-blocking
signal, exactly like `1` — a CI step that only checks `exit === 1` will
let inconclusive scans through unnoticed.

## Honest scope

**36 rules: 33 statically implemented, 3 documented as not statically
detectable** (`coexistence-collision`, `test-cannot-fail`,
`verified-not-activated`). Both halves of that count are derived, not
asserted:

```
ls src/rules/*.ts | grep -v index | wc -l
# -> 36
```

The 3 not-statically-detectable rules are counted by inspection of their
`run()` implementation: each ALWAYS returns `verdict: "inconclusive"` with a
precise, non-empty reason — see [Not statically detectable](#not-statically-detectable)
below for the worked demonstration of why each one resists static analysis.
The remaining 33 files implement a real, code-scanning `run()` that can
return `pass` or `fail`. `tests/registry.test.ts` asserts `ALL_RULES.length`
equals the file count on disk — a derived equality, not a hand-typed `36`
that could silently drift the next time a rule is added or removed.

Every rule that runs a real scan distinguishes "ran and found nothing" from
"could not run at all" — a silent `if (nothing found) return []` fallback
is a banned pattern in this codebase. A rule that cannot measure says so,
loudly, via exit code `2`, and INCONCLUSIVE is never reported as PASS.

## Not statically detectable

Three rules in the pack — `coexistence-collision`, `test-cannot-fail`,
`verified-not-activated` — are registered and run like any other rule, but
their `run()` always returns `verdict: "inconclusive"` by design. They exist
so their absence is visible in `scope.rulesActive` and
`ProvenanceEnvelope.perRule` instead of being silently omitted from the
pack. This section is the demonstration for why each one resists static
analysis (folded in from `docs/not-statically-detectable.md`).

### coexistence-collision

**What it would detect**: two contradictory tests on the same logical
element, written at different dates, where the most recent test silently
wins and the older, still-nominally-passing assertion is never re-checked
against the new code path.

**Concrete example that escapes static analysis**: a test written on Day 67
asserts `expect(getByRole("checkbox")).toBeChecked()` for a settings toggle.
Five weeks later, on Day 92, a refactor (`D92-T5`) replaces the checkbox
with a styled `<button role="switch">`. A NEW test is written asserting
`expect(getByRole("switch")).toHaveAttribute("aria-checked", "true")`. Both
tests pass — the old one because the DOM still happens to expose a stray
`role="checkbox"` element elsewhere on the page (a leftover from a
different component), the new one because it targets the actual replaced
control. Nothing textually links the two tests: no shared selector string,
no shared file, no shared date-adjacent commit that a diff-based heuristic
could catch. The collision is only visible to a human who knows both tests
are "about the same settings toggle" — a semantic fact, not a syntactic
one.

**Why static analysis is insufficient**: deciding "these two tests target
the same logical element" requires semantic cross-file matching (matching
intent, not literal strings), plus a calibration corpus large enough to
bound the false-positive rate against components that legitimately have
two render modes (e.g. a desktop checkbox and a mobile switch for the SAME
setting, which is NOT a collision). No such matching engine or calibration
corpus exists in this pipeline today. A first-jet heuristic would produce
an unacceptably high false-positive/false-negative rate without it.

### test-cannot-fail

**What it would detect**: a test whose assertion is structurally incapable
of ever going red, regardless of the correctness of the code under test.

**Concrete example that escapes static analysis**: a test mocks
`chrome.storage.local.get` to always resolve `{ theme: "dark" }`, then
asserts `expect(result.theme).toBe("dark")`. Syntactically this assertion
CAN fail (it's a real `expect(...).toBe(...)` call, not
`expect(true).toBe(true)` — the pattern a naive syntactic scanner would
catch). But because the mock's return value is fixed and the code under
test simply forwards whatever the mock returns, the assertion will pass no
matter what bug is introduced in the surrounding logic (e.g. deleting the
`if (theme === "dark")` branch entirely). A syntactic scan sees a
legitimate-looking assertion and passes it; the assertion is nonetheless
dead weight.

**Why static analysis is insufficient**: a syntactic scan for
jsdom/`chrome.*` mock density is mechanical but produces two failure modes
at once — false positives on legitimate jsdom tests over pure functions,
and false negatives on assertions like the one above, which are
syntactically well-formed but runtime-dead. The only definitive proof is a
bipolar mutation probe: inject a real defect into the code under test (on
matériau étranger — code the probe author did not write) and confirm the
test goes red. Mutation-testing infrastructure over third-party/host code
(`chrome.*`, DOM APIs) does not exist in this pipeline yet.

### verified-not-activated

**What it would detect**: a correctif reported "shipped" with no proof that
the version carrying it is the one actually being served to users.

**Concrete example that escapes static analysis**: commit `abc1234` merges
a fix to `main`. CI runs green. A status message announces "fix shipped,
awaiting review". But the deployed bundle (Chrome Web Store artifact, or a
self-hosted `dist/chrome.zip`) was built from a PRIOR commit and never
rebuilt/republished — the fix exists in the git history but is not in the
artifact users run. `npm publish --tag alpha` putting a new version on the
registry WITHOUT moving `latest` is the same failure shape: every
downstream consumer kept resolving the stale version while the team's own
reporting said "shipped". The git log, the CI run, and the "shipped" status
message are all individually true and collectively misleading.

**Why static analysis is insufficient**: comparing "the fix that shipped in
this commit" against "the build actually served" is mechanical IN
PRINCIPLE — it only requires a build-hash embedded at build time (e.g. a
`BUILD_HASH` constant derived from the git SHA, injected via
`vite.config.ts`) and re-read from the served artifact at verification
time. That convention does not exist in this pipeline's `vite.config.ts`
today. Even once it exists, a legitimate deploy-propagation window (CDN
cache, extension store review delay) requires a documented temporal
tolerance so the rule does not fire false-positive during a normal,
in-flight rollout. Neither the build-hash convention nor the
temporal-tolerance policy exists yet — shipping a verdict without both
would be a guess dressed as a measurement.

### Doctrine cross-reference

All three rules above follow the same non-negotiable: none of them
silently return `[]`/pass when the precondition cannot be resolved — they
always return `verdict: "inconclusive"` with a reason string naming
precisely what is missing (`RuleResult.inconclusive` /
`InconclusiveReason.reason`, see `src/core/types.ts`: "MUST name precisely
what could not be read — never a generic 'internal error'"). This keeps
them visible in `ProvenanceEnvelope.perRule` and counted in
`scope.rulesActive` without ever inflating or deflating `score`
(`src/core/run.ts`'s `measured` filter excludes `inconclusive` results from
the pass-ratio numerator/denominator on purpose).

## Security

extension-doctor's static scan detects `fetch()` and `XMLHttpRequest` call
sites and cross-checks their host against the extension's declared
`host_permissions`. What that scan actually proves: **no network
destination outside the manifest detected statically**. It does not, and
cannot, prove the extension "doesn't spy on you" — a claim like that would
require dynamic analysis this tool does not do. In this project's own
codebase, three `fetch()` calls build their target URL dynamically at
runtime, which makes them undetectable by static analysis alone. A badge
that overclaims what a static scanner can see is worse than no badge.

## Prior art

This tool is written from scratch. The following were studied as prior art, no code derived beyond the canonical MIT license boilerplate (the handful of lines any MIT-licensed npm package shares by convention — copyright header shape, not authored logic) — none of them are dependencies:

- **[dot-skills](https://github.com/pproenca/dot-skills)** (MIT) — the idea
  behind `net-broadcast-unfiltered` and `sw-context-invalidated-guard` was
  informed by dot-skills' own notes on broadcast-to-all-tabs and
  context-invalidation handling. Studied as prior art, no code derived.
- **[addons-linter](https://github.com/mozilla/addons-linter)** (MPL-2.0) —
  studied as prior art for the general shape of a WebExtension linter.
  MPL-2.0 is copyleft; no code or derivative is included here. Studied as
  prior art, no code derived.
- **[react-doctor](https://www.npmjs.com/package/react-doctor)** — used
  strictly as a published tool (`npx react-doctor`), never read or copied
  as source. Its "Modified MIT" license restricts commercial redistribution
  of the tool itself; that restriction is respected by treating it purely
  as an external product we run, never a source we read. Studied as prior
  art, no code derived.

## License

See [LICENSE](./LICENSE) — MIT body plus a commercial-use clause requiring
prior written authorization. Contact lp@perello.consulting.
