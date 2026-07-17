# FIXTURE PROVENANCE

Synthetic fixture (preventive rule, see runtime-external-messaging-exposure-fail
PROVENANCE for why no real defect exists to extract). Same handler shape as
the fail fixture, but the body validates `sender.id` against an allow-list
before doing anything else — the standard onMessageExternal guard pattern.
