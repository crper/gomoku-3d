import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Move, Player } from "@/lib/gomoku/types";
import {
  GUIDE_COLOR,
  PLANE,
  REDUCED,
  REST_Y,
  STONE_FLAT,
  STONE_RADIUS,
  TAU,
  gridToWorld,
  stoneColor,
} from "./shared";

/**
 * Outer shell: keeps the `!hover` early-return so nothing renders (and no
 * per-frame work happens) when the pointer is off the board. All hooks live in
 * `HoverPreviewInner`, which is only mounted when `hover` is non-null —
 * see fx-spec §3.1.
 */
export function HoverPreview({
  hover,
  player,
  valid,
  interactive,
}: {
  hover: Move | null;
  player: Player;
  valid: boolean;
  interactive: boolean;
}) {
  if (!hover) return null;
  return (
    <HoverPreviewInner hover={hover} player={player} valid={valid} interactive={interactive} />
  );
}

function HoverPreviewInner({
  hover,
  player,
  valid,
  interactive,
}: {
  hover: { x: number; y: number };
  player: Player;
  valid: boolean;
  interactive: boolean;
}) {
  const ghost = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const [wx, , wz] = gridToWorld(hover.x, hover.y);
  const color = stoneColor(player);

  useFrame(({ clock }) => {
    const mat = matRef.current;
    const g = ghost.current;
    if (!mat || !g) return;
    let opacity: number;
    let s = 1;
    if (REDUCED) {
      // §8.3-3: static, current behaviour.
      opacity = valid ? 0.45 : 0.18;
    } else if (!interactive) {
      // §3.4: visible position, unmistakably "not your turn".
      opacity = 0.12;
    } else if (!valid) {
      opacity = 0.18;
    } else {
      // §3.2: 0.9 Hz opacity breathing on an absolute clock phase (no jump
      // when the preview hops between intersections).
      const ph = Math.sin(TAU * 0.9 * clock.elapsedTime);
      opacity = 0.38 + 0.1 * ph;
      s = 1 + 0.015 * ph;
    }
    mat.opacity = opacity;
    g.scale.set(s, STONE_FLAT, s);
  });

  // §3.4: the full-width crosshair is hidden while it is not the player's turn.
  const showCross = REDUCED || interactive;

  return (
    <group>
      {/* ghost stone */}
      <mesh ref={ghost} position={[wx, REST_Y, wz]} scale={[1, STONE_FLAT, 1]}>
        <sphereGeometry args={[STONE_RADIUS, 32, 24]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={valid ? 0.45 : 0.18}
          roughness={0.4}
        />
      </mesh>
      {/* guide crosshair through the hovered intersection (§3.3: static) */}
      {showCross && (
        <>
          <mesh position={[0, 0.03, wz]}>
            <boxGeometry args={[PLANE - 2, 0.04, 0.06]} />
            <meshStandardMaterial
              color={GUIDE_COLOR}
              emissive={GUIDE_COLOR}
              emissiveIntensity={0.6}
              transparent
              opacity={0.7}
            />
          </mesh>
          <mesh position={[wx, 0.03, 0]}>
            <boxGeometry args={[0.06, 0.04, PLANE - 2]} />
            <meshStandardMaterial
              color={GUIDE_COLOR}
              emissive={GUIDE_COLOR}
              emissiveIntensity={0.6}
              transparent
              opacity={0.7}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
