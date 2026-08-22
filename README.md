<div align="center">

# ⚫⚪ Gomoku 3D

**A 3D Gomoku (Five-in-a-Row) game with an AI opponent, replay & game-record export — built with React, Three.js & TypeScript.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r185-black.svg)](https://threejs.org/)

🎮 **Live Demo:** <https://crper.github.io/gomoku-3d/>

[English](./README.md) · [简体中文](./README.zh.md)

</div>

---

## ✨ Features

- **15×15 Gomoku (Five-in-a-Row)** rendered on an interactive 3D board.
- **Two game modes** — classic **vs AI** and local **two-player** pass-and-play on one screen.
- **AI opponent** with four difficulties — Easy / Medium / Hard / **Master**:
  - a shared tactical rules layer (take wins, block wins, create open fours, occupy fork points) for Medium and above;
  - **Master** runs an alpha-beta negamax with beam pruning plus a **forced-move extension** that resolves entire four-chains beyond its nominal horizon, bounded by a time/node budget.
- **Hint system** — ask the master engine for a suggested move (3 per game), shown as an emerald beacon on the board; works for either side in two-player mode.
- **Coordinate system** — Renju-style edge labels (columns **A–O**, rows **1–15** bottom-up; the centre reads **H8**) drawn onto a single canvas texture, a floating coordinate badge that follows your crosshair while aiming, and a live read-out in the board status bar.
- **Dual view modes** — a locked 2D top-down board for clean play, and a free-orbit 3D view, with a smooth camera tween between them.
- **On-board replay controls** — a floating transport bar (first / prev / play / next / last / exit) over the board plus a tappable replay badge, so exiting or scrubbing a replay never requires hunting through panels. `Esc` still works.
- **No dead zones** — in two-player mode the difficulty card becomes an explanatory notice with a one-tap "switch to AI" action instead of a mysteriously disabled block; stats stay live during replay.
- **Juicy animations** — stone drop-bounce with dust ripple, hover breathing preview, last-move pulse, victory line shimmer & hop, AI-thinking glow. All respect `prefers-reduced-motion`.
- **Synthesized sound** via the Web Audio API — place / hover / undo / hint / victory / defeat / achievement cues, with a mute toggle. Zero audio asset files.
- **Game stats & achievements** persisted to `localStorage` (wins/losses/draws, win streaks, speed-win, beat-hard, etc.). Two-player games are just-for-fun: stats stay untouched.
- **Undo** — a full round vs the AI (your move + the AI's reply); a single ply in two-player mode.
- **Replay** any game — step forward/back, jump to any move, play/pause with 0.5×–4× speed, draggable progress bar. A read-only scrubbing mode that leaves the live game untouched.
- **Game-record export** — save a finished or in-progress game as **SGF** (the de-facto standard for Go/Gomoku/Renju software), **JSON**, or human-readable **TXT**, with a custom filename and correct player naming per mode.
- **Drift-free game timer** based on wall-clock timestamps.
- **Fully responsive** — desktop sidebar layout and a mobile bottom action bar, no overlap or overflow.
- **Keyboard shortcuts** and screen-reader-friendly controls (ARIA labels, `aria-live` move info, focus-managed dialogs).

## 🧱 Tech Stack

| Layer        | Choice                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI framework | [React 19](https://react.dev/) + [TypeScript 7](https://www.typescriptlang.org/) (strict mode)                                                                                         |
| Build tool   | [Vite 8](https://vitejs.dev/) (rolldown)                                                                                                                                               |
| 3D rendering | [Three.js r185](https://threejs.org/) via [`@react-three/fiber` 9](https://github.com/pmndrs/react-three-fiber) + [`@react-three/drei` 10](https://github.com/pmndrs/react-three/drei) |
| Styling      | [Tailwind CSS 4](https://tailwindcss.com/) + hand-written shadcn/ui-style components                                                                                                   |
| i18n         | [react-i18next](https://react.i18next.com/) — zh / en resources, language switcher                                                                                                     |
| Audio        | Web Audio API (synthesized — no asset files, no audio dependency)                                                                                                                      |
| State        | React hooks — no external state library                                                                                                                                                |

## 🚀 Getting Started

### Prerequisites

- Node.js **≥ 18** (developed on 22)
- npm

### Install & run

```bash
git clone https://github.com/crper/gomoku-3d.git
cd gomoku-3d
npm install
npm run dev          # http://localhost:5173
```

### Scripts

| Command             | Description                                         |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start the dev server (`vp dev`)                     |
| `npm run build`     | Type-check (`tsc -b`) + production build to `dist/` |
| `npm run preview`   | Preview the production build locally                |
| `npm run typecheck` | Run `tsc --noEmit`                                  |
| `npm test`          | Run the Vitest suites (`vp test`)                   |

## 🧪 Tests

104 cases are registered as [Vitest](https://vitest.dev/) suites under `scripts/` and run through the Vite+ toolchain:

```bash
npm test        # equivalent: vp test
```

Coverage: engine rules & undo semantics · AI tactics layer (wins/blocks/forks) · hint engine · coordinate naming · master-vs-every-tier strength matrix · replay derivation & SGF/JSON/TXT export round-trips.

A standalone self-play simulation (50 full games — no stalls, no illegal moves) is also available:

```bash
./node_modules/.bin/esbuild scripts/sim.ts --bundle --platform=node --format=esm --outfile=/tmp/sim.mjs && node /tmp/sim.mjs
```

## 🎯 How to Play

- Black moves first. Click any intersection to place your stone.
- Connect **five** of your stones in a row (horizontally, vertically, or diagonally) to win.
- Pick a mode in the **Match** card: play the AI (choose who goes first and the difficulty) or switch to **two-player** and share the screen.
- Stuck? Hit **Hint** — the engine suggests a move for the side to play, three times per game.
- Use the sidebar (desktop) or bottom bar (mobile) to switch difficulty/mode, swap who plays first, toggle 2D/3D, undo, mute, replay, or export.

### Keyboard shortcuts (during replay)

| Key            | Action               |
| -------------- | -------------------- |
| `←` / `→`      | Previous / next move |
| `Space`        | Play / pause         |
| `Home` / `End` | First / last move    |
| `Esc`          | Exit replay          |

## 📁 Project Structure

```
src/
├── App.tsx                  # Layout, state wiring, replay/export integration
├── main.tsx                 # Entry
├── components/
│   ├── GameBoard.tsx        # 3D board scene composition (R3F)
│   ├── board/               # Board submodules: stones, effects, hover, coords, camera, textures
│   ├── game/                # UI widgets: game-over overlay, replay quick bar, confetti, animated numbers
│   ├── ReplayPanel.tsx      # Replay transport controls
│   ├── ExportDialog.tsx     # SGF/JSON/TXT export modal
│   └── ui/                  # Hand-written shadcn/ui-style primitives
├── hooks/
│   ├── useGomoku.ts         # Game state, mode (AI/PvP), AI scheduling, hints, stats, sound
│   ├── useReplay.ts         # Read-only replay state machine
│   ├── useViewMode.ts       # 2D/3D view persistence
│   └── useParallax.ts       # Mouse parallax (reduced-motion aware)
└── lib/
    ├── gomoku/
    │   ├── types.ts         # Board, Move, Player, win detection
    │   ├── coords.ts        # Renju coordinate naming (A–O / 1–15, centre H8)
    │   ├── engine.ts        # Immutable game state + transitions (round & single-ply undo)
    │   ├── ai.ts            # Tactical rules + heuristic + alpha-beta search with threat extension
    │   ├── replay.ts        # Move derivation & board-at-step
    │   ├── export.ts        # SGF/JSON/TXT serialization + download
    │   └── stats.ts         # Stats & achievements model
    ├── audio/sfx.ts         # Web Audio synthesized SFX
    ├── consoleFilters.ts    # Precise filtering of known third-party deprecation noise
    └── achievementIcons.ts
```

## 📦 Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the app and deploys `dist/` to **GitHub Pages** on every push to `main`. The Vite base path is derived from `GITHUB_REPOSITORY`, so it works for any repo name.

## 📄 License

[MIT](./LICENSE) © [crper](https://github.com/crper)

<div align="center">

Made with ⚛️ React · 🧊 Three.js · 💛 TypeScript

</div>
