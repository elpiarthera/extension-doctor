# FIXTURE PROVENANCE

Synthetic fixture (not extracted from gptpowerups-extension git history).
`manifest.json` host_permissions is restricted to the 3 hosts that also
appear in `content_scripts.matches` (chatgpt.com, claude.ai, grok.com), plus
one background-only API host (`example-deployment-123.convex.cloud`, mirroring
gptpowerups-extension's real Convex backend host) declared as an intentional
exception in `.extension-doctor.json` documentedHosts — a legitimate
background-only fetch() destination that is never content_scripts-injected
by design.
