import { BOARD_SIZE } from "./types";

/**
 * Human-readable board coordinates (Renju convention):
 * - columns A..O, left to right (x: 0..14)
 * - rows 15..1, top to bottom on screen — i.e. row numbers grow upward,
 *   like a Go board (y: 0 is the top edge → "15", y: 14 → "1")
 * The centre point (7,7) therefore reads "H8".
 */

export function colName(x: number): string {
  return String.fromCharCode(65 + x);
}

export function rowName(y: number): string {
  return String(BOARD_SIZE - y);
}

/** Full intersection name, e.g. (7,7) → "H8". */
export function coordName(x: number, y: number): string {
  return `${colName(x)}${rowName(y)}`;
}
