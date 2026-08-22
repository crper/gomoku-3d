import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Circle, RotateCcw, Sword, Trophy } from "lucide-react";

import type { Player } from "@/lib/gomoku/types";
import { BLACK } from "@/lib/gomoku/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home, Film } from "lucide-react";

export type GameResult = "win" | "lose" | "draw";

/**
 * Semi-transparent game-over overlay with play-again / replay / dismiss actions.
 * Mounts on game end and animates in; on dismiss it animates out before
 * unmounting. All motion collapses under `prefers-reduced-motion`.
 * In local two-player games `pvpWinner` (1 = black, 2 = white) replaces the
 * win/lose themes with colour-based ones.
 */
export function GameOverOverlay({
  open,
  result,
  pvpWinner,
  canReplay,
  onPlayAgain,
  onReplay,
  onDismiss,
}: {
  open: boolean;
  result: GameResult;
  pvpWinner?: Player | null;
  canReplay: boolean;
  onPlayAgain: () => void;
  onReplay: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      const r = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(r);
    }
    setShow(false);
    const tm = window.setTimeout(() => setRender(false), 260);
    return () => window.clearTimeout(tm);
  }, [open]);

  if (!render) return null;

  const pvpTheme =
    pvpWinner === BLACK
      ? {
          Icon: CrownIcon,
          chip: "bg-stone-800 text-white",
          title: t("overlay.blackWin"),
          desc: t("overlay.pvpDesc", { winner: t("replay.black") }),
        }
      : {
          Icon: CrownIcon,
          chip: "bg-white text-stone-700 border border-stone-200",
          title: t("overlay.whiteWin"),
          desc: t("overlay.pvpDesc", { winner: t("replay.white") }),
        };
  const theme =
    pvpWinner != null && result !== "draw"
      ? pvpTheme
      : {
          win: {
            Icon: Trophy,
            chip: "bg-amber-100 text-amber-600",
            title: t("overlay.win"),
            desc: t("overlay.winDesc"),
          },
          lose: {
            Icon: Sword,
            chip: "bg-rose-100 text-rose-600",
            title: t("overlay.lose"),
            desc: t("overlay.loseDesc"),
          },
          draw: {
            Icon: Circle,
            chip: "bg-sky-100 text-sky-600",
            title: t("overlay.draw"),
            desc: t("overlay.drawDesc"),
          },
        }[result];
  const Icon = theme.Icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={theme.title}
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center p-4 transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      <button
        aria-label={t("overlay.backToMenu")}
        tabIndex={-1}
        onClick={onDismiss}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[3px]"
      />
      <div
        className={cn(
          "relative flex w-full max-w-[19rem] flex-col items-center gap-4 rounded-3xl border border-white/60 bg-white/90 px-6 py-7 text-center shadow-[var(--shadow-float)] backdrop-blur-xl transition-all duration-300",
          show ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-3",
        )}
      >
        <span
          className={cn(
            "flex h-16 w-16 animate-pop-in items-center justify-center rounded-full",
            theme.chip,
          )}
        >
          <Icon className="h-8 w-8" />
        </span>
        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold tracking-tight text-stone-800">{theme.title}</h2>
          <p className="text-sm text-stone-500">{theme.desc}</p>
        </div>
        <div className="mt-1 flex w-full flex-col gap-2">
          <Button onClick={onPlayAgain} className="w-full gap-1.5">
            <RotateCcw className="h-4 w-4" /> {t("overlay.playAgain")}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={onReplay}
              disabled={!canReplay}
              className="flex-1 gap-1.5"
            >
              <Film className="h-4 w-4" /> {t("overlay.replay")}
            </Button>
            <Button variant="outline" onClick={onDismiss} className="flex-1 gap-1.5">
              <Home className="h-4 w-4" /> {t("overlay.backToMenu")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Crown glyph used for the PvP winner theme (kept local to this overlay). */
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 17l2-9 4.5 4L12 5l2.5 7L19 8l2 9H3z" />
    </svg>
  );
}
