/**
 * Surgical console-noise filter. Only silences known, benign third-party
 * deprecation messages — everything else passes through untouched.
 *
 * - "THREE.Clock … deprecated": @react-three/fiber 9.7 constructs a
 *   THREE.Clock internally; three r185 deprecates it in favour of Timer.
 *   Nothing we can do app-side until fiber migrates.
 */
const SILENCED = ["THREE.Clock: This module has been deprecated"] as const;

const originalWarn = console.warn.bind(console);

console.warn = (...args: unknown[]) => {
  const first = typeof args[0] === "string" ? args[0] : "";
  if (SILENCED.some((needle) => first.includes(needle))) return;
  originalWarn(...args);
};
