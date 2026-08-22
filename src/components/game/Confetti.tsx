import * as React from "react";
import { useMemo } from "react";

/** One-shot celebratory burst, rendered when the title is clicked or the player wins. */
export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 90 + Math.random() * 180;
        const palette = ["#f97316", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#0ea5e9"];
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
    [],
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
