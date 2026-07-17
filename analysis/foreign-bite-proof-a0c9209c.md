# foreign-bite-probe run log — HEAD a0c9209c

```

=== net-broadcast-unfiltered ===
  fixture-string (existing, NOT reused here): await chrome.tabs.query({}); for (const tab of tabs) { chrome.tabs.sendMessage(tab.id, { type }).catch(() => {}) }  (tests/fixtures/dogfood/net-broadcast-fail, async/await + try/catch + .catch() suppression)
  foreign-file: src/background.ts (source: mem0-chrome-extension @ 54a882a, MIT)
  injected-variant: promise .then() chain (not await), odd inner spacing "query(  {  }  )", different names (relayToOpenTabs/openTabs/ot), no try/catch — appended to real mem0-chrome-extension background.ts (which as committed has zero broadcast bug)
  MUTATION-LANDED: "function relayToOpenTabs(payload) {" found in /tmp/ed-fbp-net-broadcast-unfiltered-fail-qvBxSm/src/background/background.ts
  RED(src/background/background.ts:34): chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.
  INCONCLUSIVE(background source directory not found, cannot scan for chrome.tabs.query patterns (expected src/background))
  RESTORED: /tmp/ed-biteproof/scripts/foreign-material/mem0-chrome-extension/src/background.ts byte-identical to pre-injection copy, git diff --stat empty
  net-broadcast-unfiltered: ALL POLES OK

=== description-permission-mismatch ===
  fixture-string (existing, NOT reused here): "description": "Give your ChatGPT, Claude, Cursor super powers..." with NO cursor.com in host_permissions (tests/fixtures/pack-fam2/description-permission-mismatch-fail/manifest.json — real gptpowerups-extension Blocker B-2)
  foreign-file: manifest.json (source: mem0-chrome-extension @ 54a882a, MIT)
  injected-variant: mutated the REAL mem0-chrome-extension manifest.json description field to name "Grok" (a different KNOWN_HOSTS entry than "Cursor") in different marketing phrasing, while host_permissions (verbatim: api.mem0.ai, app.mem0.ai, claude.ai) never grants grok.com/x.ai
  MUTATION-LANDED: "conversations in sync across Grok" found in /tmp/ed-fbp-description-permission-mismatch-fail-0Y603O/manifest.json
  RED(manifest.json:?): manifest.description names "Grok" but host_permissions has no entry matching "grok.com" — the extension advertises a host it cannot actually reach.
  INCONCLUSIVE(manifest.json not found at extension root (expected manifest.json) — cannot compare description and host_permissions)
  RESTORED: /tmp/ed-biteproof/scripts/foreign-material/mem0-chrome-extension/manifest.json byte-identical to pre-injection copy, git diff --stat empty
  description-permission-mismatch: ALL POLES OK

=== csp-not-weakened ===
  fixture-string (existing, NOT reused here): "content_security_policy": { "extension_pages": "script-src 'self' 'unsafe-eval'; object-src 'self'" } (tests/fixtures/dogfood/csp-not-weakened-fail/manifest.json, synthetic)
  foreign-file: manifest.json (source: mem0-chrome-extension @ 54a882a, MIT)
  injected-variant: real mem0-chrome-extension manifest.json (verbatim, ships with NO content_security_policy key at all — currently passes by MV3 implicit default) mutated to ADD the key with directives reordered: "object-src 'self'; script-src 'unsafe-eval' 'self'" (unsafe-eval first, object-src first overall — different directive order than the fixture)
  MUTATION-LANDED: "object-src 'self'; script-src 'unsafe-eval' 'self'" found in /tmp/ed-fbp-csp-not-weakened-fail-DKBj4i/manifest.json
  RED(manifest.json:?): content_security_policy.extension_pages reintroduces 'unsafe-eval' — weakens the MV3 default CSP.
  INCONCLUSIVE(manifest.json not found at extension root — cannot read content_security_policy)
  RESTORED: /tmp/ed-biteproof/scripts/foreign-material/mem0-chrome-extension/manifest.json byte-identical to pre-injection copy, git diff --stat empty
  csp-not-weakened: ALL POLES OK

=== sw-listeners-toplevel ===
  fixture-string (existing, NOT reused here): addListener registered inside an async init() body (tests/pack-fam5.test.ts "MUST_BLOCK: flags addListener registered inside an async init() body", src/background/service-worker.ts)
  foreign-file: src/background.ts (source: mem0-chrome-extension @ 54a882a, MIT)
  injected-variant: real mem0-chrome-extension background.ts (verbatim, 3 top-level addListener calls, currently PASS) mutated by appending a DIFFERENTLY-named async wrapper "bootstrapAlarmWatchers" (not "init") that calls itself top-level, nesting chrome.alarms.onAlarm.addListener (different chrome namespace than the fixture) inside its body
  MUTATION-LANDED: "async function bootstrapAlarmWatchers() {" found in /tmp/ed-fbp-sw-listeners-toplevel-fail-RsFkjY/src/background/background.ts
  RED(src/background/background.ts:35): chrome.*.addListener(...) is registered inside a nested function body rather than at module top-level — on service worker wake-up the listener may not be re-attached synchronously, silently dropping the triggering event.
  INCONCLUSIVE(background source directory not found, cannot scan for chrome.*.addListener patterns (expected src/background))
  RESTORED: /tmp/ed-biteproof/scripts/foreign-material/mem0-chrome-extension/src/background.ts byte-identical to pre-injection copy, git diff --stat empty
  sw-listeners-toplevel: ALL POLES OK

=== secret-in-bundle ===
  fixture-string (existing, NOT reused here): const key = "sk_live_ABCDEFGHIJKLMNOP1234"; (tests/pack-fam3.test.ts positive control + MUST_BLOCK synthetic sw.js fixture — Stripe secret key shape)
  foreign-file: src/sidebar.ts (source: mem0-chrome-extension @ 54a882a, MIT)
  injected-variant: real mem0-chrome-extension sidebar.ts (verbatim, 1705 lines, treated as a built dist/*.js bundle file) mutated by inserting an AWS access-key-shaped literal (not a Stripe key — a DIFFERENT of the rule's 4 patterns) in a different comment/variable context: "const awsIngestKeyId = ... // legacy ingest credential, unused post-migration"
  MUTATION-LANDED: "const awsIngestKeyId" found in /tmp/ed-fbp-secret-in-bundle-fail-ehuhBF/dist/sidebar.js
  RED(sidebar.js:1707): AWS access key ID literal found in built bundle.
  INCONCLUSIVE(no built bundle: checked dist/chrome, dist, build — none exist or contain built output)
  RESTORED: /tmp/ed-biteproof/scripts/foreign-material/mem0-chrome-extension/src/sidebar.ts byte-identical to pre-injection copy, git diff --stat empty
  secret-in-bundle: ALL POLES OK

=== host-permissions-wildcard-broad ===
  fixture-string (existing, NOT reused here): "host_permissions": ["<all_urls>"] (tests/fixtures/dogfood/host-permissions-wildcard-broad-fail/manifest.json, synthetic)
  foreign-file: manifest.json (source: mem0-chrome-extension @ 54a882a, MIT)
  injected-variant: real mem0-chrome-extension manifest.json (verbatim host_permissions: api.mem0.ai, app.mem0.ai, claude.ai — none broad) mutated by APPENDING "*://*/*" (the OTHER member of BROAD_PATTERNS, never "<all_urls>") to host_permissions[]
  MUTATION-LANDED: ""*://*/*"" found in /tmp/ed-fbp-host-permissions-wildcard-broad-fail-trR5FM/manifest.json
  RED(manifest.json:?): host_permissions entry "*://*/*" grants access to every page the browser can reach — scope to named domains instead.
  INCONCLUSIVE(manifest.json not found at extension root — cannot read host_permissions[])
  RESTORED: /tmp/ed-biteproof/scripts/foreign-material/mem0-chrome-extension/manifest.json byte-identical to pre-injection copy, git diff --stat empty
  host-permissions-wildcard-broad: ALL POLES OK

=== i18n-key-coverage-gap ===
  fixture-string (existing, NOT reused here): t('x') plain call-site form used across tests/unit/i18n-coverage.test.ts and dogfood I18N_FAIL fixture (6 missing keys via direct t('key') calls, CardContextMenu.tsx)
  foreign-file: src/popup.ts (source: mem0-chrome-extension @ 54a882a, MIT)
  injected-variant: real mem0-chrome-extension popup.ts (verbatim, 35 lines, zero t()/labelKey usage as committed) mutated by appending an object literal using the OTHER call-site shape the rule matches — "labelKey: 'openmemory_sync_status_v2'" (not a direct t('x') call) — key absent from both locale files
  MUTATION-LANDED: "labelKey: 'openmemory_sync_status_v2'" found in /tmp/ed-fbp-i18n-key-coverage-gap-fail-xDtuAB/ui/popup.ts
  RED(ui/popup.ts:37): i18n key "openmemory_sync_status_v2" consumed in code but absent from locale(s): en, fr
  INCONCLUSIVE(locale file _locales/en/messages.json missing or invalid JSON — cannot compute coverage, NOT assumed clean)
  RESTORED: /tmp/ed-biteproof/scripts/foreign-material/mem0-chrome-extension/src/popup.ts byte-identical to pre-injection copy, git diff --stat empty
  i18n-key-coverage-gap: ALL POLES OK

=== unused-file-export ===
  fixture-string (existing, NOT reused here): src/components/dead-barrel.ts, unreferenced stub file under src/components (tests/fixtures/dogfood/unused-file-export-fail)
  foreign-file: src/selection_context.ts (source: mem0-chrome-extension @ 54a882a, MIT)
  injected-variant: real mem0-chrome-extension selection_context.ts (verbatim, 2113 bytes, a genuine feature file — not an authored stub) copied to a DIFFERENT unreferenced path "src/features/selection_context.ts" under a resolvable manifest.json entry graph (background.service_worker -> src/background/entry.ts, which has zero imports and never reaches selection_context.ts)
  MUTATION-LANDED: "chrome.runtime.onMessage.addListener" found in /tmp/ed-fbp-unused-file-export-fail-SfLEdE/src/features/selection_context.ts
  RED(src/features/selection_context.ts:?): src/features/selection_context.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declared input) — likely a dead file
  INCONCLUSIVE(no resolvable entry point: checked manifest.json, public/manifest.json, src/manifest.json, vite.config.ts, vite.config.js, vite.config.mts, vite.config.mjs — none exist or none yielded a resolvable source entry)
  RESTORED: /tmp/ed-biteproof/scripts/foreign-material/mem0-chrome-extension/src/selection_context.ts byte-identical to pre-injection copy, git diff --stat empty
  unused-file-export: ALL POLES OK

=== SUMMARY: 8/8 rules RED+INCONCLUSIVE+RESTORED on foreign material ===
```
