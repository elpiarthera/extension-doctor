import type { Rule } from "../core/types.js";
import { bannedVulnerableLibs } from "./banned-vulnerable-libs.js";
import { coexistenceCollision } from "./coexistence-collision.js";
import { contentScriptFileExists } from "./content-script-file-exists.js";
import { cspNotWeakened } from "./csp-not-weakened.js";
import { customElementOrphanRegistration } from "./custom-element-orphan-registration.js";
import { deprecatedRemovedApi } from "./deprecated-removed-api.js";
import { descriptionPermissionMismatch } from "./description-permission-mismatch.js";
import { hostPermissionsContentScriptsMismatch } from "./host-permissions-content-scripts-mismatch.js";
import { hostPermissionsWildcardBroad } from "./host-permissions-wildcard-broad.js";
import { hostSignalUnverified } from "./host-signal-unverified.js";
import { i18nKeyCoverageGap } from "./i18n-key-coverage-gap.js";
import { i18nLocaleJsonValidity } from "./i18n-locale-json-validity.js";
import { manifestPermissionAllowlist } from "./manifest-permission-allowlist.js";
import { manifestTypeNoJson } from "./manifest-type-no-json.js";
import { memCleanupListeners } from "./mem-cleanup-listeners.js";
import { netBroadcastUnfiltered } from "./net-broadcast-unfiltered.js";
import { networkDestinationInventory } from "./network-destination-inventory.js";
import { noBarrelImport } from "./no-barrel-import.js";
import { noGiantComponent } from "./no-giant-component.js";
import { permissionDiffBetweenReleases } from "./permission-diff-between-releases.js";
import { permissionRequiredVsOptional } from "./permission-required-vs-optional.js";
import { permissionUnusedInCode } from "./permission-unused-in-code.js";
import { postinstallScriptAudit } from "./postinstall-script-audit.js";
import { runtimeExternalMessagingExposure } from "./runtime-external-messaging-exposure.js";
import { scoreScopeProvenance } from "./score-scope-provenance.js";
import { secretInBundle } from "./secret-in-bundle.js";
import { styleFileKebabCase } from "./style-file-kebab-case.js";
import { swContextInvalidatedGuard } from "./sw-context-invalidated-guard.js";
import { swListenersToplevel } from "./sw-listeners-toplevel.js";
import { swNoKeepalive } from "./sw-no-keepalive.js";
import { testCannotFail } from "./test-cannot-fail.js";
import { unusedFileExport } from "./unused-file-export.js";
import { verifiedNotActivated } from "./verified-not-activated.js";
import { webAccessibleResourcesScope } from "./web-accessible-resources-scope.js";
import { zeroRemoteCode } from "./zero-remote-code.js";
import { zipIntegrity } from "./zip-integrity.js";

/**
 * Full 36-rule pack. All 36 files under src/rules/ (excluding this index)
 * are registered below.
 *
 * Three of the 36 (coexistenceCollision, testCannotFail, verifiedNotActivated)
 * return an "inconclusive" verdict by design — they detect defect CLASSES that
 * are not statically decidable from source alone (runtime coexistence, flaky
 * test masking, activation-vs-shipping gaps). See README.md
 * ("Not statically detectable") for the worked demonstrations. They are still registered and run like any
 * other rule; "inconclusive" is a loud, structured verdict, never a silent skip.
 */
export const ALL_RULES: Rule[] = [
  bannedVulnerableLibs,
  coexistenceCollision,
  contentScriptFileExists,
  cspNotWeakened,
  customElementOrphanRegistration,
  deprecatedRemovedApi,
  descriptionPermissionMismatch,
  hostPermissionsContentScriptsMismatch,
  hostPermissionsWildcardBroad,
  hostSignalUnverified,
  i18nKeyCoverageGap,
  i18nLocaleJsonValidity,
  manifestPermissionAllowlist,
  manifestTypeNoJson,
  memCleanupListeners,
  netBroadcastUnfiltered,
  networkDestinationInventory,
  noBarrelImport,
  noGiantComponent,
  permissionDiffBetweenReleases,
  permissionRequiredVsOptional,
  permissionUnusedInCode,
  postinstallScriptAudit,
  runtimeExternalMessagingExposure,
  scoreScopeProvenance,
  secretInBundle,
  styleFileKebabCase,
  swContextInvalidatedGuard,
  swListenersToplevel,
  swNoKeepalive,
  testCannotFail,
  unusedFileExport,
  verifiedNotActivated,
  webAccessibleResourcesScope,
  zeroRemoteCode,
  zipIntegrity,
];

export function resolveRules(requested: string[] | null): { active: Rule[]; unknown: string[] } {
  if (requested === null) return { active: ALL_RULES, unknown: [] };
  const byId = new Map(ALL_RULES.map((r) => [r.id, r]));
  const active: Rule[] = [];
  const unknown: string[] = [];
  for (const id of requested) {
    const rule = byId.get(id);
    if (rule) active.push(rule);
    else unknown.push(id);
  }
  return { active, unknown };
}
