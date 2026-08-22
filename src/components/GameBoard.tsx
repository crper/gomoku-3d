import * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, RoundedBox, ContactShadows } from "@react-three/drei";
import { Board, Move, Player, idx } from "@/lib/gomoku/types";
import type { ViewMode } from "@/hooks/useViewMode";
import {
  BOARD_COLOR,
  HALF,
  PLANE,
  REDUCED,
  SPACING,
  STAR_POINTS,
  gridToWorld,
  worldToGrid,
} from "./board/shared";
import { Stone } from "./board/Stone";
import {
  CelebrationGlow,
  HintMarker,
  ImpactRipple,
  LastMovePulse,
  ThinkingFrame,
  WinLine,
} from "./board/Effects";
import { HoverPreview } from "./board/HoverPreview";
import { BoardLabels, CoordBadge } from "./board/Coordinates";
import { CAM_2D, CAM_3D, CameraRig } from "./board/CameraRig";

/** Wood grid lines + star points (fx-spec §0 furniture). */
function GridLines() {
  const lines = useMemo(() => {
    const arr: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (let g = 0; g < 15; g++) {
      const w = (g - HALF) * SPACING;
      // vertical
      arr.push({ pos: [w, 0.012, 0], size: [0.025, 0.02, PLANE - 2] });
      // horizontal
      arr.push({ pos: [0, 0.012, w], size: [PLANE - 2, 0.02, 0.025] });
    }
    return arr;
  }, []);

  return (
    <group>
      {lines.map((l, i) => (
        <mesh key={i} position={l.pos}>
          <boxGeometry args={l.size} />
          <meshStandardMaterial color="#5b4632" roughness={0.8} />
        </mesh>
      ))}
      {STAR_POINTS.map(([x, y]) => {
        const [wx, , wz] = gridToWorld(x, y);
        return (
          <mesh key={`sp-${x}-${y}`} position={[wx, 0.02, wz]}>
            <cylinderGeometry args={[0.08, 0.08, 0.03, 16]} />
            <meshStandardMaterial color="#3f2f1d" roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

function InteractionPlane({
  interactive,
  onHover,
  onPlace,
}: {
  interactive: boolean;
  onHover: (m: Move | null) => void;
  onPlace: (m: Move) => void;
}) {
  const handle = (e: ThreeEvent<PointerEvent>) => {
    const g = worldToGrid(e.point);
    onHover(g);
    return g;
  };
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.005, 0]}
      onPointerMove={(e) => {
        e.stopPropagation();
        handle(e);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        const g = worldToGrid(e.point);
        if (g && interactive) onPlace(g);
      }}
    >
      <planeGeometry args={[PLANE, PLANE]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export interface GameBoardProps {
  board: Board;
  currentPlayer: Player;
  interactive: boolean;
  lastMove: Move | null;
  winLine: Move[] | null;
  onHover: (m: Move | null) => void;
  onPlace: (m: Move) => void;
  /**
   * The *human* won — purely celebratory extras (the ground glow) only.
   * Win-line highlighting is informational and keys off `winLine` instead, so
   * it still plays when the AI wins.
   */
  celebrate?: boolean;
  /** "3d" = free orbit (default), "2d" = locked top-down, zoom only. */
  viewMode?: ViewMode;
  /** True while the AI is computing its move (drives the §6 thinking frame). */
  thinking?: boolean;
  /** Explicit draw signal from the App layer (`status === "draw"`). */
  drawn?: boolean;
  /** Suggested intersection from the hint feature; null hides the marker. */
  hint?: Move | null;
}

function Scene({
  board,
  currentPlayer,
  interactive,
  lastMove,
  winLine,
  onHover,
  onPlace,
  celebrate,
  viewMode = "3d",
  thinking,
  drawn,
  hint,
}: GameBoardProps) {
  const [hover, setHover] = useState<Move | null>(null);
  // Explicit interaction policy while the camera tween runs: hover preview
  // stays live (harmless), but placement is blocked to prevent mis-clicks on
  // a moving camera. setCamTweening is a stable setState fn (safe effect dep).
  const [camTweening, setCamTweening] = useState(false);
  // The thinking frame outlives `thinking` by its 450ms exit envelope.
  const [frameAlive, setFrameAlive] = useState(false);
  // Frozen at first render: OrbitControls JSX props match the persisted mode
  // so there is no 1-frame polar-clamp flicker at mount. All later mode
  // changes are applied imperatively by CameraRig (R3F never re-applies
  // unchanged JSX props, so the two never fight).
  const initialMode = useRef(viewMode).current;
  const hoverValid = hover !== null && board[idx(hover.x, hover.y)] === 0;

  const stones = useMemo(() => {
    const list: { x: number; y: number; p: Player }[] = [];
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const s = board[idx(x, y)];
        if (s !== 0) list.push({ x, y, p: s as Player });
      }
    }
    return list;
  }, [board]);

  // §5.1: winning-line order, resolved once per win instead of per stone.
  // Gated on `winLine`, NOT on `celebrate`: the shimmer / hop / dimming answer
  // "which five stones decided this game", which the loser needs to see just
  // as much as the winner. Only confetti and the ground glow are celebratory.
  const winIndexMap = useMemo(() => {
    if (!winLine) return null;
    const m = new Map<string, number>();
    winLine.forEach((mv, i) => m.set(`${mv.x}-${mv.y}`, i));
    return m;
  }, [winLine]);

  useEffect(() => {
    if (thinking) setFrameAlive(true);
  }, [thinking]);
  const releaseFrame = useCallback(() => setFrameAlive(false), []);

  const hoverOnLastMove = !!hover && !!lastMove && hover.x === lastMove.x && hover.y === lastMove.y;

  return (
    <>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={["#fff7ed", "#7c5c3e", 0.45]} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[-8, 6, -4]} intensity={0.3} />

      <CameraRig viewMode={viewMode} onTweeningChange={setCamTweening} />

      <InteractionPlane
        interactive={interactive && !camTweening}
        onHover={(m) => {
          setHover(m);
          onHover(m);
        }}
        onPlace={onPlace}
      />

      {/* board base */}
      <RoundedBox
        args={[PLANE, 0.8, PLANE]}
        radius={0.35}
        smoothness={4}
        position={[0, -0.4, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={BOARD_COLOR} roughness={0.7} />
      </RoundedBox>

      {/* soft grounding shadow under the floating board */}
      <ContactShadows
        position={[0, -0.86, 0]}
        opacity={0.4}
        scale={26}
        blur={3}
        far={3}
        color="#3f2f1d"
      />

      <GridLines />

      {/* coordinate system: static edge labels + hover badge (placement aid,
          so gated on interactivity like the full-strength crosshair) */}
      <BoardLabels />
      {interactive && hover && <CoordBadge move={hover} />}

      {frameAlive && <ThinkingFrame thinking={!!thinking} onFadedOut={releaseFrame} />}

      {stones.map((s) => {
        const key = `${s.x}-${s.y}`;
        const isLast = !!lastMove && lastMove.x === s.x && lastMove.y === s.y;
        const wi = winIndexMap?.get(key);
        return (
          <Stone
            key={key}
            x={s.x}
            y={s.y}
            player={s.p}
            highlight={isLast}
            entrance={isLast ? "bounce" : "pop"}
            viewMode={viewMode}
            winIndex={wi}
            // §5.3 / §7.2: dim the non-decisive stones whenever the game ended
            // with a line (either side), or half as much on a draw.
            dimK={winLine ? (wi === undefined ? 1 : 0) : drawn ? 0.5 : 0}
            dimMs={winLine ? 500 : 600}
          />
        );
      })}

      {/* §2: replays on every new lastMove (keyed), self-unmounts after 470ms */}
      {lastMove && !REDUCED && <ImpactRipple key={`${lastMove.x}-${lastMove.y}`} move={lastMove} />}

      {/* §4.2 avoidance: never shown under a win, never fought with a same-cell hover */}
      {lastMove && !winLine && !hoverOnLastMove && <LastMovePulse move={lastMove} fading={drawn} />}

      {/* hint beacon: hidden once a stone lands on the suggested cell */}
      {hint && board[idx(hint.x, hint.y)] === 0 && <HintMarker move={hint} />}

      <HoverPreview
        hover={hover}
        player={currentPlayer}
        valid={hoverValid}
        interactive={interactive}
      />

      {winLine && winLine.length >= 2 && <WinLine line={winLine} animated />}

      {celebrate && !REDUCED && <CelebrationGlow />}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableRotate={initialMode === "3d"}
        minDistance={14}
        maxDistance={30}
        minPolarAngle={initialMode === "2d" ? 0 : 0.15}
        maxPolarAngle={initialMode === "2d" ? 0 : Math.PI / 2.6}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function GameBoard(props: GameBoardProps) {
  // Canvas `camera` is only read at creation; freeze the initial position so
  // a persisted "2d" mode starts top-down without a first-frame 3D flash.
  // Mode switches afterwards are handled by CameraRig — the Canvas itself is
  // NEVER remounted, so the ongoing game / scene state is fully preserved.
  const initialPos = useRef<[number, number, number]>(
    (props.viewMode ?? "3d") === "2d"
      ? [CAM_2D.x, CAM_2D.y, CAM_2D.z]
      : [CAM_3D.x, CAM_3D.y, CAM_3D.z],
  ).current;
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      camera={{ position: initialPos, fov: 42 }}
      className="rounded-xl"
    >
      <color attach="background" args={["#f6efe6"]} />
      <Scene {...props} />
    </Canvas>
  );
}
