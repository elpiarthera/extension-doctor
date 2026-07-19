// FIXTURE PROVENANCE: synthetic, labeled — three accepted shapes: a
// resource-acquiring effect that returns a matching cleanup function, a
// pure effect with no resource acquisition (nothing to clean up), and a
// resource-acquiring effect carrying a declared
// // ed-effect-no-cleanup: exception comment.
import { useEffect } from "preact/hooks";

export function UseEffectClean(): null {
  useEffect(() => {
    function onResize(): void {
      console.log(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return null;
}

export function UseEffectPure(): null {
  useEffect(() => {
    console.log("mounted");
  }, []);
  return null;
}

export function UseEffectDeclaredException(): null {
  useEffect(() => {
    // ed-effect-no-cleanup: host page tears this listener down itself on unload
    window.addEventListener("beforeunload", () => {
      console.log("bye");
    });
  }, []);
  return null;
}
