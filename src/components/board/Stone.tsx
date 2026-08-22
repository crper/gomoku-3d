import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BLACK, type Player } from "@/lib/gomoku/types";
import type { ViewMode } from "@/hooks/useViewMode";
import {
  C_BASE_BLACK,
  C_BASE_WHITE,
  C_DIM_BLACK,
  C_DIM_WHITE,
  GUIDE_COLOR,
  REDUCED,
  REST_Y,
  STONE_FLAT,
  STONE_RADIUS,
  TAU,
  easeOutBack,
  easeOutCubic,
  easeOutQuad,
  gridToWorld,
  squashFactor,
  stoneColor,
} from "./shared";

/**
 * A single stone.
 *
 * fx-spec §1 (drop / bounce entrance), §5.1 (win-line travelling shimmer),
 * §5.2 (win-line hop, or XZ pulse in 2D) and §5.3 (dimming) all share this one
 * `useFrame` callback. When nothing is animating the callback early-returns
 * (§1.1 perf guard) so a full 225-stone board costs nothing per frame.
 */
export function Stone({
  x,
  y,
  player,
  highlight,
  entrance,
  viewMode,
  winIndex,
  dimK,
  dimMs,
}: {
  x: number;
  y: number;
  player: Player;
  highlight?: boolean;
  /** "bounce" = the freshly played stone; "pop" = bulk (re)mount. */
  entrance: "bounce" | "pop";
  viewMode: ViewMode;
  /** 0–4 position along the winning line; undefined = not a winning stone. */
  winIndex?: number;
  /** Target dim amount: 0 none, 0.5 draw, 1 victory (non-winning stones). */
  dimK: number;
  dimMs: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const t = useRef(0);
  const settled = useRef(false);
  const dimP = useRef(0);
  const igniteAt = useRef<number | null>(null);
  // Frozen at mount: a later lastMove change must not restart / swap the
  // entrance animation of an already-placed stone.
  const mode = useRef<"bounce" | "pop">(
    entrance === "bounce" && !REDUCED ? "bounce" : "pop",
  ).current;

  const [wx, , wz] = gridToWorld(x, y);
  const color = stoneColor(player);
  const baseColor = player === BLACK ? C_BASE_BLACK : C_BASE_WHITE;
  const dimColor = player === BLACK ? C_DIM_BLACK : C_DIM_WHITE;
  // §1.2 black is heavier / slower, white lighter / snappier.
  const dur = player === BLACK ? 0.28 : 0.23;
  const c1 = player === BLACK ? 1.4 : 1.95;

  useFrame(({ clock }, delta) => {
    const mesh = ref.current;
    if (!mesh) return;

    const wi = winIndex;
    const waveOn = wi !== undefined && !REDUCED;
    const dimOn = dimK > 0 && dimP.current < 1;
    const entranceOn = !settled.current;
    // §1.1 performance guard: fully settled, non-winning, non-dimming stones
    // do zero work per frame.
    if (!waveOn && !dimOn && !entranceOn) return;

    if (entranceOn) {
      t.current += delta;
      if (mode === "pop") {
        // §1.5 / §8.3-1 degraded + bulk-mount path: 160ms easeOutCubic.
        const p = Math.min(1, t.current / 0.16);
        const e = easeOutCubic(p);
        mesh.scale.set(e, e * STONE_FLAT, e);
        mesh.position.y = REST_Y;
        if (p >= 1) {
          mesh.scale.set(1, STONE_FLAT, 1);
          settled.current = true;
        }
      } else {
        const p = Math.min(1, t.current / dur);
        const s = easeOutBack(p, c1);
        // §8.4-1: the Y drop and the touch-down squash are invisible from the
        // locked top-down camera, so 2D runs the XZ overshoot only.
        const is3d = viewMode === "3d";
        const sq = is3d ? squashFactor(t.current, dur) : 1;
        mesh.scale.set(s, s * STONE_FLAT * sq, s);
        mesh.position.y = is3d
          ? REST_Y + 0.55 * (1 - easeOutCubic(Math.min(1, (t.current * 1000) / 120)))
          : REST_Y;
        if (p >= 1) {
          mesh.scale.set(1, STONE_FLAT, 1);
          mesh.position.y = REST_Y;
          settled.current = true;
        }
      }
    }

    if (dimOn) {
      // §5.3 stock-based interpolation (never accumulate frame-rate dependent
      // lerps). §8.3-5c: reduced motion applies the same end state instantly.
      dimP.current = REDUCED ? 1 : Math.min(1, dimP.current + (delta * 1000) / dimMs);
      const m = matRef.current;
      if (m) m.color.lerpColors(baseColor, dimColor, dimK * easeOutQuad(dimP.current));
    }

    if (waveOn && wi !== undefined) {
      const tms = clock.elapsedTime * 1000;
      if (igniteAt.current === null) igniteAt.current = tms;
      // §5.1 one-shot ignition order: stone i only lights up after i*120ms.
      const w =
        tms - igniteAt.current >= wi * 120
          ? Math.max(0, Math.sin((TAU * (tms - wi * 216)) / 1800))
          : 0;
      const m = matRef.current;
      if (m) m.emissiveIntensity = 0.25 + 0.85 * w * w * w;
      // Transform is only taken over once the entrance finished, so the two
      // animations never fight over scale/position.
      if (settled.current) {
        if (viewMode === "3d") {
          // §5.2 3D: hop.
          mesh.position.y = REST_Y + 0.35 * w * w;
          mesh.scale.set(1, STONE_FLAT, 1);
        } else {
          // §5.2 / §8.4-5b 2D substitute: in-phase XZ scale pulse to 112%.
          const s = 1 + 0.12 * w * w;
          mesh.position.y = REST_Y;
          mesh.scale.set(s, STONE_FLAT, s);
        }
      }
    }
  });

  const isWinStone = winIndex !== undefined;

  return (
    <mesh ref={ref} position={[wx, REST_Y, wz]} castShadow receiveShadow scale={[0, 0, 0]}>
      <sphereGeometry args={[STONE_RADIUS, 40, 28]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        roughness={player === BLACK ? 0.32 : 0.45}
        metalness={0.15}
        emissive={isWinStone || highlight ? GUIDE_COLOR : "#000000"}
        emissiveIntensity={
          // §8.3-5a: reduced motion holds the winning five at a static 0.6.
          isWinStone ? (REDUCED ? 0.6 : 0.25) : highlight ? 0.35 : 0
        }
      />
    </mesh>
  );
}
