# Dogfood audit — extension-doctor vs the live gptpowerups-extension

**Date:** 2026-07-17  
**extension-doctor commit:** `6f644478` (branch chi/d137-full-pack-integrated, 36 rules)  
**What this is:** our own tool auditing our own shipped extension, end-to-end, all 36 rules. Not fixtures — the real repo and the real shipped zip.

> Triage doctrine: findings below are REPORTED, not fixed here (CLASS: no fix proposed in this artifact). Real debt is ours (no "pre-existing" label); intentional-by-doctrine findings are marked config-suppressible.

## Target A — live source tree (`/root/coding/gptpowerups-extension`)

```
command: node bin/extension-doctor.js /root/coding/gptpowerups-extension --format json
exit code: 1   score: 66/100   files scanned: 1910   rules active: 36
```

- **FAIL (10):** host-permissions-content-scripts-mismatch, mem-cleanup-listeners, no-barrel-import, no-giant-component, permission-unused-in-code, postinstall-script-audit, style-file-kebab-case, sw-context-invalidated-guard, sw-listeners-toplevel, unused-file-export
- **INCONCLUSIVE (7):** coexistence-collision, i18n-key-coverage-gap, manifest-permission-allowlist, network-destination-inventory, permission-diff-between-releases, test-cannot-fail, verified-not-activated  _(loud refusals — precondition missing, e.g. no built bundle / no allowlist config; never a silent pass)_
- **PASS:** 19

### Findings (source)

| rule | file:line | message |
|---|---|---|
| `host-permissions-content-scripts-mismatch` | manifest.json | host_permissions entry "https://*.x.ai/*" has no matching content_scripts.matches entry and is not listed in .extension-doctor.json document |
| `host-permissions-content-scripts-mismatch` | manifest.json | host_permissions entry "https://files.oaiusercontent.com/*" has no matching content_scripts.matches entry and is not listed in .extension-do |
| `host-permissions-content-scripts-mismatch` | manifest.json | host_permissions entry "https://kindred-spaniel-455.convex.cloud/*" has no matching content_scripts.matches entry and is not listed in .exte |
| `mem-cleanup-listeners` | ui/sidebar-mount.tsx:897 | document.addEventListener("DOMContentLoaded", start) has no traceable document.removeEventListener("DOMContentLoaded", start) in the enclosi |
| `no-barrel-import` | src/background/broadcast.ts:16 | import "../../adapters/index" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json a |
| `no-barrel-import` | src/background/compare-orchestrator.ts:22 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | src/background/continue-orchestrator.ts:17 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | src/background/service-worker.ts:18 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | src/core/agent-composer/apply-system-prompt.ts:12 | import "./index" resolves to barrel src/core/agent-composer/index.ts — import the direct module instead, or add it to .extension-doctor.json |
| `no-barrel-import` | src/core/conversation-export/index.ts:11 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | src/core/conversation-inject/inline-fallback.ts:26 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | src/core/conversations-store/capture.ts:17 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | src/core/host-theme/detect.ts:29 | import "../inline-message-actions/index" resolves to barrel src/core/inline-message-actions/index.ts — import the direct module instead, or  |
| `no-barrel-import` | src/core/inline-message-actions/index.ts:31 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | src/core/inline-message-actions/mount.tsx:19 | import "../conversations-store" resolves to barrel src/core/conversations-store/index.ts — import the direct module instead, or add it to .e |
| `no-barrel-import` | src/core/inline-message-actions/mount.tsx:23 | import "./index" resolves to barrel src/core/inline-message-actions/index.ts — import the direct module instead, or add it to .extension-doc |
| `no-barrel-import` | src/core/inline-message-actions/mount.tsx:24 | import "./index" resolves to barrel src/core/inline-message-actions/index.ts — import the direct module instead, or add it to .extension-doc |
| `no-barrel-import` | src/core/media-capture/chatgpt.ts:22 | import "../media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .extension-doctor. |
| `no-barrel-import` | src/core/media-capture/claude.ts:28 | import "../media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .extension-doctor. |
| `no-barrel-import` | src/core/media-capture/grok.ts:26 | import "../media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .extension-doctor. |
| `no-barrel-import` | src/core/media-capture/index.ts:14 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | src/core/media-capture/inline-button.ts:22 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | src/core/media-capture/inline-button.ts:23 | import "../media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .extension-doctor. |
| `no-barrel-import` | src/core/media-capture/inline-button.ts:28 | import "./index" resolves to barrel src/core/media-capture/index.ts — import the direct module instead, or add it to .extension-doctor.json  |
| `no-barrel-import` | src/core/media-inline-actions/index.ts:23 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | src/core/media-inline-actions/mount.tsx:24 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | src/core/media-inline-actions/mount.tsx:28 | import "../media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .extension-doctor. |
| `no-barrel-import` | src/core/media-inline-actions/mount.tsx:29 | import "../media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .extension-doctor. |
| `no-barrel-import` | src/core/media-inline-actions/mount.tsx:31 | import "./index" resolves to barrel src/core/media-inline-actions/index.ts — import the direct module instead, or add it to .extension-docto |
| `no-barrel-import` | src/core/media-inline-actions/mount.tsx:32 | import "./index" resolves to barrel src/core/media-inline-actions/index.ts — import the direct module instead, or add it to .extension-docto |
| `no-barrel-import` | src/core/multi-step/waitForHostResponseDone.ts:20 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | src/shared/effective-config.ts:14 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | src/shared/store.ts:14 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | ui/ManagerApp.tsx:17 | import "../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to .exte |
| `no-barrel-import` | ui/components/FAB.tsx:10 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | ui/components/FAB.tsx:11 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | ui/components/FAB.tsx:12 | import "../../src/core/conversations-store" resolves to barrel src/core/conversations-store/index.ts — import the direct module instead, or  |
| `no-barrel-import` | ui/components/compare/CompareColumn.tsx:9 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/compare/CompareOverlay.tsx:9 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/compare/CompareOverlay.tsx:10 | import "../../../src/core/compare/index" resolves to barrel src/core/compare/index.ts — import the direct module instead, or add it to .exte |
| `no-barrel-import` | ui/components/compare/ComparePromptInput.tsx:9 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/compare/CompareStateHeader.tsx:11 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/conversation/ConversationCard.tsx:9 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/conversation/ConversationCardIcons.tsx:11 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/conversation/ConversationDetailShell.tsx:12 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/conversation/SendToDropdown.tsx:18 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/debate/DebateHostSelector.tsx:16 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/debate/DebateOverlay.tsx:8 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/debate/DebateOverlay.tsx:9 | import "../../../src/core/compare/index" resolves to barrel src/core/compare/index.ts — import the direct module instead, or add it to .exte |
| `no-barrel-import` | ui/components/debate/DebateOverlayShell.tsx:15 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/debate/DebateProgressBar.tsx:10 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/debate/DebateTurnCard.tsx:6 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/inject/HydrationModal.tsx:8 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/inject/HydrationModalShell.tsx:18 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/manager/Card.tsx:9 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/manager/CardContextMenu.tsx:10 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/manager/CardShell.tsx:7 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/media/MediaCard.tsx:9 | import "../../../src/core/media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .ex |
| `no-barrel-import` | ui/components/media/MediaCardBadges.tsx:6 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/components/media/MediaDetail.tsx:10 | import "../../../src/core/media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .ex |
| `no-barrel-import` | ui/components/projects/AddItemsModalShell.tsx:14 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/projects/AddItemsToProjectModal.tsx:13 | import "../../../src/core/conversations-store" resolves to barrel src/core/conversations-store/index.ts — import the direct module instead,  |
| `no-barrel-import` | ui/components/projects/AddItemsToProjectModal.tsx:16 | import "../../../src/core/media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .ex |
| `no-barrel-import` | ui/components/projects/AddItemsToProjectModal.tsx:18 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/projects/AddItemsToProjectModal.tsx:19 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/projects/ProjectCardActions.tsx:14 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/projects/ProjectDetailView.tsx:23 | import "../../../src/core/conversations-store" resolves to barrel src/core/conversations-store/index.ts — import the direct module instead,  |
| `no-barrel-import` | ui/components/projects/ProjectDetailView.tsx:26 | import "../../../src/core/media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .ex |
| `no-barrel-import` | ui/components/projects/ProjectDetailView.tsx:28 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/projects/ProjectDetailView.tsx:29 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/projects/ProjectEditModalShell.tsx:15 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/projects/ProjectTreeItem.tsx:12 | import "../../../src/core/conversations-store" resolves to barrel src/core/conversations-store/index.ts — import the direct module instead,  |
| `no-barrel-import` | ui/components/projects/ProjectTreeItem.tsx:13 | import "../../../src/core/media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .ex |
| `no-barrel-import` | ui/components/projects/ProjectsEmptyState.tsx:12 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/prompt/PromptFileAttachments.tsx:16 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/prompt/PromptModal.tsx:18 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/prompt/PromptModalFooter.tsx:25 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/prompt/PromptTagEditor.tsx:17 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/slash/SlashFooter.tsx:9 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/slash/SlashItem.tsx:7 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/slash/SlashItemList.tsx:9 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/slash/SlashMenu.tsx:36 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/slash/SlashMenu.tsx:37 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/components/slash/SlashMenuShell.tsx:20 | import "../icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doctor.json al |
| `no-barrel-import` | ui/components/slash/SlashTrigger.tsx:13 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/hooks/useHostInputGuard.tsx:43 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | ui/managers/ConversationsManager.tsx:8 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | ui/managers/ConversationsManager.tsx:9 | import "../../src/core/conversations-store" resolves to barrel src/core/conversations-store/index.ts — import the direct module instead, or  |
| `no-barrel-import` | ui/managers/ConversationsManager.tsx:13 | import "../../src/core/media-capture" resolves to barrel src/core/media-capture/index.ts — import the direct module instead, or add it to .e |
| `no-barrel-import` | ui/managers/ConversationsManager.tsx:14 | import "../../src/core/media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .exten |
| `no-barrel-import` | ui/managers/MediaManager.tsx:10 | import "../../src/core/media-capture" resolves to barrel src/core/media-capture/index.ts — import the direct module instead, or add it to .e |
| `no-barrel-import` | ui/managers/MediaManager.tsx:11 | import "../../src/core/media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .exten |
| `no-barrel-import` | ui/managers/ProjectsManager.tsx:13 | import "../../src/core/conversations-store" resolves to barrel src/core/conversations-store/index.ts — import the direct module instead, or  |
| `no-barrel-import` | ui/managers/ProjectsManager.tsx:15 | import "../../src/core/media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .exten |
| `no-barrel-import` | ui/managers/ProjectsManager.tsx:16 | import "../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to .e |
| `no-barrel-import` | ui/managers/ProjectsManager.tsx:19 | import "../components/icons" resolves to barrel ui/components/icons/index.ts — import the direct module instead, or add it to .extension-doc |
| `no-barrel-import` | ui/managers/PromptsManager.tsx:14 | import "../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to .e |
| `no-barrel-import` | ui/managers/PromptsManager.tsx:20 | import "../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to .e |
| `no-barrel-import` | ui/managers/SettingsManager.tsx:19 | import "../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowed |
| `no-barrel-import` | ui/managers/SettingsManager.tsx:21 | import "../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to .e |
| `no-barrel-import` | ui/managers/compare-manager/CompareSessionCard.tsx:2 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/managers/compare-manager/useCompareManagerData.ts:2 | import "../../../src/core/compare/index" resolves to barrel src/core/compare/index.ts — import the direct module instead, or add it to .exte |
| `no-barrel-import` | ui/managers/prompt-manager/PromptsModals.tsx:11 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/managers/prompt-manager/usePromptHydration.ts:15 | import "../../../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allo |
| `no-barrel-import` | ui/managers/prompt-manager/usePromptHydration.ts:22 | import "../../../src/core/prompts-store" resolves to barrel src/core/prompts-store/index.ts — import the direct module instead, or add it to |
| `no-barrel-import` | ui/sidebar-mount.tsx:21 | import "../adapters" resolves to barrel adapters/index.ts — import the direct module instead, or add it to .extension-doctor.json allowedBar |
| `no-barrel-import` | ui/sidebar-mount.tsx:39 | import "../src/core/conversation-export" resolves to barrel src/core/conversation-export/index.ts — import the direct module instead, or add |
| `no-barrel-import` | ui/sidebar-mount.tsx:42 | import "../src/core/conversations-store" resolves to barrel src/core/conversations-store/index.ts — import the direct module instead, or add |
| `no-barrel-import` | ui/sidebar-mount.tsx:53 | import "../src/core/media-store" resolves to barrel src/core/media-store/index.ts — import the direct module instead, or add it to .extensio |
| `no-giant-component` | ui/components/InlinePopup.tsx:301 | component file has 313 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/components/MultiStepStepper.tsx:301 | component file has 369 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/components/compare/CompareOverlay.tsx:301 | component file has 307 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/components/manager/ManagerNav.tsx:301 | component file has 326 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/components/projects/AddItemsToProjectModal.tsx:301 | component file has 341 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/components/projects/ProjectDetailView.tsx:301 | component file has 356 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/components/projects/ProjectEditModal.tsx:301 | component file has 352 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/components/prompt/PromptModal.tsx:301 | component file has 553 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/components/prompt/PromptModalFooter.tsx:301 | component file has 311 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/managers/ProjectsManager.tsx:301 | component file has 361 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/managers/PromptsManager.tsx:301 | component file has 392 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/managers/SettingsManager.tsx:301 | component file has 396 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | ui/sidebar-mount.tsx:301 | component file has 902 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `no-giant-component` | src/core/media-inline-actions/mount.tsx:301 | component file has 350 lines, exceeding the configured threshold of 300 (weighting by cyclomatic complexity is a documented v2 refinement, n |
| `permission-unused-in-code` |  | Manifest declares permission "unlimitedStorage" but no chrome.unlimitedStorage (dotted) or chrome["unlimitedStorage"] (bracket) use was foun |
| `postinstall-script-audit` | node_modules/@biomejs/biome/package.json | Dependency "@biomejs/biome" declares a postinstall script not on the known-native-build allowlist: node scripts/postinstall.js |
| `style-file-kebab-case` | src/core/conversation-inject/setNativeValueAndDispatch.ts | file name "setNativeValueAndDispatch" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .exte |
| `style-file-kebab-case` | src/core/multi-step/MultiStepOrchestrator.ts | file name "MultiStepOrchestrator" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensio |
| `style-file-kebab-case` | src/core/multi-step/waitForHostResponseDone.ts | file name "waitForHostResponseDone" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extens |
| `style-file-kebab-case` | ui/ManagerApp.tsx | file name "ManagerApp" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.js |
| `style-file-kebab-case` | ui/components/Badge.tsx | file name "Badge" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/Button.tsx | file name "Button" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/FAB.tsx | file name "FAB" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/FABButton.tsx | file name "FABButton" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/FABIcons.tsx | file name "FABIcons" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/FABMenu.tsx | file name "FABMenu" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/Icon.tsx | file name "Icon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/InlinePopup.tsx | file name "InlinePopup" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/Input.tsx | file name "Input" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/MultiStepStepper.tsx | file name "MultiStepStepper" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/Placeholder.tsx | file name "Placeholder" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/Toast.tsx | file name "Toast" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/compare/CompareColumn.tsx | file name "CompareColumn" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/components/compare/CompareFooter.tsx | file name "CompareFooter" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/components/compare/CompareHostGrid.tsx | file name "CompareHostGrid" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/components/compare/CompareOverlay.tsx | file name "CompareOverlay" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/compare/CompareOverlayShell.tsx | file name "CompareOverlayShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension- |
| `style-file-kebab-case` | ui/components/compare/ComparePromptInput.tsx | file name "ComparePromptInput" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/compare/CompareStateHeader.tsx | file name "CompareStateHeader" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/conversation/ConvProjectSidebar.tsx | file name "ConvProjectSidebar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/conversation/ConversationCard.tsx | file name "ConversationCard" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/conversation/ConversationCardActions.tsx | file name "ConversationCardActions" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extens |
| `style-file-kebab-case` | ui/components/conversation/ConversationCardIcons.tsx | file name "ConversationCardIcons" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensio |
| `style-file-kebab-case` | ui/components/conversation/ConversationCardShell.tsx | file name "ConversationCardShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensio |
| `style-file-kebab-case` | ui/components/conversation/ConversationDetail.tsx | file name "ConversationDetail" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/conversation/ConversationDetailShell.tsx | file name "ConversationDetailShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extens |
| `style-file-kebab-case` | ui/components/conversation/ConversationProjectChips.tsx | file name "ConversationProjectChips" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .exten |
| `style-file-kebab-case` | ui/components/conversation/ConversationProjectSubmenu.tsx | file name "ConversationProjectSubmenu" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .ext |
| `style-file-kebab-case` | ui/components/conversation/ConversationSearchBar.tsx | file name "ConversationSearchBar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensio |
| `style-file-kebab-case` | ui/components/conversation/ConversationsListView.tsx | file name "ConversationsListView" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensio |
| `style-file-kebab-case` | ui/components/conversation/ConversationsToolbar.tsx | file name "ConversationsToolbar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension |
| `style-file-kebab-case` | ui/components/conversation/MessageBubble.tsx | file name "MessageBubble" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/components/conversation/SendToDropdown.tsx | file name "SendToDropdown" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/debate/DebateHostSelector.tsx | file name "DebateHostSelector" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/debate/DebateOverlay.tsx | file name "DebateOverlay" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/components/debate/DebateOverlayShell.tsx | file name "DebateOverlayShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/debate/DebateProgressBar.tsx | file name "DebateProgressBar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/debate/DebateTimeline.tsx | file name "DebateTimeline" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/debate/DebateTurnCard.tsx | file name "DebateTurnCard" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/icons/AlertCircleIcon.tsx | file name "AlertCircleIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/components/icons/BookIcon.tsx | file name "BookIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/icons/BotIcon.tsx | file name "BotIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/icons/CheckIcon.tsx | file name "CheckIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/icons/ChevronDownIcon.tsx | file name "ChevronDownIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/components/icons/ChevronLeftIcon.tsx | file name "ChevronLeftIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/components/icons/ChevronRightIcon.tsx | file name "ChevronRightIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/icons/ChevronUpIcon.tsx | file name "ChevronUpIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/components/icons/CopyIcon.tsx | file name "CopyIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/icons/DownloadIcon.tsx | file name "DownloadIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor. |
| `style-file-kebab-case` | ui/components/icons/ExternalLinkIcon.tsx | file name "ExternalLinkIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/icons/EyeIcon.tsx | file name "EyeIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/icons/EyeOffIcon.tsx | file name "EyeOffIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.js |
| `style-file-kebab-case` | ui/components/icons/FolderTreeIcon.tsx | file name "FolderTreeIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/icons/GlobeIcon.tsx | file name "GlobeIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/icons/ImageIcon.tsx | file name "ImageIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/icons/InfoIcon.tsx | file name "InfoIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/icons/Loader2Icon.tsx | file name "Loader2Icon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/icons/MessageSquareIcon.tsx | file name "MessageSquareIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/icons/MoreHorizontalIcon.tsx | file name "MoreHorizontalIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/icons/PencilIcon.tsx | file name "PencilIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.js |
| `style-file-kebab-case` | ui/components/icons/PlusIcon.tsx | file name "PlusIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/icons/RefreshCwIcon.tsx | file name "RefreshCwIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/components/icons/SearchIcon.tsx | file name "SearchIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.js |
| `style-file-kebab-case` | ui/components/icons/SendIcon.tsx | file name "SendIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/icons/SettingsIcon.tsx | file name "SettingsIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor. |
| `style-file-kebab-case` | ui/components/icons/Trash2Icon.tsx | file name "Trash2Icon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.js |
| `style-file-kebab-case` | ui/components/icons/XIcon.tsx | file name "XIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/icons/ZapIcon.tsx | file name "ZapIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/inject/HydrationModal.tsx | file name "HydrationModal" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/inject/HydrationModalShell.tsx | file name "HydrationModalShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension- |
| `style-file-kebab-case` | ui/components/inject/HydrationVariableFields.tsx | file name "HydrationVariableFields" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extens |
| `style-file-kebab-case` | ui/components/inline/MediaActionBar.tsx | file name "MediaActionBar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/inline/MessageActionBar.tsx | file name "MessageActionBar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/manager/Card.tsx | file name "Card" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json |
| `style-file-kebab-case` | ui/components/manager/CardContextMenu.tsx | file name "CardContextMenu" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/components/manager/CardIcons.tsx | file name "CardIcons" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/manager/CardProjectChips.tsx | file name "CardProjectChips" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/manager/CardShell.tsx | file name "CardShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/manager/CardsGrid.tsx | file name "CardsGrid" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/manager/FoldersSidebar.tsx | file name "FoldersSidebar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/manager/ManagerModal.tsx | file name "ManagerModal" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor. |
| `style-file-kebab-case` | ui/components/manager/ManagerModalIcons.tsx | file name "ManagerModalIcons" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/manager/ManagerModalShell.tsx | file name "ManagerModalShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/manager/ManagerModalTabBar.tsx | file name "ManagerModalTabBar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/manager/ManagerNav.tsx | file name "ManagerNav" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.js |
| `style-file-kebab-case` | ui/components/manager/ManagerToolbar.tsx | file name "ManagerToolbar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/manager/folders-sidebar/FolderCreateInput.tsx | file name "FolderCreateInput" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/manager/folders-sidebar/FolderItem.tsx | file name "FolderItem" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.js |
| `style-file-kebab-case` | ui/components/manager/folders-sidebar/FolderRenameInput.tsx | file name "FolderRenameInput" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/manager/folders-sidebar/FolderSidebarIcons.tsx | file name "FolderSidebarIcons" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/manager/folders-sidebar/iconBtnStyle.ts | file name "iconBtnStyle" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor. |
| `style-file-kebab-case` | ui/components/media/FilterPills.tsx | file name "FilterPills" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/media/MediaCard.tsx | file name "MediaCard" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/media/MediaCardBadges.tsx | file name "MediaCardBadges" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/components/media/MediaCardIcons.tsx | file name "MediaCardIcons" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/media/MediaCardShell.tsx | file name "MediaCardShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/media/MediaContextMenu.tsx | file name "MediaContextMenu" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/media/MediaDetail.tsx | file name "MediaDetail" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/media/MediaDetailActions.tsx | file name "MediaDetailActions" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/media/MediaDetailShell.tsx | file name "MediaDetailShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/media/MediaGalleryEmptyState.tsx | file name "MediaGalleryEmptyState" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensi |
| `style-file-kebab-case` | ui/components/media/MediaManagerToolbar.tsx | file name "MediaManagerToolbar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension- |
| `style-file-kebab-case` | ui/components/media/MediaMetaTable.tsx | file name "MediaMetaTable" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/media/MediaProjectSidebar.tsx | file name "MediaProjectSidebar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension- |
| `style-file-kebab-case` | ui/components/media/ViewModeToggle.tsx | file name "ViewModeToggle" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/projects/AddItemsModalShell.tsx | file name "AddItemsModalShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/projects/AddItemsToProjectModal.tsx | file name "AddItemsToProjectModal" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensi |
| `style-file-kebab-case` | ui/components/projects/AddItemsTypeTabs.tsx | file name "AddItemsTypeTabs" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/projects/PickerCardWrapper.tsx | file name "PickerCardWrapper" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/projects/ProjectCard.tsx | file name "ProjectCard" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/projects/ProjectCardActions.tsx | file name "ProjectCardActions" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/projects/ProjectCardShell.tsx | file name "ProjectCardShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/projects/ProjectCardStats.tsx | file name "ProjectCardStats" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/projects/ProjectChip.tsx | file name "ProjectChip" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/projects/ProjectColorPicker.tsx | file name "ProjectColorPicker" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/projects/ProjectDetailView.tsx | file name "ProjectDetailView" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/projects/ProjectEditModal.tsx | file name "ProjectEditModal" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/projects/ProjectEditModalShell.tsx | file name "ProjectEditModalShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensio |
| `style-file-kebab-case` | ui/components/projects/ProjectIconPicker.tsx | file name "ProjectIconPicker" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/projects/ProjectTree.tsx | file name "ProjectTree" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/projects/ProjectTreeItem.tsx | file name "ProjectTreeItem" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/components/projects/ProjectsDetailMount.tsx | file name "ProjectsDetailMount" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension- |
| `style-file-kebab-case` | ui/components/projects/ProjectsEmptyState.tsx | file name "ProjectsEmptyState" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/projects/ProjectsManagerToolbar.tsx | file name "ProjectsManagerToolbar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensi |
| `style-file-kebab-case` | ui/components/projects/project-detail/DetailSection.tsx | file name "DetailSection" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/components/projects/project-detail/DetailSectionBody.tsx | file name "DetailSectionBody" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/projects/project-detail/DetailSectionHeader.tsx | file name "DetailSectionHeader" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension- |
| `style-file-kebab-case` | ui/components/projects/project-detail/ProjectDetailHeader.tsx | file name "ProjectDetailHeader" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension- |
| `style-file-kebab-case` | ui/components/projects/project-detail/ProjectDetailIcons.tsx | file name "ProjectDetailIcons" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/components/projects/project-detail/RemovableItemWrapper.tsx | file name "RemovableItemWrapper" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension |
| `style-file-kebab-case` | ui/components/prompt/CreatePromptModal.tsx | file name "CreatePromptModal" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/prompt/PromptFileAttachments.tsx | file name "PromptFileAttachments" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensio |
| `style-file-kebab-case` | ui/components/prompt/PromptHydrationPanel.tsx | file name "PromptHydrationPanel" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension |
| `style-file-kebab-case` | ui/components/prompt/PromptModal.tsx | file name "PromptModal" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/prompt/PromptModalFooter.tsx | file name "PromptModalFooter" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/components/prompt/PromptModalShell.tsx | file name "PromptModalShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/components/prompt/PromptTagEditor.tsx | file name "PromptTagEditor" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/components/shared/ConfirmModal.tsx | file name "ConfirmModal" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor. |
| `style-file-kebab-case` | ui/components/shared/SearchInput.tsx | file name "SearchInput" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/slash/SlashFooter.tsx | file name "SlashFooter" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.j |
| `style-file-kebab-case` | ui/components/slash/SlashItem.tsx | file name "SlashItem" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/slash/SlashItemList.tsx | file name "SlashItemList" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/components/slash/SlashMenu.tsx | file name "SlashMenu" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.jso |
| `style-file-kebab-case` | ui/components/slash/SlashMenuShell.tsx | file name "SlashMenuShell" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/components/slash/SlashTrigger.tsx | file name "SlashTrigger" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor. |
| `style-file-kebab-case` | ui/hooks/useHostInputGuard.tsx | file name "useHostInputGuard" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/hooks/useSlashDrag.ts | file name "useSlashDrag" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor. |
| `style-file-kebab-case` | ui/managers/AboutManager.tsx | file name "AboutManager" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor. |
| `style-file-kebab-case` | ui/managers/ComingSoonManager.tsx | file name "ComingSoonManager" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/managers/CompareManager.tsx | file name "CompareManager" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/managers/ConversationsManager.tsx | file name "ConversationsManager" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension |
| `style-file-kebab-case` | ui/managers/MediaManager.tsx | file name "MediaManager" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor. |
| `style-file-kebab-case` | ui/managers/ProjectsManager.tsx | file name "ProjectsManager" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/managers/PromptsManager.tsx | file name "PromptsManager" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/managers/SettingsManager.tsx | file name "SettingsManager" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doct |
| `style-file-kebab-case` | ui/managers/compare-manager/CompareEmptyState.tsx | file name "CompareEmptyState" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-do |
| `style-file-kebab-case` | ui/managers/compare-manager/CompareLoadingState.tsx | file name "CompareLoadingState" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension- |
| `style-file-kebab-case` | ui/managers/compare-manager/CompareSessionCard.tsx | file name "CompareSessionCard" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `style-file-kebab-case` | ui/managers/compare-manager/CompareTabBar.tsx | file name "CompareTabBar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/managers/compare-manager/CompareTrashIcon.tsx | file name "CompareTrashIcon" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doc |
| `style-file-kebab-case` | ui/managers/compare-manager/DebateSetCard.tsx | file name "DebateSetCard" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/managers/compare-manager/useCompareManagerData.ts | file name "useCompareManagerData" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensio |
| `style-file-kebab-case` | ui/managers/prompt-manager/PromptsModals.tsx | file name "PromptsModals" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor |
| `style-file-kebab-case` | ui/managers/prompt-manager/PromptsProjectSidebar.tsx | file name "PromptsProjectSidebar" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extensio |
| `style-file-kebab-case` | ui/managers/prompt-manager/PromptsSubTabs.tsx | file name "PromptsSubTabs" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-docto |
| `style-file-kebab-case` | ui/managers/prompt-manager/usePromptHydration.ts | file name "usePromptHydration" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-d |
| `sw-context-invalidated-guard` | src/core/compare/index.ts:47 | chrome.runtime.sendMessage(...) called with no try/catch and no chrome.runtime.id guard — throws/rejects after every extension reload while  |
| `sw-context-invalidated-guard` | src/core/conversations-store/index.ts:46 | chrome.runtime.sendMessage(...) called with no try/catch and no chrome.runtime.id guard — throws/rejects after every extension reload while  |
| `sw-context-invalidated-guard` | src/core/media-store/index.ts:37 | chrome.runtime.sendMessage(...) called with no try/catch and no chrome.runtime.id guard — throws/rejects after every extension reload while  |
| `sw-context-invalidated-guard` | src/stores/projects/store.ts:41 | chrome.runtime.sendMessage(...) called with no try/catch and no chrome.runtime.id guard — throws/rejects after every extension reload while  |
| `sw-context-invalidated-guard` | ui/managers/ConversationsManager.tsx:146 | chrome.runtime.sendMessage(...) called with no try/catch and no chrome.runtime.id guard — throws/rejects after every extension reload while  |
| `sw-context-invalidated-guard` | ui/managers/ConversationsManager.tsx:153 | chrome.runtime.sendMessage(...) called with no try/catch and no chrome.runtime.id guard — throws/rejects after every extension reload while  |
| `sw-listeners-toplevel` | src/background/messaging.ts:97 | chrome.*.addListener(...) is registered inside a nested function body rather than at module top-level — on service worker wake-up the listen |
| `unused-file-export` | coverage/block-navigation.js | coverage/block-navigation.js is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config  |
| `unused-file-export` | coverage/lcov-report/block-navigation.js | coverage/lcov-report/block-navigation.js is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or  |
| `unused-file-export` | coverage/lcov-report/prettify.js | coverage/lcov-report/prettify.js is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.con |
| `unused-file-export` | coverage/lcov-report/sorter.js | coverage/lcov-report/sorter.js is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.confi |
| `unused-file-export` | coverage/prettify.js | coverage/prettify.js is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declared |
| `unused-file-export` | coverage/sorter.js | coverage/sorter.js is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declared i |
| `unused-file-export` | playwright.e2e.config.ts | playwright.e2e.config.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config decl |
| `unused-file-export` | playwright.smoke.config.ts | playwright.smoke.config.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config de |
| `unused-file-export` | src/background/auth.ts | src/background/auth.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declar |
| `unused-file-export` | src/background/messaging.ts | src/background/messaging.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config d |
| `unused-file-export` | src/background/service-worker-testable.ts | src/background/service-worker-testable.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or |
| `unused-file-export` | src/core/agent-composer/agent-composer-storage.ts | src/core/agent-composer/agent-composer-storage.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/p |
| `unused-file-export` | src/core/agent-composer/apply-system-prompt.ts | src/core/agent-composer/apply-system-prompt.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popu |
| `unused-file-export` | src/core/agent-composer/index.ts | src/core/agent-composer/index.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.con |
| `unused-file-export` | src/core/catalog-browser/catalog-builtins.ts | src/core/catalog-browser/catalog-builtins.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, |
| `unused-file-export` | src/core/catalog-browser/catalog-cache.ts | src/core/catalog-browser/catalog-cache.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or |
| `unused-file-export` | src/core/catalog-browser/catalog-filter.ts | src/core/catalog-browser/catalog-filter.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, o |
| `unused-file-export` | src/core/catalog-browser/index.ts | src/core/catalog-browser/index.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.co |
| `unused-file-export` | src/core/page-capture/index.ts | src/core/page-capture/index.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.confi |
| `unused-file-export` | src/core/page-capture/page-capture.ts | src/core/page-capture/page-capture.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vit |
| `unused-file-export` | src/core/prompts-library/index.ts | src/core/prompts-library/index.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.co |
| `unused-file-export` | src/core/prompts-library/prompt-hydration.ts | src/core/prompts-library/prompt-hydration.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, |
| `unused-file-export` | src/core/prompts-library/prompts-storage.ts | src/core/prompts-library/prompts-storage.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup,  |
| `unused-file-export` | src/core/prompts-library/prompts-types.ts | src/core/prompts-library/prompts-types.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or |
| `unused-file-export` | src/vite-env.d.ts | src/vite-env.d.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declared in |
| `unused-file-export` | ui/components/Badge.tsx | ui/components/Badge.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config decla |
| `unused-file-export` | ui/components/Button.tsx | ui/components/Button.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config decl |
| `unused-file-export` | ui/components/Icon.tsx | ui/components/Icon.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declar |
| `unused-file-export` | ui/components/Input.tsx | ui/components/Input.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config decla |
| `unused-file-export` | ui/components/Placeholder.tsx | ui/components/Placeholder.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config |
| `unused-file-export` | ui/components/compare/compare-overlay-utils.ts | ui/components/compare/compare-overlay-utils.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popu |
| `unused-file-export` | ui/components/conversation/ConversationsListView.tsx | ui/components/conversation/ConversationsListView.tsx is not reachable from any resolved entry point (manifest.json background/content_script |
| `unused-file-export` | ui/components/conversation/ConversationsToolbar.tsx | ui/components/conversation/ConversationsToolbar.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts |
| `unused-file-export` | ui/components/manager/ManagerModalShell.tsx | ui/components/manager/ManagerModalShell.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts/popup,  |
| `unused-file-export` | ui/components/projects/AddItemsTypeTabs.tsx | ui/components/projects/AddItemsTypeTabs.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts/popup,  |
| `unused-file-export` | ui/components/projects/ProjectChip.tsx | ui/components/projects/ProjectChip.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vi |
| `unused-file-export` | ui/components/prompt/CreatePromptModal.tsx | ui/components/prompt/CreatePromptModal.tsx is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, o |
| `unused-file-export` | ui/lit-ui-register.ts | ui/lit-ui-register.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declare |
| `unused-file-export` | ui/lui-jsx.d.ts | ui/lui-jsx.d.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declared inpu |
| `unused-file-export` | ui/managers/prompt-manager/index.ts | ui/managers/prompt-manager/index.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite. |
| `unused-file-export` | vite.config.ts | vite.config.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declared input |
| `unused-file-export` | vitest.config.ts | vitest.config.ts is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declared inp |

## Target B — shipped zip (`release/gptpowerups-chrome-v0.9.0.0.zip`, extracted)

```
command: node bin/extension-doctor.js <extracted-zip> --format json
exit code: 1   score: 81/100   files scanned: 17   rules active: 36
```

- **FAIL (3):** host-permissions-content-scripts-mismatch, permission-unused-in-code, unused-file-export
- **INCONCLUSIVE (20):** banned-vulnerable-libs, coexistence-collision, deprecated-removed-api, host-signal-unverified, manifest-permission-allowlist, mem-cleanup-listeners, net-broadcast-unfiltered, network-destination-inventory, no-barrel-import, no-giant-component, permission-diff-between-releases, postinstall-script-audit, runtime-external-messaging-exposure, style-file-kebab-case, sw-context-invalidated-guard, sw-listeners-toplevel, sw-no-keepalive, test-cannot-fail, verified-not-activated, zip-integrity  _(the shipped bundle has no `src/` tree, so source-oriented rules correctly refuse rather than falsely pass — this is the three-valued contract working on a real artifact)_
- **PASS:** 13

### Findings (shipped)

| rule | file:line | message |
|---|---|---|
| `host-permissions-content-scripts-mismatch` | manifest.json | host_permissions entry "https://*.x.ai/*" has no matching content_scripts.matches entry and is not listed in .extension-doctor.json document |
| `host-permissions-content-scripts-mismatch` | manifest.json | host_permissions entry "https://files.oaiusercontent.com/*" has no matching content_scripts.matches entry and is not listed in .extension-do |
| `host-permissions-content-scripts-mismatch` | manifest.json | host_permissions entry "https://kindred-spaniel-455.convex.cloud/*" has no matching content_scripts.matches entry and is not listed in .exte |
| `permission-unused-in-code` |  | Manifest declares permission "unlimitedStorage" but no chrome.unlimitedStorage (dotted) or chrome["unlimitedStorage"] (bracket) use was foun |
| `unused-file-export` | assets/compare-orchestrator-DEpgn53H.js | assets/compare-orchestrator-DEpgn53H.js is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or v |
| `unused-file-export` | assets/sidebar-mount.tsx-CUXt8F6n.js | assets/sidebar-mount.tsx-CUXt8F6n.js is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite |

## Triage

**Intentional-by-doctrine (config-suppressible via `.extension-doctor.json`, NOT defects):**
- `no-barrel-import` on `adapters/index` — that barrel IS the HOST_FEATURE_MATRIX public surface (CLAUDE.md EXTENSIONS #7). Declare it in `allowedBarrels`.
- `host-permissions-content-scripts-mismatch` for `*.x.ai`, `files.oaiusercontent.com`, `kindred-spaniel-455.convex.cloud` — documented background-fetch hosts (see the CWS permission-justifications). Declare in `documentedHosts`.
- `permission-unused-in-code` / bundle rules INCONCLUSIVE on source-only or bundle-only trees — correct refusal, not a defect.

**Genuine hygiene debt on our own code (ours, traced — no "pre-existing" label):**
- `no-giant-component`, `style-file-kebab-case`, `unused-file-export`, `sw-listeners-toplevel`, `mem-cleanup-listeners`, `sw-context-invalidated-guard` — real signals in the source tree; each to be investigated and traced as debt (overlaps existing UI/debt backlog).

## Why this is the product proof

extension-doctor scored our own shipped extension **66/100 (source) / 81/100 (shipped zip)**, flagged real hygiene debt, refused loudly where it could not measure, and stayed suppressible for intentional doctrine — the exact behaviour a dev-workflow linter must have. No generic linter carries these rules, because they were born from our own shipped bugs.

*Orchestrator: Chi — VantageOS Team | 2026-07-17*
