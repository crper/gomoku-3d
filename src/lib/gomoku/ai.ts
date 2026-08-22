import {
  Board,
  Move,
  Player,
  opponent,
  idx,
  inBounds,
  getCandidateMoves,
  checkWinFrom,
} from "./types";

export type Difficulty = "easy" | "medium" | "hard" | "master";

const FIVE = 10_000_000;
const OPEN_FOUR = 1_000_000;
const FOUR = 100_000;
const OPEN_THREE = 10_000;
const THREE = 1_000;
const OPEN_TWO = 100;
const TWO = 10;

/**
 * Ordered by descending score. Score = first pattern (highest) found inside
 * the 9-cell line window. Line chars: '1' = our stone, '2' = opponent/edge
 * (blocks), '0' = empty.
 */
const PATTERNS: ReadonlyArray<{ p: string; s: number }> = [
  { p: "11111", s: FIVE },
  { p: "011110", s: OPEN_FOUR },
  { p: "11011", s: FOUR },
  { p: "10111", s: FOUR },
  { p: "11101", s: FOUR },
  { p: "011112", s: FOUR },
  { p: "211110", s: FOUR },
  { p: "11110", s: FOUR },
  { p: "01111", s: FOUR },
  { p: "010110", s: OPEN_THREE },
  { p: "011010", s: OPEN_THREE },
  { p: "011100", s: OPEN_THREE },
  { p: "001110", s: OPEN_THREE },
  { p: "11100", s: THREE },
  { p: "00111", s: THREE },
  { p: "11010", s: THREE },
  { p: "01011", s: THREE },
  { p: "10110", s: THREE },
  { p: "01101", s: THREE },
  { p: "11001", s: THREE },
  { p: "10011", s: THREE },
  { p: "10101", s: THREE },
  { p: "011000", s: OPEN_TWO },
  { p: "000110", s: OPEN_TWO },
  { p: "001100", s: OPEN_TWO },
  { p: "010100", s: OPEN_TWO },
  { p: "001010", s: OPEN_TWO },
  { p: "11000", s: TWO },
  { p: "00011", s: TWO },
  { p: "10100", s: TWO },
  { p: "00101", s: TWO },
  { p: "10010", s: TWO },
  { p: "01010", s: TWO },
];

function bestPatternInLine(line: string): number {
  for (const { p, s } of PATTERNS) {
    if (line.includes(p)) return s;
  }
  return 0;
}

const DIRS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** Score of the shape formed by placing `player` at (x, y). */
export function evaluatePoint(board: Board, x: number, y: number, player: Player): number {
  let total = 0;
  for (const [dx, dy] of DIRS) {
    total += bestPatternInLine(directionLine(board, x, y, dx, dy, player));
  }
  return total;
}

/**
 * 9-char line window through (x, y) along (dx, dy), centred on a hypothetical
 * `player` stone ('1'); '0' empty, '2' opponent/edge. No board mutation.
 */
function directionLine(
  board: Board,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Player,
): string {
  let line = "";
  for (let i = -4; i <= 4; i++) {
    if (i === 0) {
      line += "1";
      continue;
    }
    const nx = x + dx * i;
    const ny = y + dy * i;
    if (!inBounds(nx, ny)) {
      line += "2";
    } else {
      const s = board[idx(nx, ny)];
      if (s === player) line += "1";
      else if (s === 0) line += "0";
      else line += "2";
    }
  }
  return line;
}

function wouldWin(board: Board, m: Move, player: Player): boolean {
  board[idx(m.x, m.y)] = player;
  const win = checkWinFrom(board, m.x, m.y, player);
  board[idx(m.x, m.y)] = 0;
  return win;
}

function moveScore(board: Board, m: Move, player: Player, defWeight: number): number {
  const offense = evaluatePoint(board, m.x, m.y, player);
  const defense = evaluatePoint(board, m.x, m.y, opponent(player));
  return offense + defWeight * defense;
}

/* ----------------------------------------------------------------------------
 * Tactical analysis (rules layer shared by every tier ≥ medium).
 * ------------------------------------------------------------------------- */

/** Per-direction threat classes created by a hypothetical placement. */
interface DirThreat {
  /** directions that complete five immediately */
  five: number;
  /** directions that form an open four (.1111.) */
  openFour: number;
  /** directions that form a blocked-but-live four */
  four: number;
  /** directions that form an open three */
  openThree: number;
}

/** Classify the threats `player` creates by playing at (x, y). Pure. */
function classifyPlacement(board: Board, x: number, y: number, player: Player): DirThreat {
  const t: DirThreat = { five: 0, openFour: 0, four: 0, openThree: 0 };
  for (const [dx, dy] of DIRS) {
    const s = bestPatternInLine(directionLine(board, x, y, dx, dy, player));
    if (s >= FIVE) t.five++;
    else if (s >= OPEN_FOUR) t.openFour++;
    else if (s >= FOUR) t.four++;
    else if (s >= OPEN_THREE) t.openThree++;
  }
  return t;
}

/** Weighted threat units: an open four counts double (two winning ends). */
function threatUnits(t: DirThreat): number {
  return t.five + 2 * t.openFour + t.four + t.openThree;
}

/**
 * All cells where `player` completes five with their next stone. Synchronous
 * mutate-restore probe on `board` (same discipline as `wouldWin`).
 */
export function immediateWinCells(board: Board, player: Player): Move[] {
  const res: Move[] = [];
  for (const m of getCandidateMoves(board)) {
    if (wouldWin(board, m, player)) res.push(m);
  }
  return res;
}

/**
 * A move that leaves ≥2 distinct immediate winning cells (open four or double
 * four). The opponent's single reply cannot cover both — a guaranteed win on
 * our next turn, provided the opponent has no winning cell right now (which
 * the caller's earlier rules ensure).
 */
function guaranteedWinMove(board: Board, candidates: Move[], player: Player): Move | null {
  for (const m of candidates) {
    board[idx(m.x, m.y)] = player;
    const wins = immediateWinCells(board, player).length;
    board[idx(m.x, m.y)] = 0;
    if (wins >= 2) return m;
  }
  return null;
}

/**
 * Fork points: cells where `player` would create ≥2 simultaneous threats
 * (double open three, four + open three, …). The defender can only answer one
 * per turn, so these usually must be occupied as they appear.
 */
function forkPoints(board: Board, candidates: Move[], player: Player): Move[] {
  const res: Move[] = [];
  for (const m of candidates) {
    const t = classifyPlacement(board, m.x, m.y, player);
    // immediate wins are handled earlier; skip them here
    if (t.five > 0) continue;
    if (threatUnits(t) >= 2) res.push(m);
  }
  return res;
}

function greedy(board: Board, candidates: Move[], player: Player, defWeight: number): Move {
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const m of candidates) {
    const s = moveScore(board, m, player, defWeight);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

function search2Ply(
  board: Board,
  candidates: Move[],
  player: Player,
  defWeight: number,
  K: number,
): Move {
  const opp = opponent(player);
  const scored = candidates
    .map((m) => ({ m, s: moveScore(board, m, player, defWeight) }))
    .sort((a, b) => b.s - a.s);
  const top = scored.slice(0, K).map((e) => e.m);

  let best = top[0];
  let bestScore = -Infinity;
  for (const m of top) {
    board[idx(m.x, m.y)] = player;
    // opponent's best reply
    let oppBest = -Infinity;
    const oppMoves = getCandidateMoves(board);
    for (const om of oppMoves) {
      const s = moveScore(board, om, opp, defWeight);
      if (s > oppBest) oppBest = s;
    }
    const score = moveScore(board, m, player, defWeight) - 0.8 * oppBest;
    board[idx(m.x, m.y)] = 0;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

interface DifficultyConfig {
  defWeight: number;
  searchDepth: number;
  candidateK: number;
  randomness: number;
  /** medium+: apply the tactical rules layer (win / fork / block forks). */
  tactics: boolean;
}

/** Difficulty-driven tuning table. Rules 1–2 (take win / block win) always
 *  apply, even on easy — only the tactical layer below is tier-gated. */
const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { defWeight: 0.5, searchDepth: 0, candidateK: 4, randomness: 0.7, tactics: false },
  medium: { defWeight: 1.0, searchDepth: 1, candidateK: 8, randomness: 0.1, tactics: true },
  hard: { defWeight: 1.0, searchDepth: 2, candidateK: 14, randomness: 0.02, tactics: true },
  master: { defWeight: 1.05, searchDepth: 4, candidateK: 20, randomness: 0, tactics: true },
};

/* ----------------------------------------------------------------------------
 * Master search: alpha-beta negamax with beam pruning + forced-move extension
 * (VCF-style). Positions where either side threatens an immediate win are
 * "forced": only the winning/blocking cells are legal-ish, and searching them
 * does not consume depth. This lets the search resolve entire four-chains far
 * beyond its nominal horizon while a node/time budget keeps it bounded.
 * ------------------------------------------------------------------------- */

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

const WIN = 1_000_000_000;

// Leaf-evaluation weights, on the `moveScore` scale. Steep gaps make building a
// four / open-four dominate small shape noise, so the search prefers forcing
// lines.
const T_WIN = 10_000_000; // immediate winning threat
const T_OPEN_FOUR = 1_000_000;
const T_FOUR = 100_000;
const T_OPEN_THREE = 10_000;
const T_THREE = 1_000;
const T_TWO = 100;

/** Search budget shared across one master move computation. */
interface Budget {
  nodes: number;
  maxNodes: number;
  deadline: number;
}

function budgetExceeded(b: Budget): boolean {
  return b.nodes >= b.maxNodes || now() > b.deadline;
}

/**
 * Threat potential of `player` on the current board: weighted shape value summed
 * over every candidate point (what `player` could build there).
 */
function evalSide(board: Board, player: Player): number {
  let win = 0;
  let openFour = 0;
  let four = 0;
  let openThree = 0;
  let three = 0;
  let two = 0;
  for (const m of getCandidateMoves(board)) {
    const e = evaluatePoint(board, m.x, m.y, player);
    if (e >= FIVE) win++;
    else if (e >= OPEN_FOUR) openFour++;
    else if (e >= FOUR) four++;
    else if (e >= OPEN_THREE) openThree++;
    else if (e >= THREE) three++;
    else if (e >= OPEN_TWO) two++;
  }
  return (
    win * T_WIN +
    openFour * T_OPEN_FOUR +
    four * T_FOUR +
    openThree * T_OPEN_THREE +
    three * T_THREE +
    two * T_TWO
  );
}

/** Leaf heuristic from the perspective of the side to move. */
function evaluateBoard(board: Board, player: Player, defWeight: number): number {
  return evalSide(board, player) - defWeight * evalSide(board, opponent(player));
}

/**
 * Build the move pool for one node. Forced positions (someone threatens an
 * immediate win) restrict play to {our winning cells ∪ their winning cells}
 * and extend the search (depth unchanged); quiet positions use the top-K
 * beam and consume one ply.
 */
function nodePool(
  board: Board,
  player: Player,
  defWeight: number,
  K: number,
  depth: number,
): { pool: Move[]; nextDepth: number } {
  const opp = opponent(player);
  const oppWins = immediateWinCells(board, opp);
  if (oppWins.length > 0 || depth <= 0) {
    // never evaluate a leaf while a win-in-1 exists for either side
    const myWins = immediateWinCells(board, player);
    if (oppWins.length > 0 || myWins.length > 0) {
      const seen = new Set<number>();
      const pool: Move[] = [];
      for (const m of [...myWins, ...oppWins]) {
        const k = idx(m.x, m.y);
        if (seen.has(k)) continue;
        seen.add(k);
        pool.push(m);
      }
      // forced replies do not consume depth (threat extension)
      return { pool, nextDepth: Math.max(0, depth) };
    }
    if (depth <= 0) return { pool: [], nextDepth: 0 }; // quiet leaf
  }
  const cands = getCandidateMoves(board);
  const ranked = cands
    .map((m) => ({ m, s: moveScore(board, m, player, defWeight) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, K);
  return { pool: ranked.map((e) => e.m), nextDepth: depth - 1 };
}

/**
 * Alpha-beta negamax with beam pruning and forced-move extension. Returns the
 * value of the position from the perspective of `player` (the side to move at
 * this node). A win is returned as `WIN`; a full board is a draw (0).
 */
function negamax(
  board: Board,
  player: Player,
  defWeight: number,
  depth: number,
  K: number,
  alpha: number,
  beta: number,
  budget: Budget,
): number {
  budget.nodes++;
  const { pool, nextDepth } = nodePool(board, player, defWeight, K, depth);
  if (pool.length === 0) {
    if (depth <= 0) return evaluateBoard(board, player, defWeight);
    return 0; // full board -> draw
  }
  let best = -Infinity;
  for (const m of pool) {
    board[idx(m.x, m.y)] = player;
    let val: number;
    if (checkWinFrom(board, m.x, m.y, player)) {
      val = WIN;
    } else if (budgetExceeded(budget)) {
      // budget blown mid-line: fall back to a static read of the child
      val = -evaluateBoard(board, opponent(player), defWeight);
    } else {
      val = -negamax(board, opponent(player), defWeight, nextDepth, K, -beta, -alpha, budget);
    }
    board[idx(m.x, m.y)] = 0;
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // prune
  }
  return best;
}

/**
 * Master search: top-K root candidates (by pattern score), bounded by an
 * ~800ms / node budget, evaluated with an alpha-beta minimax whose forced-move
 * extension resolves four-chains far beyond the nominal 5-ply horizon.
 *
 * Always returns a legal move; never null (callers guarantee non-empty input).
 */
function searchMaster(
  board: Board,
  candidates: Move[],
  player: Player,
  defWeight: number,
  K: number,
): Move {
  const opp = opponent(player);
  const budget: Budget = {
    nodes: 0,
    maxNodes: 120_000,
    deadline: now() + 800,
  };
  const DEPTH = 4; // plies after the root move; extensions go deeper
  const DEEP_K = 3; // beam width inside the tree
  const ROOT_K = Math.min(K, 8);

  const scored = candidates
    .map((m) => ({ m, s: moveScore(board, m, player, defWeight) }))
    .sort((a, b) => b.s - a.s);
  const top = scored.slice(0, ROOT_K);

  let best = top[0].m;
  let bestScore = -Infinity;
  for (const { m } of top) {
    if (budgetExceeded(budget)) break;
    board[idx(m.x, m.y)] = player;
    let val: number;
    if (checkWinFrom(board, m.x, m.y, player)) {
      val = WIN;
    } else {
      val = -negamax(board, opp, defWeight, DEPTH, DEEP_K, -Infinity, Infinity, budget);
    }
    board[idx(m.x, m.y)] = 0;
    if (val > bestScore) {
      bestScore = val;
      best = m;
    }
  }
  return best;
}

/**
 * Choose the AI's move for `player`. Guarantees, in order:
 *   1. take an immediate win;
 *   2. block the opponent's immediate win (best-scoring block when several);
 *   3. (medium+) create an open four / double four — an unstoppable win next turn;
 *   4. (medium+) make our own fork when the opponent cannot fork back;
 *   5. (medium+) occupy the opponent's strongest fork point.
 * Then the difficulty-specific search. Returns `null` only when no candidate
 * exists (a full board → caller should declare a draw).
 */
export function getAIMove(board: Board, player: Player, difficulty: Difficulty): Move | null {
  const candidates = getCandidateMoves(board);
  if (candidates.length === 0) return null;

  const opp = opponent(player);

  // 1. Take an immediate win.
  for (const m of candidates) {
    if (wouldWin(board, m, player)) return m;
  }
  // 2. Block the opponent's immediate win. When several exist the position is
  //    lost anyway — pick the block with the best own shape.
  const oppWins = immediateWinCells(board, opp);
  if (oppWins.length > 0) {
    let best = oppWins[0];
    let bestScore = -Infinity;
    for (const m of oppWins) {
      const s = moveScore(board, m, player, 1);
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    return best;
  }

  const cfg = DIFFICULTY_CONFIG[difficulty];

  if (difficulty === "easy") {
    const ranked = candidates
      .map((m) => ({ m, s: moveScore(board, m, player, cfg.defWeight) }))
      .sort((a, b) => b.s - a.s);
    const top = ranked.slice(0, cfg.candidateK);
    // Often a careless blunder among all cells; otherwise among the top few.
    if (Math.random() < cfg.randomness) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return top[Math.floor(Math.random() * top.length)].m;
  }

  // ---- tactical rules layer ----

  // 3. Create an open four / double four → win next turn, unstoppable.
  const myGuaranteed = guaranteedWinMove(board, candidates, player);
  if (myGuaranteed) return myGuaranteed;

  const myForks = forkPoints(board, candidates, player);
  const oppForks = forkPoints(board, candidates, opp);

  // master keeps the deep search in charge: instead of blindly occupying the
  // opponent's fork point, restrict the root pool to defensive blocks plus our
  // own forcing replies and let alpha-beta pick — it may find a winning
  // counter-chain a greedy block would miss.
  if (difficulty === "master") {
    let pool = candidates;
    if (oppForks.length > 0) {
      const keep = new Set<number>(oppForks.map((m) => idx(m.x, m.y)));
      for (const m of candidates) {
        const t = classifyPlacement(board, m.x, m.y, player);
        if (t.five > 0 || t.openFour > 0 || t.four > 0 || t.openThree > 0) {
          keep.add(idx(m.x, m.y));
        }
      }
      pool = candidates.filter((m) => keep.has(idx(m.x, m.y)));
      if (pool.length === 0) pool = oppForks;
    }
    return searchMaster(board, pool, player, cfg.defWeight, cfg.candidateK);
  }

  // 4. Make our own fork while the opponent cannot fork back (medium/hard).
  if (myForks.length > 0 && oppForks.length === 0) {
    return greedy(board, myForks, player, cfg.defWeight);
  }
  // 5. Occupy the opponent's strongest fork point (medium/hard).
  if (oppForks.length > 0) {
    return greedy(board, oppForks, player, cfg.defWeight);
  }

  if (difficulty === "medium") {
    return greedy(board, candidates, player, cfg.defWeight);
  }

  // hard: 2-ply look-ahead on top of the rules layer.
  return search2Ply(board, candidates, player, cfg.defWeight, cfg.candidateK);
}

/**
 * Hint engine: the strongest available suggestion for `player` on `board`.
 * Deterministic (master tier, zero randomness) so repeated calls on the same
 * position agree.
 */
export function getHintMove(board: Board, player: Player): Move | null {
  return getAIMove(board, player, "master");
}
