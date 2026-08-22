import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { ViewMode } from "@/hooks/useViewMode";
import { REDUCED, easeInOutCubic } from "./shared";

export const CAM_3D = new THREE.Vector3(0, 16, 15);
/** Tiny z offset avoids a degenerate lookAt (camera exactly on the up axis). */
export const CAM_2D = new THREE.Vector3(0, 22, 0.0001);
const TWEEN_DURATION = 0.6; // seconds
const POLAR_MIN_3D = 0.15;
const POLAR_MAX_3D = Math.PI / 2.6;

/**
 * Apply per-mode OrbitControls constraints imperatively (the JSX props keep
 * the 3D defaults; R3F only re-applies props when they change, so these
 * imperative overrides are never clobbered by re-renders).
 * - 2D: rotation hard-locked (enableRotate=false AND polar clamped to ~0,
 *   Spherical.makeSafe keeps phi at EPS so there is no gimbal lock). Zoom kept.
 * - 3D: full original freedom restored.
 */
function applyModeConstraints(controls: OrbitControlsImpl, mode: ViewMode): void {
  controls.enableRotate = mode === "3d";
  controls.minPolarAngle = mode === "2d" ? 0 : POLAR_MIN_3D;
  controls.maxPolarAngle = mode === "2d" ? 0 : POLAR_MAX_3D;
}

/**
 * Drives the camera when `viewMode` changes: a 600ms easeInOutCubic position
 * tween (instant when prefers-reduced-motion). During the tween the controls
 * are disabled so drei's per-frame `controls.update()` cannot fight the tween
 * (drei gates update() on `controls.enabled`). The Canvas is never remounted,
 * so all scene/game state survives mode switches.
 */
export function CameraRig({
  viewMode,
  onTweeningChange,
}: {
  viewMode: ViewMode;
  onTweeningChange: (tweening: boolean) => void;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const tween = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);
  const appliedMode = useRef<ViewMode | null>(null);

  useEffect(() => {
    const to = viewMode === "2d" ? CAM_2D : CAM_3D;

    const snap = () => {
      tween.current = null;
      camera.position.copy(to);
      camera.lookAt(0, 0, 0);
      if (controls) {
        applyModeConstraints(controls, viewMode);
        controls.target.set(0, 0, 0);
        controls.enabled = true;
        controls.update();
      }
      onTweeningChange(false);
    };

    if (appliedMode.current === viewMode) {
      // Same mode re-run (e.g. controls instance arrived after mount):
      // just (re)apply constraints, never tween.
      if (controls) {
        applyModeConstraints(controls, viewMode);
        controls.target.set(0, 0, 0);
        controls.update();
      }
      return;
    }

    const isFirst = appliedMode.current === null;
    appliedMode.current = viewMode;

    if (isFirst || REDUCED) {
      // Initial placement (persisted mode) or reduced motion: no animation.
      snap();
      return;
    }

    // Animated transition: freeze controls, tween from wherever the camera
    // currently is (covers "user rotated in 3D, must return to exact top-down").
    if (controls) controls.enabled = false;
    tween.current = { from: camera.position.clone(), to: to.clone(), t: 0 };
    onTweeningChange(true);
  }, [viewMode, camera, controls, onTweeningChange]);

  useFrame((_, delta) => {
    const tw = tween.current;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + delta / TWEEN_DURATION);
    camera.position.lerpVectors(tw.from, tw.to, easeInOutCubic(tw.t));
    camera.lookAt(0, 0, 0);
    if (tw.t >= 1) {
      tween.current = null;
      if (controls) {
        applyModeConstraints(controls, viewMode);
        controls.target.set(0, 0, 0);
        controls.enabled = true;
        controls.update();
      }
      onTweeningChange(false);
    }
  });

  return null;
}
