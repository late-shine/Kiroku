import { useEffect, useState } from "react";

/** Unknown/unsupported preferences default to still, including the first hydrated render. */
export function useMotionPreference(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const query = window.matchMedia("(prefers-reduced-motion: no-preference)");
      const update = () => setAllowed(query.matches);
      query.addEventListener("change", update);
      update();
      return () => query.removeEventListener("change", update);
    } catch {
      setAllowed(false);
      return undefined;
    }
  }, []);
  return allowed;
}
