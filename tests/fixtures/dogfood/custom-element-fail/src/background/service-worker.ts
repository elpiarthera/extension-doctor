// FIXTURE PROVENANCE: minimal synthetic entry point, standing in for
// gptpowerups-extension's real background/service-worker.ts, so
// buildExportGraph has a resolvable manifest.background.service_worker.
// Deliberately does not import anything under src/ui — the real defect
// (ui/lit-ui-register.ts orphan, audit react-doctor VD SIGNAL FORT) is a
// content-script-side registration gap, unrelated to the background bundle.
export {};
