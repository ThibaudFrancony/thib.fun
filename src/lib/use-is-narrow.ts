"use client";

import { useEffect, useState } from "react";

/** Breakpoint partagé de la navigation étroite : barre basse + mini-header. */
export const NARROW_QUERY = "(max-width: 720px)";

/** Vrai quand la fenêtre est étroite (téléphone ou fenêtre réduite). */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    setNarrow(query.matches);
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return narrow;
}
