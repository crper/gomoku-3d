import { useEffect, useMemo } from "react";
import { coordName } from "@/lib/gomoku/coords";
import type { Move } from "@/lib/gomoku/types";
import { buildEdgeLabelTexture, makeCoordBadgeTexture } from "./textures";
import { PLANE, gridToWorld } from "./shared";

/** One transparent plane over the board carrying all 30 edge labels. */
export function BoardLabels() {
  const tex = useMemo(buildEdgeLabelTexture, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 0.036, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[PLANE, PLANE]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

/**
 * Coordinate badge for the hovered intersection. Flips toward the board
 * centre near the right/bottom edges so it always stays on the board.
 */
export function CoordBadge({ move }: { move: Move }) {
  const tex = useMemo(() => makeCoordBadgeTexture(coordName(move.x, move.y)), [move]);
  useEffect(() => () => tex.dispose(), [tex]);
  const [wx, , wz] = gridToWorld(move.x, move.y);
  const offX = wx > 5 ? -0.95 : 0.95;
  const offZ = wz > 5 ? -0.55 : 0.55;
  return (
    <mesh position={[wx + offX, 0.55, wz + offZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
      <planeGeometry args={[1.35, 0.5]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}
