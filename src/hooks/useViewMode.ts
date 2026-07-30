import { useCallback, useState } from "react";

/**
 * Board view mode:
 * - "3d": free orbit camera (current default behaviour)
 * - "2d": locked top-down camera, rotation disabled, zoom kept
 */
export type ViewMode = "2d" | "3d";

const STORAGE_KEY = "gomoku.view.v1";

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "2d" || v === "3d") return v;
  } catch {
    /* ignore (privacy mode / SSR) */
  }
  return "3d";
}

/** Persisted view-mode state. Defaults to "3d"; survives reloads via localStorage. */
export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [viewMode, setViewModeState] = useState<ViewMode>(loadViewMode);

  const setViewMode = useCallback((m: ViewMode) => {
    setViewModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  return [viewMode, setViewMode];
}
