# FIXTURE PROVENANCE

Synthetic fixture (not extracted from git history — gptpowerups-extension
does not currently register onMessageExternal/onConnectExternal, so no real
defect exists to extract; this rule is preventive). `service-worker.ts`
registers `chrome.runtime.onMessageExternal.addListener` with a handler that
never checks `sender.id` or `sender.origin`, mirroring a plausible future
"allow the companion web app to talk to the extension" feature landing
without the standard sender guard.
