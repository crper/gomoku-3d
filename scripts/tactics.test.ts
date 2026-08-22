/**
 * Tactics tests: the AI rules layer (win / block / fork), hint engine, and
 * single-ply undo. Complements engine/strength/replay suites.
 */
import {
  Move,
  BLACK,
  WHITE,
  createBoard,
  idx,
  type Player,
  type Board,
} from "../src/lib/gomoku/types";
import * as engine from "../src/lib/gomoku/engine";
import { getAIMove, getHintMove, immediateWinCells, type Difficulty } from "../src/lib/gomoku/ai";
import { colName, rowName, coordName } from "../src/lib/gomoku/coords";

import { test } from "vite-plus/test";

/**
 * Vitest harness: every legacy `assert(cond, msg)` registers a named test.
 * All suites are synchronous — conditions are fully evaluated while the
 * module loads, so this wrapper preserves the original semantics 1:1.
 */
const assert = (cond: boolean, msg: string) =>
  test(msg, () => {
    if (!cond) throw new Error(`assertion failed: ${msg}`);
  });

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Build a board from [x, y, player] triples. */
function setup(stones: [number, number, Player][]): Board {
  const b = createBoard();
  for (const [x, y, p] of stones) b[idx(x, y)] = p;
  return b;
}

function isMove(m: Move | null, x: number, y: number): boolean {
  return !!m && m.x === x && m.y === y;
}

const ALL_TIERS: Difficulty[] = ["easy", "medium", "hard", "master"];
const TACTICAL_TIERS: Difficulty[] = ["medium", "hard", "master"];

// ---------------------------------------------------------------------------
// 1. immediateWinCells unit behaviour
// ---------------------------------------------------------------------------
{
  // open three -> two winning ends
  const b1 = setup([
    [5, 7, BLACK],
    [6, 7, BLACK],
    [7, 7, BLACK],
  ]);
  const wins = immediateWinCells(b1, BLACK);
  assert(wins.length === 0, "open three has no immediate winning cell");

  // four with both ends open -> exactly 2 winning cells
  const b2 = setup([
    [4, 7, BLACK],
    [5, 7, BLACK],
    [6, 7, BLACK],
    [7, 7, BLACK],
  ]);
  const wins2 = immediateWinCells(b2, BLACK);
  assert(
    wins2.length === 2 && wins2.some((m) => isMove(m, 3, 7)) && wins2.some((m) => isMove(m, 8, 7)),
    "open four yields both end cells as immediate wins",
  );

  // one end blocked -> single winning cell
  const b3 = setup([
    [3, 7, WHITE],
    [4, 7, BLACK],
    [5, 7, BLACK],
    [6, 7, BLACK],
    [7, 7, BLACK],
  ]);
  const wins3 = immediateWinCells(b3, BLACK);
  assert(wins3.length === 1 && isMove(wins3[0], 8, 7), "blocked four yields a single winning cell");
}

// ---------------------------------------------------------------------------
// 2. rule 1 — every tier takes an immediate win
// ---------------------------------------------------------------------------
{
  const board = setup([
    [5, 7, WHITE],
    [6, 7, WHITE],
    [7, 7, WHITE],
    [8, 7, WHITE],
    [5, 9, BLACK],
    [6, 9, BLACK],
    [7, 9, BLACK],
  ]);
  for (const d of ALL_TIERS) {
    const m = getAIMove(board, WHITE, d);
    assert(!!m && (isMove(m, 4, 7) || isMove(m, 9, 7)), `${d}: takes the immediate win`);
  }
}

// ---------------------------------------------------------------------------
// 3. rule 2 — every tier blocks an immediate loss
// ---------------------------------------------------------------------------
{
  const board = setup([
    [5, 7, BLACK],
    [6, 7, BLACK],
    [7, 7, BLACK],
    [8, 7, BLACK],
    [5, 9, WHITE],
    [6, 9, WHITE],
  ]);
  for (const d of ALL_TIERS) {
    const m = getAIMove(board, WHITE, d);
    assert(!!m && (isMove(m, 4, 7) || isMove(m, 9, 7)), `${d}: blocks the opponent's winning cell`);
  }
}

// ---------------------------------------------------------------------------
// 4. rule 3 — tactical tiers create an open four (guaranteed win next turn)
// ---------------------------------------------------------------------------
{
  const board = setup([
    [5, 7, WHITE],
    [6, 7, WHITE],
    [7, 7, WHITE],
    [2, 2, BLACK],
    [12, 12, BLACK],
  ]);
  for (const d of TACTICAL_TIERS) {
    const m = getAIMove(board, WHITE, d);
    assert(
      !!m && (isMove(m, 4, 7) || isMove(m, 8, 7)),
      `${d}: converts the open three into an open four`,
    );
  }
}

// ---------------------------------------------------------------------------
// 5. rule 5 — tactical tiers occupy the opponent's open-four point
// ---------------------------------------------------------------------------
{
  // black open three; white must take one of the ends
  const board = setup([
    [5, 7, BLACK],
    [6, 7, BLACK],
    [7, 7, BLACK],
    [0, 0, WHITE],
  ]);
  for (const d of TACTICAL_TIERS) {
    const m = getAIMove(board, WHITE, d);
    assert(
      !!m && (isMove(m, 4, 7) || isMove(m, 8, 7)),
      `${d}: defends against the opponent's open three end`,
    );
  }
}

// ---------------------------------------------------------------------------
// 6. rule 5 — tactical tiers kill a double-three fork at the crossing point
// ---------------------------------------------------------------------------
{
  // black stones: horizontal pair (5..6,7) + vertical pair (7,5..6).
  // Playing (7,7) creates TWO open threes at once — a winning fork.
  const board = setup([
    [5, 7, BLACK],
    [6, 7, BLACK],
    [7, 5, BLACK],
    [7, 6, BLACK],
    [0, 14, WHITE],
  ]);
  for (const d of TACTICAL_TIERS) {
    const m = getAIMove(board, WHITE, d);
    assert(isMove(m, 7, 7), `${d}: occupies the double-three fork point`);
  }
}

// ---------------------------------------------------------------------------
// 7. master integration — wins a forced position via the strongest line
// ---------------------------------------------------------------------------
{
  // white: open three on row 8 + broken three row 7; playing (8,8) makes an
  // unstoppable open four; black cannot counter in time.
  const board = setup([
    [5, 7, WHITE],
    [6, 7, WHITE],
    [7, 7, WHITE],
    [5, 9, BLACK],
    [6, 9, BLACK],
    [7, 9, BLACK],
    [2, 2, BLACK],
  ]);
  const t0 = now();
  const m = getAIMove(board, WHITE, "master");
  const dt = now() - t0;
  assert(
    !!m && m.x >= 4 && m.x <= 8 && m.y === 7,
    `master finds a winning move on row 7 (${m?.x},${m?.y})`,
  );
  assert(dt < 1000, `master stays inside the time budget on tactical boards (${dt.toFixed(1)}ms)`);

  // determinism: same position -> same suggestion twice
  const m2 = getAIMove(board, WHITE, "master");
  assert(
    !!m && !!m2 && m.x === m2.x && m.y === m2.y,
    "master is deterministic on the same position",
  );
}

// ---------------------------------------------------------------------------
// 8. hint engine
// ---------------------------------------------------------------------------
{
  const board = setup([
    [5, 7, BLACK],
    [6, 7, BLACK],
    [7, 7, BLACK],
    [8, 7, BLACK],
    [0, 0, WHITE],
  ]);
  const h = getHintMove(board, BLACK);
  assert(
    !!h && (isMove(h, 4, 7) || isMove(h, 9, 7)),
    "hint plays the winning move when one exists",
  );

  const empty = createBoard();
  const h2 = getHintMove(empty, BLACK);
  assert(isMove(h2, 7, 7), "hint opens at the centre on an empty board");

  const h3 = getHintMove(board, BLACK);
  assert(isMove(h, h!.x, h!.y) && isMove(h3, h!.x, h!.y), "hint is deterministic");
}

// ---------------------------------------------------------------------------
// 9. undoOne (single-ply revert used by local two-player mode)
// ---------------------------------------------------------------------------
{
  let g = engine.createGame();
  g = engine.placeStone(g, { x: 7, y: 7 }, BLACK);
  g = engine.placeStone(g, { x: 8, y: 8 }, WHITE);
  g = engine.placeStone(g, { x: 7, y: 6 }, BLACK);

  const g1 = engine.undoOne(g);
  assert(g1.moveCount === 2, "undoOne reverts exactly one ply");
  assert(g1.currentPlayer === BLACK, "undoOne hands the turn back to the mover");
  assert(g1.board[idx(7, 6)] === 0, "undoOne removed the last stone");
  assert(g1.history.length === 2, "undoOne keeps earlier history");

  const g2 = engine.undoOne(g1);
  assert(g2.moveCount === 1 && g2.board[idx(8, 8)] === 0, "undoOne chains back through history");

  const g0 = engine.undoOne(engine.createGame());
  assert(g0 === engine.createGame() || g0.moveCount === 0, "undoOne on a fresh game is a no-op");

  const over = { ...g, status: "black_win" as const };
  assert(engine.undoOne(over) === over, "undoOne on a finished game is a no-op");
}

// ---------------------------------------------------------------------------
// 10. coordinate naming (Renju convention: A–O left→right, 1–15 bottom-up)
// ---------------------------------------------------------------------------
{
  assert(coordName(7, 7) === "H8", "centre intersection reads H8");
  assert(coordName(0, 0) === "A15", "top-left corner reads A15");
  assert(coordName(14, 14) === "O1", "bottom-right corner reads O1");
  assert(coordName(0, 7) === "A8", "left edge middle reads A8");
  assert(colName(14) === "O" && colName(0) === "A", "column letters span A..O");
  assert(rowName(0) === "15" && rowName(14) === "1", "row numbers grow upward");
  // round-trip over every intersection: names are unique and well-formed
  const seen = new Set<string>();
  let ok = true;
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const n = coordName(x, y);
      if (!/^[A-O](1[0-5]|[1-9])$/.test(n)) ok = false;
      seen.add(n);
    }
  }
  assert(ok && seen.size === 225, "all 225 intersections have unique valid names");
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------
