// FIXTURE PROVENANCE: synthetic, labeled — same shape as
// hook-deps-incomplete-fail/ui/DepsMissing.tsx, with two accepted fixes: the
// referenced state value is listed in the dependency array, and a
// run-once mount effect carries a declared
// // ed-deps-intentional: exception comment for the one legitimate case
// where reading a value only at mount time is the intended behavior.
import { useEffect, useState } from "preact/hooks";

export function DepsComplete(): null {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.log(count);
  }, [count]);
  return null;
}

export function DepsIntentionalOnce(): null {
  const [count, setCount] = useState(0);
  // ed-deps-intentional: run-once mount effect, count intentionally read at mount time only
  useEffect(() => {
    console.log(count);
  }, []);
  return null;
}

export function SetterOmittedIsFine(): null {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount((c) => c + 1);
  }, []);
  return null;
}
