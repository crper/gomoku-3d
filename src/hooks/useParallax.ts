import { useEffect, useState } from "react";

/**
 * Normalised mouse-parallax offset ({ x, y } ∈ [-0.5, 0.5]).
 * No-op on touch devices and under `prefers-reduced-motion`.
 */
export function useParallax(): { x: number; y: number } {
  const [par, setPar] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const onMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      setPar({ x, y });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return par;
}
