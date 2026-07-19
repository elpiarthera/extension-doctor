// FIXTURE PROVENANCE: synthetic, labeled — models a resize-tracking effect
// that subscribes to a window event but never returns a cleanup function,
// leaking the listener across every re-mount of the component.
import { useEffect } from "preact/hooks";

export function UseEffectLeak(): null {
  useEffect(() => {
    function onResize(): void {
      console.log(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
  }, []);
  return null;
}
