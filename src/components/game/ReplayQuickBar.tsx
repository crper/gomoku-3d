import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import type { UseReplayReturn } from "@/hooks/useReplay";

/**
 * Floating transport bar rendered on top of the board while replaying.
 * Gives the board itself first-class quick controls (prev / play / next /
 * jump / exit) so leaving or scrubbing a replay never requires hunting for
 * the side-panel button. Touch targets stay ≥ 36px for mobile.
 */
export function ReplayQuickBar({ replay }: { replay: UseReplayReturn }) {
  const { t } = useTranslation();
  const playing = replay.mode === "replaying-playing";
  const atStart = replay.currentStep === 0;
  const atEnd = replay.currentStep >= replay.N;

  const base =
    "flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:pointer-events-none disabled:opacity-30";
  const idle = `${base} hover:bg-white/15`;
  const exit = `${base} hover:bg-rose-500/80`;

  const playLabel = playing
    ? t("replay.pause")
    : atEnd
      ? t("replay.replayAgain")
      : t("replay.play");

  return (
    <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
      <div
        role="toolbar"
        aria-label={t("replay.mode")}
        className="flex items-center gap-0.5 rounded-full border border-white/25 bg-black/70 px-1.5 py-1 shadow-[var(--shadow-float)] backdrop-blur-md"
      >
        <button
          title={t("replay.first")}
          aria-label={t("replay.first")}
          disabled={atStart}
          onClick={() => replay.goTo(0)}
          className={idle}
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          title={t("replay.prev")}
          aria-label={t("replay.prev")}
          disabled={atStart}
          onClick={replay.stepBack}
          className={idle}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          title={playLabel}
          aria-label={playLabel}
          onClick={replay.togglePlay}
          aria-pressed={playing}
          className={`${base} mx-0.5 bg-orange-500 hover:bg-orange-400`}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
        </button>
        <button
          title={t("replay.next")}
          aria-label={t("replay.next")}
          disabled={atEnd}
          onClick={replay.stepForward}
          className={idle}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          title={t("replay.last")}
          aria-label={t("replay.last")}
          disabled={atEnd}
          onClick={() => replay.goTo(replay.N)}
          className={idle}
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <span aria-hidden className="mx-1 h-5 w-px bg-white/25" />

        <button
          title={t("replay.exitReplay")}
          aria-label={t("replay.exitReplay")}
          onClick={replay.exitReplay}
          className={exit}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
