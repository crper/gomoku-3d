<div align="center">

# ⚫⚪ Gomoku 3D · 五子棋 3D

**一款带 AI 对手、棋局回放与棋谱导出的 3D 五子棋——基于 React、Three.js 与 TypeScript 构建。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r185-black.svg)](https://threejs.org/)

🎮 **在线体验：** <https://crper.github.io/gomoku-3d/>

[English](./README.md) · [简体中文](./README.zh.md)

</div>

---

## ✨ 功能特性

- **15×15 五子棋**，落子在可交互的 3D 棋盘交叉点上。
- **两种对战模式**——经典**人机对战**与本地**双人同屏**轮流落子。
- **AI 对手四档难度**——简单 / 中等 / 困难 / **大师**：
  - 中等及以上共享一套战术规则层（提胜 / 挡胜 / 造活四 / 占双三点）；
  - **大师**在 alpha-beta negamax + 束搜索之上叠加**强制延伸搜索**（VCF 风格），可越出名义深度解算整条冲四链，并受时间/节点预算约束。
- **提示系统**——由大师级引擎为当前执子方推荐落点（每局 3 次），棋盘上以翡翠色信标展示；双人模式下双方均可用。
- **坐标系系统**——连珠惯例的棋盘边缘刻度（列 **A–O**，行 **1–15** 自下而上；天元读作 **H8**），单张 Canvas 纹理绘制；瞄准时悬浮坐标徽章跟随十字准线，状态栏同步实时读数。
- **双视图模式**——2D 平面锁视角（清爽下棋）与 3D 自由轨道视角，切换有平滑相机补间。
- **棋盘快捷回放控制**——回放时棋盘上悬浮传输控制条（首手 / 上一手 / 播放 / 下一手 / 末手 / 退出），左上角回放徽章本身也可点击退出，无需去侧栏找按钮；`Esc` 快捷键依旧可用。
- **无交互死区**——双人模式下难度卡变为说明卡（附一键"切换人机"），而不是莫名禁用的灰块；回放期间战绩卡保持可用。
- **丰富动效**——落子弹跳 + 尘埃波纹、悬停呼吸预览、最后一手脉冲、胜利连线流光跳动、AI 思考微光；全部尊重 `prefers-reduced-motion` 降级。
- **Web Audio 合成音效**——落子 / 悬停 / 悔棋 / 提示 / 胜负 / 成就提示，可静音；**无音频文件、零音频依赖**。
- **战绩与成就**持久化到 `localStorage`（胜/负/和、连胜、速胜、击败困难等）。双人同屏纯属娱乐，不计入统计。
- **悔棋**——人机模式回退一整回合（你的一手 + AI 的应手）；双人模式逐手回退。
- **棋局回放**——逐步前进 / 后退、跳转任意手、播放-暂停（0.5×–4× 调速）、可拖动进度条；只读观察模式，不影响实时对局。
- **棋谱导出**——把已结束或进行中的对局导出为 **SGF**（围棋/五子棋/连珠软件通用格式）、**JSON** 或人类可读的 **TXT**，文件名可自定义，并按模式正确标注对局者。
- **防漂移计时器**——基于墙钟时间戳计算用时。
- **全面响应式**——桌面侧栏布局 + 移动端底部操作条，无重叠、无溢出。
- **键盘快捷键**与无障碍支持（ARIA 标签、`aria-live` 当前手信息、焦点管理的对话框）。

## 🧱 技术栈

| 层       | 选型                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI 框架  | [React 19](https://react.dev/) + [TypeScript 7](https://www.typescriptlang.org/)（strict 严格模式）                                                                                    |
| 构建工具 | [Vite 8](https://vitejs.dev/)（rolldown）                                                                                                                                              |
| 3D 渲染  | [Three.js r185](https://threejs.org/)，经 [`@react-three/fiber` 9](https://github.com/pmndrs/react-three-fiber) + [`@react-three/drei` 10](https://github.com/pmndrs/react-three-drei) |
| 样式     | [Tailwind CSS 4](https://tailwindcss.com/) + 手写 shadcn/ui 风格组件                                                                                                                   |
| 国际化   | [react-i18next](https://react.i18next.com/)——zh / en 资源文件，语言切换器                                                                                                              |
| 音频     | Web Audio API（合成，无资源文件、无音频依赖）                                                                                                                                          |
| 状态     | React Hooks——无外部状态库                                                                                                                                                              |

## 🚀 快速开始

### 前置要求

- Node.js **≥ 18**（开发环境为 22）
- npm

### 安装与运行

```bash
git clone https://github.com/crper/gomoku-3d.git
cd gomoku-3d
npm install
npm run dev          # http://localhost:5173
```

### 脚本

| 命令                | 说明                                     |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | 启动开发服务器（`vp dev`）               |
| `npm run build`     | 类型检查（`tsc -b`）+ 生产构建到 `dist/` |
| `npm run preview`   | 本地预览生产构建                         |
| `npm run typecheck` | 运行 `tsc --noEmit`                      |
| `npm test`          | 运行 Vitest 测试套件（`vp test`）        |

## 🧪 测试

104 项用例以 [Vitest](https://vitest.dev/) 套件形式注册在 `scripts/` 下，经 Vite+ 工具链运行：

```bash
npm test        # 等价：vp test
```

覆盖：引擎规则与悔棋语义 · AI 战术规则层（提胜/挡胜/fork）· 提示引擎 · 坐标命名 · 大师对各级别强度矩阵 · 回放推导与 SGF/JSON/TXT 导出往返。

另有独立的自对弈模拟（50 完整对局——无卡死、无非法落子）：

```bash
./node_modules/.bin/esbuild scripts/sim.ts --bundle --platform=node --format=esm --outfile=/tmp/sim.mjs && node /tmp/sim.mjs
```

## 🎯 玩法

- 黑棋先行。点击任意交叉点落子。
- 横、竖、斜任意方向连成 **五子** 即胜。
- 在**对局**卡片中选择模式：与 AI 对战（可选先手与难度），或切换**双人同屏**共享屏幕对弈。
- 卡住了？点**提示**——引擎会为当前执子方推荐一步，每局 3 次。
- 通过侧栏（桌面）或底栏（移动端）切换难度/模式、先手、2D/3D 视图，以及悔棋、静音、回放、导出。

### 回放键盘快捷键

| 键             | 动作            |
| -------------- | --------------- |
| `←` / `→`      | 上一手 / 下一手 |
| `空格`         | 播放 / 暂停     |
| `Home` / `End` | 首手 / 末手     |
| `Esc`          | 退出回放        |

## 📁 项目结构

```
src/
├── App.tsx                  # 布局、状态接线、回放/导出集成
├── main.tsx                 # 入口
├── components/
│   ├── GameBoard.tsx        # 3D 棋盘场景组合（R3F）
│   ├── board/               # 棋盘子模块：棋子/特效/悬停/坐标系/相机/纹理
│   ├── game/                # 界面展示组件：结算浮层/回放快捷条/彩带/数字动画
│   ├── ReplayPanel.tsx      # 回放传输控件
│   ├── ExportDialog.tsx     # SGF/JSON/TXT 导出对话框
│   └── ui/                  # 手写 shadcn/ui 风格基础组件
├── hooks/
│   ├── useGomoku.ts         # 对局状态、模式（人机/双人）、AI 调度、提示、战绩、音效
│   ├── useReplay.ts         # 只读回放状态机
│   ├── useViewMode.ts       # 2D/3D 视图持久化
│   └── useParallax.ts       # 鼠标视差（尊重 reduced-motion）
└── lib/
    ├── gomoku/
    │   ├── types.ts         # 棋盘、着法、玩家、胜判定
    │   ├── coords.ts        # 连珠坐标命名（A–O / 1–15，天元 H8）
    │   ├── engine.ts        # 不可变对局状态 + 状态转换（整回合 / 单手悔棋）
    │   ├── ai.ts            # 战术规则层 + 启发式 + 带强制延伸的 alpha-beta 搜索
    │   ├── replay.ts        # 着法推导与"第 k 手盘面"
    │   ├── export.ts        # SGF/JSON/TXT 序列化 + 下载
    │   └── stats.ts         # 战绩与成就模型
    ├── audio/sfx.ts         # Web Audio 合成音效
    ├── consoleFilters.ts    # 已知第三方弃用噪音的精确过滤
    └── achievementIcons.ts
```

## 📦 部署

仓库内置 GitHub Actions 工作流（`.github/workflows/deploy.yml`），每次推送到 `main` 会自动构建并把 `dist/` 部署到 **GitHub Pages**。Vite 的 base 路径由 `GITHUB_REPOSITORY` 动态推导，因此任意仓库名都能正确解析资源。

## 📄 许可证

[MIT](./LICENSE) © [crper](https://github.com/crper)

<div align="center">

用 ⚛️ React · 🧊 Three.js · 💛 TypeScript 打造

</div>
