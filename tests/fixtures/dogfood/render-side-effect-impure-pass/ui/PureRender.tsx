// FIXTURE PROVENANCE: synthetic, labeled — same shape as
// render-side-effect-impure-fail/ui/ImpureRender.tsx, with the same
// localStorage write moved into a useEffect (runs on mount/update, not
// every render) and into an event handler (runs on user interaction, not
// during render).
import { useEffect } from "preact/hooks";

export function PureRender(): null {
  useEffect(() => {
    localStorage.setItem("gptu-last-open", Date.now().toString());
  }, []);

  function handleClick(): void {
    localStorage.setItem("gptu-click", "1");
  }

  return null;
}
