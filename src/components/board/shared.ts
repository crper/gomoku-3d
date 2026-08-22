import * as THREE from "three";
import { BLACK, type Player } from "@/lib/gomoku/types";

// ---------------------------------------------------------------------------
// Shared board geometry, palette and math helpers.
// Every board subcomponent imports from here — single source of truth for the
// fx-spec dimensions (§0) and the reduced-motion flag (§0.2).
// ---------------------------------------------------------------------------

export const SPACING = 1;
export const HALF = (15 - 1) / 2; // 7
export const PLANE = 16;
export const STONE_RADIUS = 0.42;
export const STONE_FLAT = 0.45;
/** Resting centre height of a placed stone (fx-spec §0.4). */
export const REST_Y = STONE_RADIUS * STONE_FLAT; // 0.189

export const BLACK_COLOR = "#16161a";
export const WHITE_COLOR = "#f4f4f5";
export const BOARD_COLOR = "#e9cfa3";
export const GUIDE_COLOR = "#f97316";
/** fx-spec §0.3: wood-toned dust ripple, darker than the board. */
export const DUST_COLOR = "#b78a54";

export const STAR_POINTS: ReadonlyArray<[number, number]> = [
  [3, 3],
  [3, 11],
  [11, 3],
  [11, 11],
  [7, 7],
];

/** fx-spec §5.3: victory / draw dim targets, pre-parsed once. */
export const C_BASE_BLACK = new THREE.Color(BLACK_COLOR);
export const C_BASE_WHITE = new THREE.Color(WHITE_COLOR);
export const C_DIM_BLACK = new THREE.Color("#0b0b0d");
export const C_DIM_WHITE = new THREE.Color("#a8a29e");

export const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// fx-spec §0.1 easing library (module-level pure functions)
// ---------------------------------------------------------------------------

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
/** Overshoot rebound; larger c1 = higher overshoot. */
export const easeOutBack = (t: number, c1: number) => {
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// fx-spec §0.2: single reduced-motion entry point for the whole scene.
// Module-level constant — every effect below reads this one flag.
// ---------------------------------------------------------------------------

export const REDUCED =
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function gridToWorld(x: number, y: number): [number, number, number] {
  return [(x - HALF) * SPACING, 0, (y - HALF) * SPACING];
}

export function worldToGrid(p: THREE.Vector3): { x: number; y: number } | null {
  const gx = Math.round(p.x / SPACING + HALF);
  const gy = Math.round(p.z / SPACING + HALF);
  if (gx < 0 || gx > 14 || gy < 0 || gy > 14) return null;
  const [wx, , wz] = gridToWorld(gx, gy);
  if (Math.hypot(p.x - wx, p.z - wz) > 0.5) return null;
  return { x: gx, y: gy };
}

export function stoneColor(player: Player): string {
  return player === BLACK ? BLACK_COLOR : WHITE_COLOR;
}

/**
 * fx-spec §1.3 touch-down squash, applied to the Y scale only (3D view).
 * 120–170ms: 1.0 → 0.84; 170ms → D: 0.84 → 1.0; flat 1.0 elsewhere.
 */
export function squashFactor(tSec: number, dSec: number): number {
  const tms = tSec * 1000;
  if (tms < 120) return 1;
  if (tms < 170) return 1 - 0.16 * easeOutQuad((tms - 120) / 50);
  const dms = dSec * 1000;
  if (tms < dms) return 0.84 + 0.16 * easeOutQuad((tms - 170) / (dms - 170));
  return 1;
}
