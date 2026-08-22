import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Move } from "@/lib/gomoku/types";
import {
  DUST_COLOR,
  GUIDE_COLOR,
  REDUCED,
  STONE_RADIUS,
  TAU,
  easeOutCubic,
  easeOutQuad,
  gridToWorld,
} from "./shared";

/**
 * fx-spec §2: dust ripple kicked up at the landing point.
 * Mounted keyed by move, self-unmounts once both rings finished so R3F
 * disposes the JSX-declared materials automatically (no manual pooling).
 */
export function ImpactRipple({ move }: { move: Move }) {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const doneRef = useRef(false);
  const [done, setDone] = useState(false);
  const [wx, , wz] = gridToWorld(move.x, move.y);
  // Both rings share one geometry; only the materials animate independently.
  const geo = useMemo(() => new THREE.RingGeometry(0.3, 0.4, 40), []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, delta) => {
    if (doneRef.current) return;
    t.current += delta;
    const tms = t.current * 1000;

    if (r1.current) {
      const p = Math.min(1, tms / 450);
      const s = 1 + easeOutCubic(p) * 1.2; // 1.0 → 2.2
      r1.current.scale.set(s, s, 1);
      (r1.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.pow(1 - p, 1.5);
    }
    if (r2.current) {
      const p = Math.min(1, Math.max(0, (tms - 90) / 380));
      const s = 0.8 + easeOutCubic(p) * 0.9; // 0.8 → 1.7
      r2.current.scale.set(s, s, 1);
      (r2.current.material as THREE.MeshBasicMaterial).opacity =
        tms < 90 ? 0 : 0.32 * Math.pow(1 - p, 1.5);
    }
    if (tms >= 470) {
      // Fires exactly once — guarded by a ref, never a setState loop.
      doneRef.current = true;
      setDone(true);
    }
  });

  if (done) return null;

  return (
    <group>
      <mesh
        ref={r1}
        geometry={geo}
        position={[wx, 0.055, wz]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <meshBasicMaterial color={DUST_COLOR} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh
        ref={r2}
        geometry={geo}
        position={[wx, 0.052, wz]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
        scale={[0.8, 0.8, 1]}
      >
        <meshBasicMaterial color={DUST_COLOR} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * fx-spec §5.1: the bar is demoted to a backing layer (slow 0.5 Hz, narrower
 * band) now that the per-stone travelling shimmer carries the victory read.
 * Callers must guarantee `line.length >= 2`.
 *
 * `animated` is deliberately NOT "did the human win" — highlighting the five
 * decisive stones is information, not celebration, so it runs for either side.
 */
export function WinLine({ line, animated }: { line: Move[]; animated?: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const a = gridToWorld(line[0].x, line[0].y);
  const b = gridToWorld(line[line.length - 1].x, line[line.length - 1].y);
  const mid: [number, number, number] = [(a[0] + b[0]) / 2, 0.5, (a[2] + b[2]) / 2];
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]) + STONE_RADIUS;
  const angle = Math.atan2(b[2] - a[2], b[0] - a[0]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    if (animated && !REDUCED) {
      const t = (Math.sin(TAU * 0.5 * clock.elapsedTime) + 1) / 2; // 0..1
      matRef.current.emissiveIntensity = 0.55 + t * 0.35; // 0.55..0.90
    } else {
      matRef.current.emissiveIntensity = 0.9;
    }
  });

  return (
    <mesh position={mid} rotation={[0, -angle, 0]}>
      <boxGeometry args={[len, 0.08, 0.08]} />
      <meshStandardMaterial
        ref={matRef}
        color={GUIDE_COLOR}
        emissive={GUIDE_COLOR}
        emissiveIntensity={0.9}
      />
    </mesh>
  );
}

/** A soft, pulsing radial glow used during the victory celebration. */
export function CelebrationGlow() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = REDUCED ? 0 : (Math.sin(clock.elapsedTime * 2) + 1) / 2; // 0..1
    const s = 1 + t * 0.08;
    ref.current.scale.set(s, s, s);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = (REDUCED ? 0.12 : 0.1) + t * 0.06;
  });
  return (
    <mesh ref={ref} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[9, 48]} />
      <meshBasicMaterial
        color="#ff8a3d"
        transparent
        opacity={0.12}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * fx-spec §4: last-move marker — an expanding outer ring plus a new static
 * breathing inner ring. `fading` (§7.2 draw) runs a 400ms linear fade and then
 * unmounts the whole group.
 */
export function LastMovePulse({ move, fading }: { move: Move; fading?: boolean }) {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const fade = useRef(1);
  const goneRef = useRef(false);
  const [gone, setGone] = useState(false);
  const [wx, , wz] = gridToWorld(move.x, move.y);

  useFrame(({ clock }, delta) => {
    if (goneRef.current) return;
    if (fading) {
      // §8.3-7b: reduced motion drops it instantly.
      fade.current = REDUCED ? 0 : Math.max(0, fade.current - delta / 0.4);
      if (fade.current <= 0) {
        goneRef.current = true;
        setGone(true);
        return;
      }
    }
    const f = fade.current;
    if (inner.current) {
      (inner.current.material as THREE.MeshBasicMaterial).opacity = REDUCED
        ? // §8.3-4: static inner ring only.
          0.4 * f
        : (0.35 + 0.15 * Math.sin(TAU * 0.7 * clock.elapsedTime)) * f;
    }
    if (!REDUCED && outer.current) {
      const t = (clock.elapsedTime % 1.6) / 1.6;
      const s = 0.75 + easeOutQuad(t) * 0.95; // 0.75 → 1.70
      outer.current.scale.set(s, s, 1);
      (outer.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t) * f;
    }
  });

  if (gone) return null;

  return (
    <group>
      {!REDUCED && (
        <mesh ref={outer} position={[wx, 0.219, wz]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.54, 40]} />
          <meshBasicMaterial color={GUIDE_COLOR} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
      <mesh ref={inner} position={[wx, 0.216, wz]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.52, 40]} />
        <meshBasicMaterial color={GUIDE_COLOR} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * fx-spec §4-style marker for the hint feature: a soft emerald beacon over the
 * suggested intersection (breathing ring + static core). Reduced motion shows
 * a static ring only. Purely visual — never intercepts pointer events.
 */
export function HintMarker({ move }: { move: Move }) {
  const ring = useRef<THREE.Mesh>(null);
  const [wx, , wz] = gridToWorld(move.x, move.y);

  useFrame(({ clock }) => {
    if (!ring.current || REDUCED) return;
    const t = (Math.sin(TAU * 0.8 * clock.elapsedTime) + 1) / 2; // 0..1
    const s = 0.9 + t * 0.25;
    ring.current.scale.set(s, s, 1);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + t * 0.3;
  });

  return (
    <group>
      <mesh ref={ring} position={[wx, 0.222, wz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.4, 0.56, 40]} />
        <meshBasicMaterial
          color="#10b981"
          transparent
          opacity={REDUCED ? 0.55 : 0.5}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[wx, 0.22, wz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <circleGeometry args={[0.12, 24]} />
        <meshBasicMaterial
          color="#34d399"
          transparent
          opacity={REDUCED ? 0.7 : 0.65}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * fx-spec §6: a very quiet breathing frame around the board rim while the AI
 * thinks. Four thin bars share a single material (their opacity is always in
 * sync). Calls `onFadedOut` when the 450ms exit envelope reaches zero so the
 * parent can unmount it and release the four draw calls.
 */
export function ThinkingFrame({
  thinking,
  onFadedOut,
}: {
  thinking: boolean;
  onFadedOut: () => void;
}) {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: GUIDE_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const lin = useRef(REDUCED && thinking ? 1 : 0);
  const releasedRef = useRef(false);

  useFrame(({ clock }, delta) => {
    if (thinking) {
      // A new AI turn starting before the exit envelope finished re-arms the
      // one-shot release guard instead of leaving the frame permanently dead.
      releasedRef.current = false;
      // §8.3-6: reduced motion enters / leaves instantly.
      lin.current = REDUCED ? 1 : Math.min(1, lin.current + delta / 0.3);
    } else if (releasedRef.current) {
      return;
    } else {
      lin.current = REDUCED ? 0 : Math.max(0, lin.current - delta / 0.45);
      if (lin.current <= 0) {
        mat.opacity = 0;
        releasedRef.current = true;
        onFadedOut();
        return;
      }
    }
    const env = thinking ? easeOutQuad(lin.current) : 1 - easeOutQuad(1 - lin.current);
    mat.opacity = REDUCED
      ? env * 0.14
      : env * (0.12 + (0.12 * (Math.sin((TAU * clock.elapsedTime) / 2.4) + 1)) / 2);
  });

  return (
    <group>
      {[-7.6, 7.6].map((z) => (
        <mesh key={`h${z}`} position={[0, 0.026, z]} material={mat}>
          <boxGeometry args={[15.2, 0.02, 0.08]} />
        </mesh>
      ))}
      {[-7.6, 7.6].map((x) => (
        <mesh key={`v${x}`} position={[x, 0.026, 0]} material={mat}>
          <boxGeometry args={[0.08, 0.02, 15.2]} />
        </mesh>
      ))}
    </group>
  );
}
