import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Player, Move, GameStatus, BLACK, opponent, validateMove } from "@/lib/gomoku/types";
import { getAIMove, getHintMove, type Difficulty } from "@/lib/gomoku/ai";
import * as engine from "@/lib/gomoku/engine";
import {
  GameStats,
  loadStats,
  saveStats,
  recordResult,
  TONE_CLASSES,
  type AchievementDef,
} from "@/lib/gomoku/stats";
import { play, unlockAudio, setMuted, isMuted } from "@/lib/audio/sfx";
import { ACH_ICON } from "@/lib/achievementIcons";
import { Sparkles, type LucideIcon } from "lucide-react";
import { type ToastItem } from "@/components/ui/toast";

/** "ai" = human vs computer; "pvp" = two humans sharing one screen. */
export type GameMode = "ai" | "pvp";

const MODE_KEY = "gomoku.mode.v1";
const HINTS_PER_GAME = 3;

function loadMode(): GameMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "pvp") return "pvp";
  } catch {
    /* ignore (privacy mode / SSR) */
  }
  return "ai";
}

function saveMode(m: GameMode): void {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignore */
  }
}

export interface UseGomoku {
  game: engine.GameState;
  board: engine.GameState["board"];
  currentPlayer: Player;
  status: GameStatus;
  lastMove: Move | null;
  winLine: Move[] | null;
  winner: Player | null;
  moveCount: number;
  mode: GameMode;
  difficulty: Difficulty;
  humanColor: Player;
  aiColor: Player;
  thinking: boolean;
  hover: Move | null;
  stats: GameStats;
  muted: boolean;
  elapsedMs: number;
  mmss: string;
  toasts: ToastItem[];
  interactive: boolean;
  canUndo: boolean;
  hintsLeft: number;
  hintMove: Move | null;
  hintLoading: boolean;
  setMode: (m: GameMode) => void;
  setDifficulty: (d: Difficulty) => void;
  setHumanColor: (p: Player) => void;
  setHover: (m: Move | null) => void;
  handlePlace: (m: Move) => void;
  restart: () => void;
  undo: () => void;
  toggleMute: () => void;
  requestHint: () => void;
  pushToast: (t: Omit<ToastItem, "id">) => void;
  dismissToast: (id: number) => void;
}

export function useGomoku(): UseGomoku {
  const { t } = useTranslation();
  const [game, setGame] = useState<engine.GameState>(() => engine.createGame());
  const [mode, setModeState] = useState<GameMode>(() => loadMode());
  const [difficulty, setDifficultyState] = useState<Difficulty>("medium");
  const [humanColor, setHumanColorState] = useState<Player>(BLACK);
  const [thinking, setThinking] = useState(false);
  const [hover, setHoverState] = useState<Move | null>(null);
  const [stats, setStats] = useState<GameStats>(() => loadStats());
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [hintsLeft, setHintsLeft] = useState(HINTS_PER_GAME);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  const isPvP = mode === "pvp";
  const aiColor = opponent(humanColor);

  // ---- ref mirrors to avoid stale closures ----
  const gameRef = useRef(game);
  gameRef.current = game;
  const statusRef = useRef(game.status);
  statusRef.current = game.status;
  const aiColorRef = useRef(aiColor);
  aiColorRef.current = aiColor;
  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;
  const humanColorRef = useRef(humanColor);
  humanColorRef.current = humanColor;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const thinkingRef = useRef(thinking);
  thinkingRef.current = thinking;
  const interactiveRef = useRef(false);
  const hintsLeftRef = useRef(hintsLeft);
  hintsLeftRef.current = hintsLeft;
  const hintLoadingRef = useRef(hintLoading);
  hintLoadingRef.current = hintLoading;
  const aiPendingRef = useRef(false);
  const recordedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  /** Wall-clock timestamp of the first move — drift-free elapsed time. */
  const startedAtRef = useRef<number | null>(null);
  const toastId = useRef(0);
  const prevHoverRef = useRef<Move | null>(null);
  const lastHoverPlayRef = useRef(0);
  const thinkingWasTrueRef = useRef(false);

  // ---- toast helpers ----
  const pushToast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const pushAchievementToast = useCallback(
    (a: AchievementDef) => {
      const Icon: LucideIcon = ACH_ICON[a.icon] ?? Sparkles;
      const tone = TONE_CLASSES[a.tone];
      pushToast({
        title: `${t("toast.achievementUnlocked")} · ${t(`achievements.${a.id}.title`)}`,
        desc: t(`achievements.${a.id}.desc`),
        icon: createElement(Icon, { className: "h-5 w-5" }),
        toneClass: `${tone.bg} ${tone.text}`,
      });
    },
    [pushToast, t],
  );

  // ---- apply a move (shared by human / AI) + clear any stale hint marker ----
  const applyMove = useCallback((m: Move, player: Player) => {
    setHintMove(null);
    setGame((prev) => engine.placeStone(prev, m, player));
  }, []);

  const handlePlace = useCallback(
    (m: Move) => {
      if (statusRef.current !== "playing") return;
      if (modeRef.current === "ai" && gameRef.current.currentPlayer !== humanColorRef.current)
        return;
      if (thinkingRef.current) return;
      if (!validateMove(gameRef.current.board, m)) return;
      try {
        unlockAudio();
        play("place_player");
      } catch {
        /* ignore */
      }
      applyMove(m, gameRef.current.currentPlayer);
    },
    [applyMove],
  );

  // ---- AI turn: schedule exactly once per turn (no self-cancel bug) ----
  // NOTE: `thinking` is intentionally NOT in the dependency array — including it
  // would cancel the in-flight timeout and deadlock the AI.
  useEffect(() => {
    const isAITurn =
      modeRef.current === "ai" && game.status === "playing" && game.currentPlayer === aiColor;
    if (!isAITurn) {
      aiPendingRef.current = false;
      // BUG-QA-01 fix: switching 先手 mid-thinking cancels the AI timer (cleanup)
      // and re-enters this branch; without resetting thinking the UI soft-locks.
      setThinking(false);
      return;
    }
    if (aiPendingRef.current) return;
    aiPendingRef.current = true;
    setThinking(true);
    const delay = 320 + (difficulty === "master" ? 400 : 0);
    const t = window.setTimeout(() => {
      const m = getAIMove(gameRef.current.board, aiColor, difficultyRef.current);
      aiPendingRef.current = false;
      setThinking(false);
      if (m) {
        try {
          play("place_ai");
        } catch {
          /* ignore */
        }
        applyMove(m, aiColor);
      } else {
        setGame((prev) => ({ ...prev, status: "draw", winner: null }));
      }
    }, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status, game.currentPlayer, aiColor, applyMove]);

  // ---- record finished game into stats + fire result / achievement sounds ----
  // PvP games are for fun: no stats, no achievements — just the result cue.
  useEffect(() => {
    if (game.status === "playing") {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current) return;
    recordedRef.current = true;

    if (modeRef.current === "pvp") {
      window.setTimeout(() => {
        try {
          if (game.status === "draw") play("draw");
          else play("victory");
        } catch {
          /* ignore */
        }
      }, 150);
      return;
    }

    const outcome: "win" | "loss" | "draw" =
      game.status === "draw" ? "draw" : game.winner === humanColorRef.current ? "win" : "loss";
    const res = recordResult(statsRef.current, {
      outcome,
      moves: game.moveCount,
      difficulty: difficultyRef.current,
    });
    setStats(res.stats);
    saveStats(res.stats);

    window.setTimeout(() => {
      try {
        if (outcome === "win") play("victory");
        else if (outcome === "loss") play("defeat");
        else play("draw");
      } catch {
        /* ignore */
      }
    }, 150);

    res.unlocked.forEach((a, i) =>
      window.setTimeout(
        () => {
          try {
            play("achievement");
          } catch {
            /* ignore */
          }
          pushAchievementToast(a);
        },
        250 + i * 350,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status, pushAchievementToast]);

  // ---- per-game timer (wall-clock based; a 1s interval alone drifts badly) ----
  useEffect(() => {
    const running = game.status === "playing" && game.moveCount > 0;
    if (!running) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    if (timerRef.current !== null) return; // already running
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - (startedAtRef.current ?? Date.now()));
    }, 500);
  }, [game.status, game.moveCount]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    },
    [],
  );

  // ---- thinking sound ----
  useEffect(() => {
    try {
      if (thinking) {
        play("thinking_start");
        thinkingWasTrueRef.current = true;
      } else if (thinkingWasTrueRef.current) {
        play("thinking_end");
        thinkingWasTrueRef.current = false;
      }
    } catch {
      /* ignore */
    }
  }, [thinking]);

  // ---- hover sound (throttled) ----
  useEffect(() => {
    const prev = prevHoverRef.current;
    prevHoverRef.current = hover;
    if (!hover) return;
    if (prev && prev.x === hover.x && prev.y === hover.y) return;
    const t = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (t - lastHoverPlayRef.current < 40) return;
    lastHoverPlayRef.current = t;
    try {
      play("hover");
    } catch {
      /* ignore */
    }
  }, [hover]);

  // ---- actions ----
  const setMode = useCallback((m: GameMode) => {
    try {
      unlockAudio();
      play("ui_click");
    } catch {
      /* ignore */
    }
    saveMode(m);
    setModeState(m);
    // semantics change mid-game would corrupt both modes — start fresh
    setGame(engine.createGame());
    setThinking(false);
    aiPendingRef.current = false;
    setHoverState(null);
    setHintMove(null);
    setHintsLeft(HINTS_PER_GAME);
    recordedRef.current = false;
    setElapsedMs(0);
    startedAtRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setDifficulty = useCallback((d: Difficulty) => {
    try {
      unlockAudio();
    } catch {
      /* ignore */
    }
    setDifficultyState(d);
  }, []);

  const setHumanColor = useCallback((p: Player) => {
    try {
      unlockAudio();
      play("ui_click");
    } catch {
      /* ignore */
    }
    setHumanColorState(p);
  }, []);

  const setHover = useCallback((m: Move | null) => setHoverState(m), []);

  const restart = useCallback(() => {
    try {
      unlockAudio();
      play("ui_click");
    } catch {
      /* ignore */
    }
    setGame(engine.createGame());
    setThinking(false);
    aiPendingRef.current = false;
    setHoverState(null);
    setHintMove(null);
    setHintsLeft(HINTS_PER_GAME);
    recordedRef.current = false;
    setElapsedMs(0);
    startedAtRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const undo = useCallback(() => {
    if (thinkingRef.current) return;
    if (gameRef.current.status !== "playing") return;
    const need = modeRef.current === "pvp" ? 1 : 2;
    if (gameRef.current.history.length < need) return;
    try {
      unlockAudio();
      play("undo");
    } catch {
      /* ignore */
    }
    setHintMove(null);
    setGame((prev) => (modeRef.current === "pvp" ? engine.undoOne(prev) : engine.undo(prev)));
    recordedRef.current = false;
  }, []);

  const toggleMute = useCallback(() => {
    try {
      unlockAudio();
    } catch {
      /* ignore */
    }
    setMutedState((prev) => {
      const next = !prev;
      if (prev === false && next === true) {
        // muting: click is still audible, so play it before silencing.
        try {
          play("ui_click");
        } catch {
          /* ignore */
        }
        try {
          setMuted(next);
        } catch {
          /* ignore */
        }
      } else {
        // unmuting (muted→unmuted): re-enable sound first, then confirm tick.
        try {
          setMuted(next);
        } catch {
          /* ignore */
        }
        try {
          play("unmute_tick");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  // ---- hint: master-strength suggestion for the side currently to move ----
  const requestHint = useCallback(() => {
    if (statusRef.current !== "playing") return;
    if (!interactiveRef.current) return;
    if (hintsLeftRef.current <= 0 || hintLoadingRef.current) return;
    try {
      unlockAudio();
    } catch {
      /* ignore */
    }
    hintLoadingRef.current = true;
    setHintLoading(true);
    // defer off the click handler so the spinner paints before we compute
    window.setTimeout(() => {
      const m = getHintMove(gameRef.current.board, gameRef.current.currentPlayer);
      hintLoadingRef.current = false;
      setHintLoading(false);
      if (!m) return;
      setHintsLeft((h) => Math.max(0, h - 1));
      setHintMove(m);
      try {
        play("hint");
      } catch {
        /* ignore */
      }
    }, 60);
  }, []);

  // ---- keyboard: Ctrl/Cmd+Z to undo ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  // ---- derived ----
  const interactive =
    game.status === "playing" &&
    !thinking &&
    !hintLoading &&
    (isPvP || game.currentPlayer === humanColor);
  interactiveRef.current = interactive;

  const canUndo = game.status === "playing" && !thinking && game.history.length >= (isPvP ? 1 : 2);

  const mmss = useMemo(() => {
    const total = Math.floor(elapsedMs / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [elapsedMs]);

  return {
    game,
    board: game.board,
    currentPlayer: game.currentPlayer,
    status: game.status,
    lastMove: game.lastMove,
    winLine: game.winLine,
    winner: game.winner,
    moveCount: game.moveCount,
    mode,
    difficulty,
    humanColor,
    aiColor,
    thinking,
    hover,
    stats,
    muted,
    elapsedMs,
    mmss,
    toasts,
    interactive,
    canUndo,
    hintsLeft,
    hintMove,
    hintLoading,
    setMode,
    setDifficulty,
    setHumanColor,
    setHover,
    handlePlace,
    restart,
    undo,
    toggleMute,
    requestHint,
    pushToast,
    dismissToast,
  };
}
