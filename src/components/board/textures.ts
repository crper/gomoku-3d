import * as THREE from "three";
import { colName, rowName } from "@/lib/gomoku/coords";

// ---------------------------------------------------------------------------
// Canvas-built textures for the coordinate system. Pure 2D canvas — no font
// fetching, no extra dependencies, offline-safe.
// ---------------------------------------------------------------------------

const LABEL_COLOR = "#6b5138";

/** Draw all 30 edge labels into one transparent canvas texture (2× for crispness). */
export function buildEdgeLabelTexture(): THREE.CanvasTexture {
  const S = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const u = S / 16; // px per world unit
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = `600 ${Math.round(u * 0.28)}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Canvas covers world [-8, +8]² (flipY=true → canvas top == world -Z).
  // Grid line for index i sits at world i-7, so its canvas position is
  // ((i - 7) + 8) / 16 · S = ((i + 1) / 16) · S. Labels sit in the margin
  // strip just outside the outer lines (±7), before the board rim (±8).
  const MARGIN = (7.52 + 8) / 16; // fraction of S
  for (let x = 0; x < 15; x++) {
    const px = ((x + 1) / 16) * S;
    ctx.fillText(colName(x), px, MARGIN * S); // bottom edge (world +Z)
  }
  for (let y = 0; y < 15; y++) {
    const py = ((y + 1) / 16) * S;
    ctx.fillText(rowName(y), MARGIN * S, py); // left edge (world -X)
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Small rounded pill with the coordinate name, floating near the hover point. */
export function makeCoordBadgeTexture(text: string): THREE.CanvasTexture {
  const W = 256;
  const H = 96;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const r = 28;
  ctx.fillStyle = "rgba(22,22,26,0.88)";
  ctx.beginPath();
  ctx.roundRect(4, 4, W - 8, H - 8, r);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 52px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
