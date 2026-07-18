# foreign-bite-probe run log — HEAD a065cd94

```

=== net-broadcast-unfiltered ===
  RED source: darkreader (darkreader/darkreader) — real darkreader/darkreader src/background/tab-manager.ts (verbatim, currently zero broadcast bug) mutated by appending a promise .then() chain (not await), odd inner spacing "query(  {  }  )", different names (relayToOpenTabs/openTabs/ot), no try/catch
  MUTATION-LANDED: "function relayToOpenTabs(payload) {" found in /tmp/ed-fbp-net-broadcast-unfiltered-fail-6ftXpb/src/background/background.ts
  RED(src/background/background.ts:502): chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.
  RESTORED: [darkreader:background] byte-identical to pre-injection copy, sha256 unchanged (3ae33637ba08…)
  INCONCLUSIVE(background source directory not found, cannot scan for chrome.tabs.query patterns (expected src/background))
  PASS(ghosttext, fregante/GhostText): baseline unmodified real file, verdict pass
  PASS(webvitals, GoogleChrome/web-vitals-extension): baseline unmodified real file, verdict pass
  BONUS FINDING(vimium, philc/vimium): real chrome.tabs.query(...).then + chrome.tabs.sendMessage in the same scope, no injection -> verdict fail — chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.
  net-broadcast-unfiltered: ALL POLES OK

=== sw-listeners-toplevel ===
  RED source: webvitals (GoogleChrome/web-vitals-extension) — real GoogleChrome/web-vitals-extension service_worker.js (verbatim, currently zero nested-listener bug) mutated by appending a DIFFERENTLY-named async wrapper "bootstrapAlarmWatchers" that calls itself top-level, nesting chrome.alarms.onAlarm.addListener inside its body
  MUTATION-LANDED: "async function bootstrapAlarmWatchers() {" found in /tmp/ed-fbp-sw-listeners-toplevel-fail-QO8XDH/src/background/background.ts
  RED(src/background/background.ts:370): chrome.*.addListener(...) is registered inside a nested function body rather than at module top-level — on service worker wake-up the listener may not be re-attached synchronously, silently dropping the triggering event.
  RESTORED: [webvitals:background] byte-identical to pre-injection copy, sha256 unchanged (eb9f3f2fae16…)
  INCONCLUSIVE(background source directory not found, cannot scan for chrome.*.addListener patterns (expected src/background))
  PASS(darkreader, darkreader/darkreader): baseline unmodified real file, verdict pass
  BONUS FINDING(vimium, philc/vimium): real addListener nested inside a function body, no injection -> verdict fail — chrome.*.addListener(...) is registered inside a nested function body rather than at module top-level — on service worker wake-up the listener may not be re-attached synchronously, silently dropping the triggering event.
  BONUS FINDING(ghosttext, fregante/GhostText): 4 real addListener calls nested inside function bodies, no injection -> verdict fail — chrome.*.addListener(...) is registered inside a nested function body rather than at module top-level — on service worker wake-up the listener may not be re-attached synchronously, silently dropping the triggering event.; chrome.*.addListener(...) is registered inside a nested function body rather than at module top-level — on service worker wake-up the listener may not be re-attached synchronously, silently dropping the triggering event.; chrome.*.addListener(...) is registered inside a nested function body rather than at module top-level — on service worker wake-up the listener may not be re-attached synchronously, silently dropping the triggering event.; chrome.*.addListener(...) is registered inside a nested function body rather than at module top-level — on service worker wake-up the listener may not be re-attached synchronously, silently dropping the triggering event.
  sw-listeners-toplevel: ALL POLES OK

=== secret-in-bundle ===
  RED source: ghosttext (fregante/GhostText) — real fregante/GhostText source/background.js (verbatim, treated as a built dist/*.js bundle file) mutated by inserting an AWS access-key-shaped literal in a distinct comment/variable context: "const awsIngestKeyId = ... // legacy ingest credential, unused post-migration"
  MUTATION-LANDED: "const awsIngestKeyId" found in /tmp/ed-fbp-secret-in-bundle-fail-Iy2FpA/dist/bundle.js
  RED(bundle.js:227): AWS access key ID literal found in built bundle.
  RESTORED: [ghosttext:background] byte-identical to pre-injection copy, sha256 unchanged (51f99441d56d…)
  INCONCLUSIVE(no built bundle: checked dist/chrome, dist, build — none exist or contain built output)
  PASS(darkreader, darkreader/darkreader): baseline unmodified real file, verdict pass
  PASS(vimium, philc/vimium): baseline unmodified real file, verdict pass
  PASS(webvitals, GoogleChrome/web-vitals-extension): baseline unmodified real file, verdict pass
  secret-in-bundle: ALL POLES OK

=== description-permission-mismatch ===
  RED source: darkreader (darkreader/darkreader) — real darkreader/darkreader src/manifest.json mutated: description field replaced to name "Grok" (a KNOWN_HOSTS entry) while host_permissions/permissions never grant grok.com/x.ai
  MUTATION-LANDED: "Sync your conversations across Grok" found in /tmp/ed-fbp-description-permission-mismatch-fail-RiT416/manifest.json
  RED(manifest.json:?): manifest.description names "Grok" but host_permissions has no entry matching "grok.com" — the extension advertises a host it cannot actually reach.
  RESTORED: [darkreader:manifest] byte-identical to pre-injection copy, sha256 unchanged (bc3ae5404f90…)
  INCONCLUSIVE(manifest.json not found at extension root (expected manifest.json) — cannot compare description and host_permissions)
  PASS(webvitals, GoogleChrome/web-vitals-extension): baseline unmodified real file, verdict pass
  PASS(ghosttext, fregante/GhostText): baseline unmodified real file, verdict pass
  BONUS FINDING(vimium, philc/vimium): manifest.json is not strict JSON (JSON5-style // comments) -> verdict inconclusive — manifest.json could not be parsed as JSON (Expected ',' or '}' after property value in JSON at position 436)
  description-permission-mismatch: ALL POLES OK

=== csp-not-weakened ===
  RED source: darkreader (darkreader/darkreader) — real darkreader/darkreader src/manifest.json (verbatim, ships with NO content_security_policy key at all — MV2) mutated to ADD the key: "object-src 'self'; script-src 'unsafe-eval' 'self'"
  MUTATION-LANDED: "object-src 'self'; script-src 'unsafe-eval' 'self'" found in /tmp/ed-fbp-csp-not-weakened-fail-y27vKT/manifest.json
  RED(manifest.json:?): content_security_policy.extension_pages reintroduces 'unsafe-eval' — weakens the MV3 default CSP.
  RESTORED: [darkreader:manifest] byte-identical to pre-injection copy, sha256 unchanged (bc3ae5404f90…)
  INCONCLUSIVE(manifest.json not found at extension root — cannot read content_security_policy)
  PASS(darkreader, darkreader/darkreader): baseline unmodified real file, verdict pass
  BONUS FINDING(webvitals, GoogleChrome/web-vitals-extension): compliant CSP: remote origin under connect-src, script-src untouched -> verdict fail — content_security_policy.extension_pages references a remote (http/https) script source — MV3 requires all extension_pages script sources to be bundled locally.
  BONUS FINDING(ghosttext, fregante/GhostText): compliant CSP: http://localhost under connect-src for the local dev bridge, script-src is 'self' -> verdict fail — content_security_policy.extension_pages references a remote (http/https) script source — MV3 requires all extension_pages script sources to be bundled locally.
  BONUS FINDING(vimium, philc/vimium): manifest.json is not strict JSON (JSON5-style // comments) -> verdict inconclusive — manifest.json is not valid JSON — cannot read content_security_policy
  csp-not-weakened: ALL POLES OK

=== host-permissions-wildcard-broad ===
  RED source: darkreader (darkreader/darkreader) — real darkreader/darkreader src/manifest.json (verbatim, MV2, has no host_permissions field at all) mutated by ADDING host_permissions: ["*://*/*"] (a plausible MV3-migration mistake)
  MUTATION-LANDED: ""*://*/*"" found in /tmp/ed-fbp-host-permissions-wildcard-broad-fail-rI9wLR/manifest.json
  RED(manifest.json:?): host_permissions entry "*://*/*" grants access to every page the browser can reach — scope to named domains instead.
  RESTORED: [darkreader:manifest] byte-identical to pre-injection copy, sha256 unchanged (bc3ae5404f90…)
  INCONCLUSIVE(manifest.json not found at extension root — cannot read host_permissions[])
  PASS(ghosttext, fregante/GhostText): baseline unmodified real file, verdict pass
  BONUS FINDING(webvitals, GoogleChrome/web-vitals-extension): real host_permissions: ["*://*/*"], no injection -> verdict fail — host_permissions entry "*://*/*" grants access to every page the browser can reach — scope to named domains instead.
  BONUS FINDING(vimium, philc/vimium): manifest.json is not strict JSON (JSON5-style // comments); real host_permissions: ["<all_urls>"] -> verdict inconclusive — manifest.json is not valid JSON — cannot read host_permissions[]
  host-permissions-wildcard-broad: ALL POLES OK

=== i18n-key-coverage-gap ===
  RED source: ghosttext (fregante/GhostText) — real fregante/GhostText source/options.js (verbatim, zero t()/labelKey usage as fetched) mutated by appending "labelKey: 'ghosttext_sync_status_v2'" (the OTHER call-site shape the rule matches) — key absent from both locale files
  MUTATION-LANDED: "labelKey: 'ghosttext_sync_status_v2'" found in /tmp/ed-fbp-i18n-key-coverage-gap-fail-hWd3hG/ui/popup.ts
  RED(ui/popup.ts:11): i18n key "ghosttext_sync_status_v2" consumed in code but absent from locale(s): en, fr
  RESTORED: [ghosttext:options] byte-identical to pre-injection copy, sha256 unchanged (b2cfd7c7a426…)
  INCONCLUSIVE(locale file _locales/en/messages.json missing or invalid JSON — cannot compute coverage, NOT assumed clean)
  PASS(darkreader, darkreader/darkreader): baseline unmodified real file, verdict pass
  PASS(webvitals, GoogleChrome/web-vitals-extension): baseline unmodified real file, verdict pass
  i18n-key-coverage-gap: ALL POLES OK

=== unused-file-export ===
  RED source: webvitals (GoogleChrome/web-vitals-extension) — real GoogleChrome/web-vitals-extension service_worker.js (verbatim, a genuine feature file — not an authored stub) copied to an UNREFERENCED path "src/features/orphan.ts" under a resolvable manifest.json entry graph (background.service_worker -> src/background/entry.ts, zero imports, never reaches orphan.ts)
  MUTATION-LANDED: "chrome.storage.sync.get" found in /tmp/ed-fbp-unused-file-export-fail-A76wLS/src/features/orphan.ts
  RED(src/features/orphan.ts:?): src/features/orphan.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declared input) — likely a dead file
  RESTORED: [webvitals:background] byte-identical to pre-injection copy, sha256 unchanged (eb9f3f2fae16…)
  INCONCLUSIVE(no resolvable entry point: checked manifest.json, public/manifest.json, src/manifest.json, vite.config.ts, vite.config.js, vite.config.mts, vite.config.mjs — none exist or none yielded a resolvable source entry)
  PASS(ghosttext, fregante/GhostText): baseline unmodified real file, verdict pass
  unused-file-export: ALL POLES OK

=== RULE x SOURCE MATRIX (both verdicts per cell) ===

net-broadcast-unfiltered:
  darkreader: RED -> fail
  vimium: BONUS -> fail (real chrome.tabs.query(...).then + chrome.tabs.sendMessage in the same scope, no injection)
  webvitals: PASS -> pass
  ghosttext: PASS -> pass

sw-listeners-toplevel:
  darkreader: PASS -> pass
  vimium: BONUS -> fail (real addListener nested inside a function body, no injection)
  webvitals: RED -> fail
  ghosttext: BONUS -> fail (4 real addListener calls nested inside function bodies, no injection)

secret-in-bundle:
  darkreader: PASS -> pass
  vimium: PASS -> pass
  webvitals: PASS -> pass
  ghosttext: RED -> fail

description-permission-mismatch:
  darkreader: RED -> fail
  vimium: BONUS -> inconclusive (manifest.json is not strict JSON (JSON5-style // comments))
  webvitals: PASS -> pass
  ghosttext: PASS -> pass

csp-not-weakened:
  darkreader: RED -> fail
  darkreader: PASS -> pass
  vimium: BONUS -> inconclusive (manifest.json is not strict JSON (JSON5-style // comments))
  webvitals: BONUS -> fail (compliant CSP: remote origin under connect-src, script-src untouched)
  ghosttext: BONUS -> fail (compliant CSP: http://localhost under connect-src for the local dev bridge, script-src is 'self')

host-permissions-wildcard-broad:
  darkreader: RED -> fail
  vimium: BONUS -> inconclusive (manifest.json is not strict JSON (JSON5-style // comments); real host_permissions: ["<all_urls>"])
  webvitals: BONUS -> fail (real host_permissions: ["*://*/*"], no injection)
  ghosttext: PASS -> pass

i18n-key-coverage-gap:
  darkreader: PASS -> pass
  vimium: (not exercised for this rule)
  webvitals: PASS -> pass
  ghosttext: RED -> fail

unused-file-export:
  darkreader: (not exercised for this rule)
  vimium: (not exercised for this rule)
  webvitals: RED -> fail
  ghosttext: PASS -> pass

=== SUMMARY: 8/8 rules RED+INCONCLUSIVE+PASS+RESTORED across 4 independently-licensed sources ===
```
