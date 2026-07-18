# extension-doctor — Rules expansion research (addons-linter + react-doctor, beyond §1)

**Date:** 2026-07-17
**Scope:** RESEARCH ONLY. No implementation. Extends `docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md` §1 (which already deduped 22 addons-linter message families against our 36 rules). This report focuses on what §1 did NOT cover.
**Baseline pack:** 36 rules, verified live on branch by command below.

```
$ ls src/rules/*.ts | grep -v index | wc -l
36
```
(run in `/tmp/ed-expand`, branch `chi/d137-full-pack-integrated` before branching off `chi/d137-rules-expansion-research`)

---

## 1. License verdicts

### addons-linter (Mozilla) — Mozilla Public License 2.0

```
$ git clone --depth 1 https://github.com/mozilla/addons-linter /tmp/addons-linter
$ head -25 /tmp/addons-linter/LICENSE
Mozilla Public License, version 2.0
1. Definitions
1.1. "Contributor" means each individual or legal entity that creates,
     contributes to the creation of, or owns Covered Software.
...
```

Verbatim opening line quoted above, SPDX id `MPL-2.0`. MPL-2.0 is weak-copyleft, file-level: it permits reading/porting *ideas* freely, but any *file actually derived from MPL-2.0 source* must itself stay MPL-2.0 and carry attribution if code is copied. **We copy zero code from addons-linter.** This report only mines rule IDEAS (the taxonomy of `export const <ID>` message constants in `src/messages/*.js` and rule files in `src/rules/**`), never source lines. Where a candidate rule is proposed below, it is described in our own words and would be re-implemented from scratch against our own AST/manifest model — same doctrine already applied and confirmed for the 22 rules in state-of-the-art §1 (§6 of that doc, SHA `db595c66a3d37055a92b24fe31cfac6a0017b274`).

### react-doctor (Million Software, Inc.) — Modified MIT, RESTRICTIVE (verified Day 134)

Per prior verification (Day 134, cited in CLAUDE.md-adjacent doctrine and repeated in state-of-the-art §6): react-doctor's LICENSE is a **Modified MIT** with a restrictive commercial-use clause, not a plain MIT. **ZERO code copy from react-doctor, no exceptions.** Everything below is derived from *observing react-doctor's published output categories* (its own docs / CLI category labels for Shadow DOM, hooks, signals, render-purity checks) through normal product usage — never from reading or cloning its source. Inspiration is stated explicitly at the CATEGORY level only (e.g. "a category exists that flags missing cleanup in effect hooks"); the actual detection logic proposed below is our own design, built against Preact's own hooks API surface, not ported from any react-doctor internals.

---

## 2. addons-linter inventory — real counts by command

### 2.1 Total exported message constants

```
$ grep -roE 'export const [A-Z0-9_]+' src/messages/*.js | wc -l
119
```

Matches the count already cited in state-of-the-art §0 (`119` from axe-1, cross-checked here independently on a fresh clone).

### 2.2 Per-file breakdown

```
$ for f in fluent html javascript json layout locale-messagesjson manifestjson; do
    n=$(grep -oE 'export const [A-Z0-9_]+' src/messages/$f.js | wc -l)
    echo "$f.js: $n"
  done
fluent.js: 1
html.js: 2
javascript.js: 23
json.js: 3
layout.js: 12
locale-messagesjson.js: 6
manifestjson.js: 72
```

Sum = 1+2+23+3+12+6+72 = 119. Matches §2.1.

### 2.3 Rule source files (mechanical scan logic, distinct from message constants)

```
$ find src/rules -type f -name "*.js" | wc -l
12
$ ls src/rules/html src/rules/javascript
src/rules/html:        index.js  warn-on-inline.js  warn-on-remote-script.js
src/rules/javascript:  index.js  content-scripts-file-absent.js  global-require-arg.js
                        no-document-write.js  webextension-api-compat-android.js
                        webextension-api-compat.js  webextension-api.js
                        webextension-deprecated-api.js  webextension-unsupported-api.js
```

Note: manifest.json / layout / locale-messagesjson / json / fluent validation rules live inline in `src/parsers/` + `src/schema/*.json` (schema-driven), not as discrete files under `src/rules/`. The 119-message count (§2.1) is the correct unit for cross-mapping against our 36 rule-IDs — each of our rules typically absorbs several addons-linter message constants (already demonstrated by the FUSION entries in state-of-the-art §1, e.g. `csp-not-weakened` = `MANIFEST_CSP` + `MANIFEST_CSP_UNSAFE_EVAL`).

### 2.4 Cross-table — NET-NEW beyond state-of-the-art §1

State-of-the-art §1 already dedups 22 addons-linter message families (manifest/permissions/CSP/remote-code/i18n-locale — see §1.1–§1.3 of that doc). This table covers ONLY what §1 left unmined: `layout.js` (12), `json.js` (3), `html.js` (2 — one already covered), `fluent.js` (1).

| source file | message id | detects | status vs our 36 |
|---|---|---|---|
| layout.js | `DUPLICATE_XPI_ENTRY` | duplicate entry inside packaged ZIP | ALREADY COVERED — `zip-integrity` (§1.1 line `zip-integrity`) |
| layout.js | `INVALID_XPI_ENTRY` | invalid character/path in ZIP entry name | ALREADY COVERED — `zip-integrity` |
| layout.js | `BAD_ZIPFILE` | corrupt/unreadable ZIP archive | ALREADY COVERED — `zip-integrity` |
| layout.js | `TYPE_NO_MANIFEST_JSON` | manifest.json absent at ZIP root | ALREADY COVERED — `manifest-type-no-json` |
| layout.js | `FILE_TOO_LARGE` | single packaged file exceeds size threshold (AMO limit) | **NEW candidate** — `bundle-file-size-cap` |
| layout.js | `HIDDEN_FILE` | dotfile / OS artifact (`.DS_Store`, `Thumbs.db`) shipped in package | **NEW candidate** — `hidden-file-in-bundle` |
| layout.js | `FLAGGED_FILE` | filename matches a known-bad exact-name list | **NEW candidate**, low value for us (AMO-specific denylist, not maintained by us) — OUT-OF-STATIC-SCOPE, justified: no equivalent denylist exists for Chrome/Edge/Brave, would need a maintained list we don't own |
| layout.js | `FLAGGED_FILE_EXTENSION` | extension (`.exe`, `.dll`, `.bat`, etc.) shipped inside the package | **NEW candidate** — `binary-extension-in-bundle` |
| layout.js | `FLAGGED_FILE_TYPE` | MIME-sniffed file type mismatch vs extension for a flagged category | OUT-OF-STATIC-SCOPE, justified: requires magic-byte sniffing infra we don't have; folds into `binary-extension-in-bundle` at reduced fidelity (extension-only check) |
| layout.js | `ALREADY_SIGNED` | package already contains AMO signing metadata (re-submission artifact) | OUT-OF-STATIC-SCOPE, justified: Mozilla-signing-pipeline-specific, no Chrome/Edge/Brave equivalent, doctrine is cross-browser-native |
| layout.js | `COINMINER_USAGE_DETECTED` | fingerprint match for known cryptominer JS libraries | **NEW candidate** — folds into existing `banned-vulnerable-libs` fingerprint list as one more family, not a new rule id |
| layout.js | `RESERVED_FILENAME` | filename collides with an OS-reserved name (`CON`, `PRN`, `NUL` on Windows) | **NEW candidate** — `reserved-filename-in-bundle` (relevant: our users install cross-platform, Windows collision is a real cross-browser-native risk) |
| json.js | `JSON_INVALID` | malformed JSON in any packaged `.json` file | **NEW candidate** — `json-file-parseable` (generalizes `i18n-locale-json-validity` beyond `_locales/*` to `manifest.json` and any other shipped `.json`) |
| json.js | `JSON_BLOCK_COMMENTS` | block comments (`/* */`) inside a strict-JSON file | **NEW candidate**, low value: our build pipeline (Vite) would strip these before packaging; folds into `json-file-parseable` as one more check, not standalone |
| json.js | `JSON_DUPLICATE_KEY` | duplicate key inside a JSON object (last-write-wins silently) | **NEW candidate** — real bug class (silent override), folds into `json-file-parseable` |
| html.js | `INLINE_SCRIPT` | inline `<script>` in any packaged HTML (options/popup page) blocked by default CSP | **NEW candidate** — `inline-script-in-html` (distinct from `csp-not-weakened`: this one is a *content* check on `.html` files themselves, not the manifest CSP key) |
| html.js | `REMOTE_SCRIPT` | `<script src="http...">` in packaged HTML | ALREADY COVERED — folds into `zero-remote-code` (state-of-the-art §1.1 fusion already includes `REMOTE_SCRIPT`) |
| fluent.js | `FLUENT_INVALID` | malformed Fluent (`.ftl`) localization file | OUT-OF-STATIC-SCOPE, justified: Fluent is Mozilla/Firefox-native localization format, we use `chrome.i18n` `_locales/*/messages.json` exclusively (CLAUDE.md stack decision) — zero surface area in our product |

**Net-new addons-linter-inspired candidates beyond §1: 6** — `bundle-file-size-cap`, `hidden-file-in-bundle`, `binary-extension-in-bundle`, `reserved-filename-in-bundle`, `json-file-parseable`, `inline-script-in-html`. (`COINMINER_USAGE_DETECTED` folds into existing `banned-vulnerable-libs`, not counted as a new id.)

### 2.5 Official addons-linter MV3-coverage issues (≥2, real URLs)

1. **[Issue #3721 — "Add experimental support for MV3 schema"](https://github.com/mozilla/addons-linter/issues/3721)** — tracks addons-linter's own gap in validating Manifest V3 manifest shape; relevant because it confirms MV3 coverage in addons-linter was *added later and incrementally*, not native from day one — corroborates our finding that several of its 119 messages (especially manifest ones) predate MV3 and may not fully model MV3-only fields (e.g. `background.service_worker`).
2. **[Issue #3290 — "Remove MANIFEST_FIELD_UNSUPPORTED validation error on background.service_worker once supported and enabled on the Firefox side"](https://github.com/mozilla/addons-linter/issues/3290)** — directly documents that addons-linter historically treated `background.service_worker` (the MV3 SW field we depend on for our SW-family rules `sw-context-invalidated-guard`, `sw-no-keepalive`, `sw-listeners-toplevel`) as unsupported/erroring, because Firefox's own MV3 SW support lagged Chrome's. This is exactly the "Firefox-only tool, not verified against our Chrome/Edge/Brave cross-browser-native requirement" gap that state-of-the-art §3 already names as a structural angle-mort of addons-linter — this issue is direct primary-source evidence for that claim.

---

## 3. react-doctor Preact-applicable categories — observed, not code-copied

Categories observed from react-doctor's published output/docs (category labels only, per the license constraint in §1):

| category (react-doctor label, observed) | applicable to Preact? | cross-table vs our 36 |
|---|---|---|
| Shadow DOM boundary / style leakage | Yes — directly relevant, we mount all overlays in Shadow DOM (CLAUDE.md stack) | **NEW candidate** — `shadow-dom-style-leak` (detects a `<style>` or class selector that could leak past the shadow boundary — e.g. global `document.head.appendChild(style)` instead of shadow-root-scoped injection) |
| Effect/hook cleanup (missing `useEffect` return teardown) | Yes — Preact hooks share the same `useEffect` contract as React | PARTIALLY OVERLAPS `mem-cleanup-listeners` (state-of-the-art §1.2) but that rule is scoped to raw DOM `addEventListener`/`removeEventListener`; react-doctor's category is broader (any effect with a subscription/timer/interval not torn down) — **NEW candidate** — `hook-effect-cleanup-missing`, narrower complement to `mem-cleanup-listeners` |
| Hook dependency array correctness (stale closure / missing dep) | Yes | **NEW candidate** — `hook-deps-incomplete` |
| Signals cleanup (Preact Signals `effect()`/`computed()` disposal) | Yes — only if we adopt `@preact/signals` (not yet in stack per CLAUDE.md, Zustand is current state layer) | **NEW candidate, currently NOT APPLICABLE** — flag for v-next only if/when Preact Signals is adopted; OUT-OF-STATIC-SCOPE today, justified: no signals usage in current codebase to calibrate a MUST_BLOCK against |
| Render purity (side effects during render, not inside effect) | Yes | OVERLAPS `no-giant-component` only in spirit (both are "component hygiene"), not the same detection — **NEW candidate** — `render-side-effect-impure` |
| Custom Element registration lifecycle | Already covered | ALREADY COVERED — `custom-element-orphan-registration` (state-of-the-art §1.2, and this exact category was react-doctor's real signal that produced our `ui/lit-ui-register.ts` MUST_BLOCK per that doc) |
| Unused export / dead file | Already covered | ALREADY COVERED — `unused-file-export` |
| Barrel import anti-pattern | Already covered | ALREADY COVERED — `no-barrel-import` |
| Component size / complexity | Already covered | ALREADY COVERED — `no-giant-component` |

**Net-new react-doctor-inspired candidates: 4** — `shadow-dom-style-leak`, `hook-effect-cleanup-missing`, `hook-deps-incomplete`, `render-side-effect-impure`. (Signals-cleanup flagged but not counted — no current surface area, explicit exclusion per `derive-never-type.md` "a divergence declared is a decision".)

---

## 4. Net-new families proposed — grouped, with detectability notes

### Family A — Mozilla-inspired, package hygiene (bundle-level)

| id | detects | mechanically detectable? (how) | needs infra we don't have? |
|---|---|---|---|
| `bundle-file-size-cap` | a single file in the packaged ZIP exceeds a configurable size threshold | Yes — trivial filesystem stat over `dist/<browser>/**` | No |
| `hidden-file-in-bundle` | OS/editor artifact (`.DS_Store`, `Thumbs.db`, `.git`) shipped inside the ZIP | Yes — filename pattern match on packaged entries | No |
| `binary-extension-in-bundle` | executable/binary extension (`.exe`, `.dll`, `.bat`, `.sh`) present inside the package | Yes — extension allowlist/denylist check | No |
| `reserved-filename-in-bundle` | a packaged filename collides with a Windows-reserved name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`9`, `LPT1`-`9`) | Yes — exact-match against the reserved-name table | No |
| `json-file-parseable` | any shipped `.json` file (manifest, locale files, config) fails strict JSON.parse, contains block comments, or has duplicate keys | Yes — `JSON.parse` + duplicate-key-aware parser (e.g. detect via a strict tokenizer, not `JSON.parse` which silently drops dup keys) | No — but duplicate-key detection needs a tokenizing parser, not native `JSON.parse` (worth flagging as slightly higher effort than the others in this family) |
| `inline-script-in-html` | inline `<script>` tag present in a packaged `.html` file (popup/options page) | Yes — HTML parse + script-tag scan, content-level (distinct from manifest CSP key check already done by `csp-not-weakened`) | No |

### Family B — react-doctor-inspired, Preact component hygiene

| id | detects | mechanically detectable? (how) | needs infra we don't have? |
|---|---|---|---|
| `shadow-dom-style-leak` | style injection or DOM append targeting `document.head`/`document.body` from inside overlay-mounting code, instead of the shadow root | Partial — AST match on `document.head.appendChild`/`document.body.appendChild` calls inside files under `ui/**`/`src/core/**mount**`; false positives possible for legitimately host-page-level code (rare, by doctrine banned) | No, but needs calibration pass (MUST_BLOCK not yet proven on our own code — same bar state-of-the-art §5 applies before promoting to v0.1) |
| `hook-effect-cleanup-missing` | `useEffect(() => { ...subscribe/setInterval/addEventListener... })` with no returned teardown function | Yes — AST: effect callback body contains a subscription/timer call, and callback has no `return () => {...}` | No — but distinguishing "subscription" call families (custom hooks wrapping subscriptions) from plain side effects needs a maintained call-signature list, moderate effort |
| `hook-deps-incomplete` | `useEffect`/`useCallback`/`useMemo` dependency array missing a variable referenced in the callback body | Partial — this is exactly what `eslint-plugin-react-hooks`'s `exhaustive-deps` already solves; re-implementing from scratch is wasted effort — **recommend wrapping/reusing `eslint-plugin-react-hooks` (MIT) as a dependency**, not re-inventing the AST pass ourselves. Flag: this is the one candidate where "re-implement from scratch" doctrine should be reconsidered, since `eslint-plugin-react-hooks` is plain MIT (not react-doctor's restrictive license) and is designed to be embedded, not copied from | Possibly — needs eslint AST infra if not already wired into our pipeline; TBD by whoever picks this up |
| `render-side-effect-impure` | component body (outside hooks/effects) contains a call to `fetch`, `chrome.*`, `localStorage`, `Math.random()`, `Date.now()` directly at render time | Yes — AST: top-level statement in component function body (not inside `useEffect`/`useMemo`/`useCallback`/event handler) calling one of a maintained "impure API" list | No, but the "impure API" list needs maintenance as APIs are added |

---

## 5. Derived totals

```
current pack = 36
(command: ls src/rules/*.ts | grep -v index | wc -l → 36, run in /tmp/ed-expand)
```

Proposed net-new beyond the 36 (this report, NOT counting the 22 already deduped by state-of-the-art §1):

1. `bundle-file-size-cap`
2. `hidden-file-in-bundle`
3. `binary-extension-in-bundle`
4. `reserved-filename-in-bundle`
5. `json-file-parseable`
6. `inline-script-in-html`
7. `shadow-dom-style-leak`
8. `hook-effect-cleanup-missing`
9. `hook-deps-incomplete` (recommend embedding `eslint-plugin-react-hooks` rather than reimplementing — see §4 Family B note)
10. `render-side-effect-impure`

**Proposed net-new count = 10.**

No double-count against the 36: every id above is either (a) a NEW candidate not present in the 36 (verified by name-match against the 36-id list in the task brief), or (b) explicitly folded into an existing rule and NOT counted separately (`COINMINER_USAGE_DETECTED` → `banned-vulnerable-libs`, `JSON_BLOCK_COMMENTS`/`JSON_DUPLICATE_KEY` → `json-file-parseable` bundled as one id not three). Items marked OUT-OF-STATIC-SCOPE (`FLAGGED_FILE`, `FLAGGED_FILE_TYPE`, `ALREADY_SIGNED`, `FLUENT_INVALID`, signals-cleanup) are excluded from both counts, per `derive-never-type.md` "a declared divergence is a decision, not a debt" — reasons stated inline in §2.4 and §3, not silently dropped.

None of these 10 candidates carries a MUST_BLOCK proven on our own code yet (state-of-the-art §5's non-negotiable bar for promotion to a shipped pack). This report proposes them as a v-next backlog only — implementation (including the bipolar mutation-probe evidence required by `hook-vitality-bite-probe.md`) is explicitly out of scope for this task.

---

Orchestrator: Chi — VantageOS Team | 2026-07-17
