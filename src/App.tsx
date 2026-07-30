import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RotateCcw,
  Circle,
  Bot,
  User,
  Trophy,
  Volume2,
  VolumeX,
  Undo2,
  Dices,
  Shield,
  Sword,
  Crown,
  Sparkles,
  Box,
  Grid3x3,
  Film,
  Download,
  type LucideIcon,
} from "lucide-react";

import GameBoard from "@/components/GameBoard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toast";
import { useGomoku } from "@/hooks/useGomoku";
import { useViewMode, type ViewMode } from "@/hooks/useViewMode";
import { useReplay } from "@/hooks/useReplay";
import ReplayPanel from "@/components/ReplayPanel";
import ExportDialog from "@/components/ExportDialog";
import { play } from "@/lib/audio/sfx";
import {
  ACHIEVEMENTS,
  isEarned,
  TONE_CLASSES,
} from "@/lib/gomoku/stats";
import { ACH_ICON } from "@/lib/achievementIcons";
import { type Difficulty } from "@/lib/gomoku/ai";
import { BLACK, WHITE } from "@/lib/gomoku/types";

/** Tween an integer from its previous value to the new one. */
function AnimatedNumber({ value }: { value: number }) {
  const [disp, setDisp] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const dur = 500;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(from + (value - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{disp}</span>;
}

/** One-shot celebratory burst, rendered when the title is clicked or the player wins. */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 90 + Math.random() * 180;
        const palette = [
          "#f97316",
          "#f59e0b",
          "#ef4444",
          "#8b5cf6",
          "#10b981",
          "#0ea5e9",
        ];
        return {
          left: 50 + (Math.random() * 22 - 11),
          cx: Math.cos(angle) * dist,
          cy: Math.sin(angle) * dist - 30,
          color: palette[Math.floor(Math.random() * palette.length)],
          delay: Math.random() * 0.18,
          w: 6 + Math.random() * 6,
          h: 4 + Math.random() * 5,
        };
      }),
    []
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              top: "50%",
              width: p.w,
              height: p.h,
              background: p.color,
              ["--cx"]: `${p.cx}px`,
              ["--cy"]: `${p.cy}px`,
              animation: `confetti-fall 1.1s ${p.delay}s ease-out forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

const DIFFICULTIES: {
  id: Difficulty;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { id: "easy", label: "简单", hint: "偶有失误", icon: Dices },
  { id: "medium", label: "中等", hint: "稳健应对", icon: Shield },
  { id: "hard", label: "困难", hint: "攻防兼备", icon: Sword },
  { id: "master", label: "大师", hint: "深算无懈", icon: Crown },
];

function diffSelectedClass(id: Difficulty): string {
  switch (id) {
    case "easy":
      return "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-[var(--shadow-glow)]";
    case "medium":
      return "border-sky-400 bg-sky-50 text-sky-700 shadow-[var(--shadow-glow)]";
    case "hard":
      return "border-orange-400 bg-orange-50 text-orange-700 shadow-[var(--shadow-glow)]";
    case "master":
      return "border-rose-400 bg-rose-50 text-rose-700 shadow-[var(--shadow-glow)] ring-2 ring-rose-200";
  }
}

export default function App() {
  const {
    game,
    board,
    currentPlayer,
    status,
    lastMove,
    winLine,
    winner,
    moveCount,
    difficulty,
    humanColor,
    thinking,
    stats,
    muted,
    mmss,
    toasts,
    interactive,
    canUndo,
    setDifficulty,
    setHumanColor,
    setHover,
    handlePlace,
    restart,
    undo,
    toggleMute,
    pushToast,
    dismissToast,
  } = useGomoku();

  const [par, setPar] = useState({ x: 0, y: 0 });
  const [egg, setEgg] = useState(false);
  const [boardMounted, setBoardMounted] = useState(false);
  const [viewMode, setViewMode] = useViewMode();
  const [exportOpen, setExportOpen] = useState(false);

  // ---- replay (read-only view over a frozen snapshot; live game untouched) ----
  const replay = useReplay(game, thinking);
  const isReplay = replay.mode !== "idle";
  const displayBoard = isReplay ? replay.display.board : board;
  const displayLast = isReplay ? replay.display.lastMove : lastMove;
  const displayWin = isReplay ? replay.display.winLine : winLine;
  const displayInteractive = isReplay ? false : interactive;

  const switchView = (m: ViewMode) => {
    if (m === viewMode) return;
    setViewMode(m);
    play("ui_click");
  };

  // ---- board mount animation ----
  useEffect(() => {
    const r = requestAnimationFrame(() => setBoardMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // ---- parallax (no-op on touch / reduced motion) ----
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      setPar({ x, y });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // ---- replay keyboard shortcuts (capture phase so we can also shield the
  //      global Ctrl/Cmd+Z undo while the read-only replay is open) ----
  const {
    stepBack: rStepBack,
    stepForward: rStepForward,
    togglePlay: rTogglePlay,
    exitReplay: rExit,
    goTo: rGoTo,
    N: rN,
  } = replay;
  useEffect(() => {
    if (!isReplay) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      )
        return; // never hijack typing (e.g. the export filename input)
      if (exportOpen) return; // dialog owns the keyboard while open
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        // replay is read-only: block the global undo shortcut
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          rStepBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          rStepForward();
          break;
        case " ":
          e.preventDefault(); // keep the page from scrolling
          rTogglePlay();
          break;
        case "Escape":
          e.preventDefault();
          rExit();
          break;
        case "Home":
          e.preventDefault();
          rGoTo(0);
          break;
        case "End":
          e.preventDefault();
          rGoTo(rN);
          break;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isReplay, exportOpen, rStepBack, rStepForward, rTogglePlay, rExit, rGoTo, rN]);

  const celebrate =
    (status === "black_win" || status === "white_win") && winner === humanColor;

  const triggerEgg = () => {
    setEgg(true);
    window.setTimeout(() => setEgg(false), 1300);
    pushToast({
      title: "彩蛋 ✦",
      desc: "愿你落子如风，五子连珠！",
      icon: <Sparkles className="h-5 w-5" />,
      toneClass: "bg-amber-100 text-amber-600",
    });
  };

  const statusText = useMemo(() => {
    if (status === "draw") return { label: "平局", tone: "secondary" as const };
    if (status === "black_win" || status === "white_win")
      return {
        label: (winner === humanColor ? "你" : "AI") + " 获胜",
        tone: "default" as const,
      };
    if (thinking) return { label: "AI 思考中…", tone: "secondary" as const };
    return {
      label: currentPlayer === humanColor ? "轮到你落子" : "AI 回合",
      tone: "secondary" as const,
    };
  }, [status, winner, thinking, currentPlayer, humanColor]);

  const bannerText = useMemo(() => {
    if (status === "draw") return "平局";
    if (status === "black_win" || status === "white_win")
      return winner === humanColor ? "你赢了 · 五子连珠！" : "惜败 · 再来一局";
    return null;
  }, [status, winner, humanColor]);

  const current = DIFFICULTIES.find((d) => d.id === difficulty)!;
  const CurrentIcon = current.icon;
  const streakPct = Math.min(stats.streak, 5) / 5;

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* ---- aurora background with mouse parallax ---- */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-amber-50 via-orange-50/40 to-rose-50/30">
        <div
          className="absolute -left-24 -top-24 h-[42rem] w-[42rem] rounded-full bg-orange-300/30 blur-3xl animate-aurora transition-transform duration-700 ease-out"
          style={{ transform: `translate3d(${par.x * 38}px, ${par.y * 38}px, 0)` }}
        />
        <div
          className="absolute -right-32 top-1/3 h-[34rem] w-[34rem] rounded-full bg-amber-200/40 blur-3xl animate-aurora transition-transform duration-700 ease-out"
          style={{
            animationDelay: "-6s",
            transform: `translate3d(${par.x * -30}px, ${par.y * -30}px, 0)`,
          }}
        />
        <div
          className="absolute bottom-[-10rem] left-1/3 h-[36rem] w-[36rem] rounded-full bg-rose-200/30 blur-3xl animate-aurora transition-transform duration-700 ease-out"
          style={{
            animationDelay: "-12s",
            transform: `translate3d(${par.x * 24}px, ${par.y * 24}px, 0)`,
          }}
        />
      </div>

      {/* bottom padding = mobile action bar height (~61px: py-2.5×2 + 40px
          buttons + border) + breathing room, plus the iOS safe-area inset */}
      <div className="relative mx-auto max-w-6xl px-4 py-6 pb-[calc(4.5rem_+_env(safe-area-inset-bottom))] sm:py-8 lg:pb-0">
        {/* ---- header ---- */}
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-xl font-black text-white shadow-[var(--shadow-glow)]">
              五
            </div>
            <div>
              <h1
                onClick={triggerEgg}
                className="cursor-pointer text-2xl font-bold tracking-tight text-stone-800 transition-transform hover:scale-[1.02] active:scale-95"
              >
                五子棋 <span className="text-gradient">Gomoku</span>
              </h1>
              <p className="mt-0.5 text-sm text-stone-500">
                人机对战 · 悬浮预览 · 落子引导线
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={statusText.tone}
              className="w-fit gap-1.5 px-3 py-1.5 text-sm shadow-[var(--shadow-soft)]"
            >
              {thinking ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
              ) : status === "playing" ? (
                <Circle
                  className={cn(
                    "h-3.5 w-3.5 fill-current",
                    currentPlayer === BLACK ? "text-stone-800" : "text-white"
                  )}
                />
              ) : null}
              {statusText.label}
            </Badge>

            <div className="flex items-center gap-2">
              {muted ? (
                <VolumeX className="h-4 w-4 text-stone-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-orange-500" />
              )}
              <Label htmlFor="mute-switch" className="text-sm text-stone-600">
                音效
              </Label>
              <Switch
                id="mute-switch"
                checked={!muted}
                onCheckedChange={() => toggleMute()}
                aria-label="音效开关"
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px] lg:gap-6">
          {/* ---- board ---- */}
          {/* 100svh - 220px keeps the square board fully on-screen on short /
              landscape viewports (header + paddings + status bar + bottom bar) */}
          <Card className="mx-auto w-full max-w-[min(92vw,560px,calc(100svh_-_220px))] overflow-hidden p-0 shadow-[var(--shadow-card)] lg:max-w-none">
            <div
              className={cn(
                "relative aspect-square w-full transition-all duration-700",
                boardMounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
              )}
            >
              <GameBoard
                board={displayBoard}
                currentPlayer={currentPlayer}
                interactive={displayInteractive}
                lastMove={displayLast}
                winLine={displayWin}
                onHover={setHover}
                onPlace={handlePlace}
                celebrate={isReplay ? false : celebrate}
                viewMode={viewMode}
                thinking={isReplay ? false : thinking}
                drawn={isReplay ? replay.display.drawn : status === "draw"}
              />

              {/* AI thinking overlay: shimmer sweep + scanning + dots */}
              {thinking && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end gap-3 overflow-hidden rounded-2xl pb-6">
                  <div className="absolute inset-0 bg-white/5" />
                  <div className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-4 py-2 text-sm font-medium text-stone-700 shadow-[var(--shadow-soft)] backdrop-blur-md">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                    AI 思考中
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <i
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-[bounce-dot_1s_infinite]"
                          style={{ animationDelay: `${i * 160}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}

              {/* replay-mode badge + current move info (aria-live) */}
              {isReplay && (
                <div
                  aria-live="polite"
                  className="pointer-events-none absolute left-3 top-3 z-10"
                >
                  <div className="flex items-center gap-2 rounded-full border border-white/60 bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-soft)] backdrop-blur-md">
                    <Film className="h-3.5 w-3.5" />
                    回放模式
                    <span className="tabular-nums">
                      {replay.currentStep} / {replay.N}
                    </span>
                  </div>
                </div>
              )}

              {/* game-over banner (hidden while replaying mid-game states) */}
              {!isReplay && status !== "playing" && bannerText && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-4">
                  <div className="animate-pop-in rounded-2xl border border-white/60 bg-black/75 px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-float)] backdrop-blur-md">
                    {bannerText}
                    {winLine && " · 已高亮胜利连线"}
                  </div>
                </div>
              )}
            </div>

            {/* ---- board status bar ---- */}
            <div className="flex items-center justify-between gap-3 border-t border-stone-200/70 px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2 text-stone-600">
                <Circle
                  className={cn(
                    "h-3.5 w-3.5 fill-current",
                    currentPlayer === BLACK ? "text-stone-800" : "text-white"
                  )}
                />
                <span className="font-medium">
                  {isReplay
                    ? "回放中 · 只读"
                    : interactive
                    ? "轮到你"
                    : thinking
                    ? "AI 思考中"
                    : status === "playing"
                    ? "AI 回合"
                    : ""}
                </span>
              </div>
              <div className="flex items-center gap-3 text-stone-500">
                <span>
                  手数 <b className="text-stone-800">{moveCount}</b>
                </span>
                <span>
                  用时{" "}
                  <b className="tabular-nums text-stone-800">{mmss}</b>
                </span>
                <span
                  title="将鼠标移到棋盘交叉点，会显示半透明落子预览与橙色引导线"
                  className="cursor-help text-stone-400"
                >
                  ?
                </span>
              </div>
            </div>
          </Card>

          {/* ---- side panel ---- */}
          <aside className="flex flex-col gap-4">
            {/* difficulty */}
            <Card
              interactive
              className={cn(
                "glass",
                isReplay && "opacity-50 pointer-events-none"
              )}
            >
              <CardHeader className="p-5 pb-2.5">
                <CardTitle className="text-base">难度</CardTitle>
                <CardDescription className="text-xs">
                  越高越强，AI 会尝试进攻与防守
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 p-5 pt-0">
                <div
                  className={cn(
                    "mb-1 inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                    diffSelectedClass(difficulty)
                  )}
                >
                  <CurrentIcon className="h-3.5 w-3.5" />
                  当前：{current.label}
                </div>
                {DIFFICULTIES.map((d) => {
                  const Icon = d.icon;
                  const isSel = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setDifficulty(d.id)}
                      className={cn(
                        "group flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]",
                        isSel
                          ? diffSelectedClass(d.id)
                          : "border-stone-200 bg-white/70 text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Icon className="h-4 w-4" />
                        {d.label}
                      </span>
                      <span className="text-xs text-stone-400 group-hover:text-stone-500">
                        {d.hint}
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* match controls ⇄ replay panel (desktop; mobile uses the
                fixed bottom sheet rendered near the action bar) */}
            {isReplay ? (
              <div className="hidden lg:block">
                <ReplayPanel
                  replay={replay}
                  humanColor={humanColor}
                  muted={muted}
                  onToggleMute={toggleMute}
                  viewMode={viewMode}
                  onSwitchView={switchView}
                  onExport={() => setExportOpen(true)}
                  exportDisabled={moveCount === 0}
                />
              </div>
            ) : (
            <Card interactive className="glass">
              <CardHeader className="p-5 pb-2.5">
                <CardTitle className="text-base">对局</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 p-5 pt-0">
                <div className="flex gap-2">
                  <Button
                    variant={humanColor === BLACK ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setHumanColor(BLACK)}
                  >
                    <User className="h-4 w-4" /> 玩家先手
                  </Button>
                  <Button
                    variant={humanColor === WHITE ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setHumanColor(WHITE)}
                  >
                    <Bot className="h-4 w-4" /> AI 先手
                  </Button>
                </div>
                <div
                  role="group"
                  aria-label="切换视图"
                  className="flex gap-2"
                >
                  <Button
                    variant={viewMode === "2d" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1.5"
                    aria-pressed={viewMode === "2d"}
                    title="2D 俯视 · 锁定旋转"
                    onClick={() => switchView("2d")}
                  >
                    <Grid3x3 className="h-4 w-4" /> 2D 平面
                  </Button>
                  <Button
                    variant={viewMode === "3d" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1.5"
                    aria-pressed={viewMode === "3d"}
                    title="3D 立体 · 自由视角"
                    onClick={() => switchView("3d")}
                  >
                    <Box className="h-4 w-4" /> 3D 立体
                  </Button>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={restart} className="gap-1.5">
                    <RotateCcw className="h-4 w-4" /> 重新开始
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={undo}
                    disabled={!canUndo}
                    className="gap-1.5"
                  >
                    <Undo2 className="h-4 w-4" /> 悔棋
                  </Button>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={replay.enterReplay}
                    disabled={!replay.canEnterReplay}
                    title={
                      thinking
                        ? "AI 思考中"
                        : moveCount === 0
                        ? "暂无棋谱可回放"
                        : "回放本局"
                    }
                    className={cn(
                      "gap-1.5",
                      status !== "playing" &&
                        moveCount > 0 &&
                        "ring-2 ring-orange-300"
                    )}
                  >
                    <Film className="h-4 w-4" /> 回放
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setExportOpen(true)}
                    disabled={moveCount === 0}
                    title={moveCount === 0 ? "暂无棋谱可导出" : "导出棋谱"}
                    className="gap-1.5"
                  >
                    <Download className="h-4 w-4" /> 导出棋谱
                  </Button>
                </div>
              </CardContent>
            </Card>
            )}

            {/* stats & achievements */}
            <Card
              interactive
              className={cn(
                "glass",
                isReplay && "opacity-50 pointer-events-none"
              )}
            >
              <CardHeader className="p-5 pb-2.5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-orange-500" /> 战绩 & 成就
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 p-5 pt-0">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { k: "胜", v: stats.wins, c: "text-emerald-600" },
                    { k: "负", v: stats.losses, c: "text-rose-500" },
                    { k: "和", v: stats.draws, c: "text-sky-600" },
                  ].map((s) => (
                    <div
                      key={s.k}
                      className="rounded-xl bg-white/70 py-2 shadow-[var(--shadow-soft)]"
                    >
                      <div
                        className={cn(
                          "text-lg font-bold tabular-nums",
                          s.c
                        )}
                      >
                        <AnimatedNumber value={s.v} />
                      </div>
                      <div className="text-xs text-stone-400">{s.k}</div>
                    </div>
                  ))}
                </div>

                {/* win-streak progress toward 5 */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                    <span>当前连胜</span>
                    <span className="font-semibold text-orange-600">
                      {stats.streak} / 5
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200/70">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-700 ease-out"
                      style={{ width: `${streakPct * 100}%` }}
                    />
                  </div>
                </div>

                {/* achievement badges */}
                <div className="grid grid-cols-3 gap-2.5">
                  {ACHIEVEMENTS.map((a) => {
                    const earned = isEarned(a.id, stats);
                    const tone = TONE_CLASSES[a.tone];
                    const Icon = ACH_ICON[a.icon] ?? Sparkles;
                    return (
                      <div
                        key={a.id}
                        title={a.desc}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-center transition-all duration-300 hover:-translate-y-0.5",
                          earned
                            ? cn("border-transparent", tone.bg, tone.glow)
                            : "border-stone-200 bg-stone-50/80 opacity-60 grayscale"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                            earned
                              ? cn(tone.bg, tone.text)
                              : "bg-stone-200 text-stone-400"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span
                          className={cn(
                            "text-[11px] font-medium leading-tight",
                            earned ? "text-stone-700" : "text-stone-400"
                          )}
                        >
                          {a.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* ---- mobile bottom action bar ---- */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-1 border-t border-white/60 bg-white/80 px-3 py-2.5 backdrop-blur-md pb-[calc(0.625rem_+_env(safe-area-inset-bottom))] lg:hidden">
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          aria-label="切换先手"
          title="切换先手"
          onClick={() => setHumanColor(humanColor === BLACK ? WHITE : BLACK)}
        >
          <User className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          aria-label="重新开始"
          title="重新开始"
          onClick={restart}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          aria-label="悔棋"
          title="悔棋"
          disabled={!canUndo}
          onClick={undo}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          aria-label="音效开关"
          title="音效开关"
          onClick={toggleMute}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          aria-label="切换视图"
          title={viewMode === "3d" ? "切换到 2D 视图" : "切换到 3D 视图"}
          onClick={() => switchView(viewMode === "3d" ? "2d" : "3d")}
        >
          {viewMode === "2d" ? <Box className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          aria-label="回放"
          title={thinking ? "AI 思考中" : moveCount === 0 ? "暂无棋谱可回放" : "回放"}
          disabled={!replay.canEnterReplay}
          onClick={replay.enterReplay}
        >
          <Film className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          aria-label="导出棋谱"
          title={moveCount === 0 ? "暂无棋谱可导出" : "导出棋谱"}
          disabled={moveCount === 0}
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* ---- mobile replay bottom sheet (covers the action bar while open) ---- */}
      {isReplay && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] lg:hidden">
          <ReplayPanel
            compact
            replay={replay}
            humanColor={humanColor}
            muted={muted}
            onToggleMute={toggleMute}
            viewMode={viewMode}
            onSwitchView={switchView}
            onExport={() => setExportOpen(true)}
            exportDisabled={moveCount === 0}
          />
        </div>
      )}

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        game={game}
        humanColor={humanColor}
        pushToast={pushToast}
      />

      <Toaster items={toasts} onDismiss={dismissToast} />
      {egg && <Confetti />}
      {celebrate && <Confetti />}
    </div>
  );
}
