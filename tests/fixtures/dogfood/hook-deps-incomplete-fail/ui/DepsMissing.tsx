// FIXTURE PROVENANCE: synthetic, labeled — `count` is read inside the
// effect body but the dependency array is empty, so the effect closes over
// a stale value of `count` after the first render.
import { useEffect, useState } from "preact/hooks";

export function DepsMissing(): null {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.log(count);
  }, []);
  return null;
}
