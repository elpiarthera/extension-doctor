// FIXTURE PROVENANCE: real, derived from gptpowerups-extension@6668928a
// ui/components/inline/MediaActionBar.tsx:43 and
// ui/components/slash/SlashTrigger.tsx:48 — a state identifier that only
// ever occurs inside a QUOTED STRING LITERAL (a DOM event name) inside the
// effect body must never be treated as a "read" of that state. The real
// read of `offline`, if any, happens OUTSIDE the effect.
import { useEffect, useState } from "preact/hooks";

export function MediaActionBarLike(): null {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, []);

  // real read of `offline`, OUTSIDE the effect — not part of this rule's scope
  return offline ? null : null;
}

export function SlashTriggerLike(): null {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("gptu:open-slash-menu", handler);
    return () => window.removeEventListener("gptu:open-slash-menu", handler);
  }, []);

  return open ? null : null;
}
