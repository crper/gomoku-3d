# 3D 五子棋 动效规格书（fx-spec）v1.0

- 作者：林绘澄（美术总监 / art-director-fx）· 任务 T10-SPEC
- 档位：**明显活泼**（存在感强但不吵）
- 适用文件：`src/components/GameBoard.tsx`（本规格只描述改法，不改源码）
- 硬约束确认：零新增运行时依赖；全部动效仅用 three 内建能力（useFrame、材质 emissive/opacity/color、scale/position、内建几何体）。**本规格不使用任何内联 shader**，理由见 §10。
- 源码事实已实地核对（2024 常量、组件行号、`matchMedia('(prefers-reduced-motion: reduce)')` 先例、`stones` keyed by `${x}-${y}`）。

---

## 0. 全局约定

### 0.1 缓动函数库（模块级纯函数，engineer 直接抄）

```ts
const easeOutCubic  = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutQuad   = (t: number) => 1 - (1 - t) * (1 - t);
const easeInQuad    = (t: number) => t * t;
// overshoot 回弹；c1 越大过冲越高
const easeOutBack   = (t: number, c1: number) => {
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
```

### 0.2 reduced-motion 统一入口

现在 `WinLine` / `CelebrationGlow` / `CameraRig` / `Scene` 各自 `useMemo` 一份 matchMedia，建议抽成文件内模块级常量或 `useReducedMotion()`（仍在 GameBoard.tsx 内，不新增文件也可）。所有新动效必须走同一个开关。逐项降级行为见 §8.3 总表。

### 0.3 颜色令牌（沿用现有，新增 2 个）

| 令牌 | 值 | 用途 |
|---|---|---|
| GUIDE_COLOR | `#f97316` | 现有：高亮/准线/赢线/脉冲 |
| **DUST_COLOR** | `#b78a54` | 新增：落点尘埃波纹（木色扬尘，深于棋盘 `#e9cfa3`） |
| **DIM_WHITE / DIM_BLACK** | `#a8a29e` / `#0b0b0d` | 新增：胜利时非赢线棋子压暗目标色 |

### 0.4 Y 高度分层表（防 z-fight，全部新旧元素）

| 元素 | y | 备注 |
|---|---|---|
| InteractionPlane | 0.005 | 现有 |
| GridLines | 0.012（box 顶面 0.022） | 现有 |
| 星位 | 0.02（顶面 0.035） | 现有 |
| **ThinkingFrame（新）** | 0.026 | §6 |
| Hover 准线 | 0.03（顶面 0.05） | 现有 |
| **尘埃波纹 ring1 / ring2（新）** | 0.055 / 0.052 | §2，两环错 0.003 防互相 z-fight |
| LastMovePulse 外环 | 0.219（现有 0.189+0.03） | 保留 |
| **LastMovePulse 内环（新）** | 0.216 | §4，与外环错开 |
| CelebrationGlow | 0.06 | 现有 |
| WinLine 条 | 0.5 | 现有 |

---

## 1. 落子弹跳（P0，用户点名）— 改 `Stone`，**替换**现有 easeOutCubic

### 1.1 触发与门控（重要工程约束）

- 触发：`Stone` mount。但 stones 以 `${x}-${y}` 为 key，**读档/整盘重挂载时全部棋子会同时播放入场动画**（现有代码同样有此问题，只是 160ms 不明显）。
- 规则：给 Stone 新增 prop `entrance: "bounce" | "pop"`。Scene 里判定：`entrance = (lastMove && lastMove.x===s.x && lastMove.y===s.y) ? "bounce" : "pop"`。
  - `"bounce"`：本节完整动效（只有最新一子播放）。
  - `"pop"`：现状 160ms easeOutCubic 缩放弹入，**保留不动**，用于批量挂载。
- 性能守卫（顺手修，P1）：`useFrame` 里动画完成后 `if (settled) return;`（配合 §5 winIndex 例外），避免满盘 225 个 Stone 每帧空跑 `scale.set`。

### 1.2 缩放回弹（2D/3D 通用，2D 下这就是主表现）

替换 `Stone` 的 useFrame 主体：

```
t ∈ [0, D]，p = t / D
s = easeOutBack(p, c1)
scale.set(s, s * STONE_FLAT * squash(p), s)   // squash 见 1.3，2D 下 squash ≡ 1
```

黑白差异化（黑子沉稳、白子轻快，档位内的细节活泼感）：

| 参数 | 黑子 | 白子 |
|---|---|---|
| 总时长 D | **280 ms** | **230 ms** |
| overshoot 系数 c1 | **1.40**（峰值 ≈ 107.5%，出现在 ≈ 0.70·D ≈ 196 ms） | **1.95**（峰值 ≈ 111%，≈ 0.68·D ≈ 156 ms） |

等价三段关键帧（若工程师偏好分段实现，二选一，效果等价）：

| 段 | 黑子 | 白子 | 段内缓动 |
|---|---|---|---|
| 0 → 107.5% / 111% | 0–190 ms | 0–150 ms | easeOutQuad |
| 峰值 → 97% | 190–245 ms | 150–195 ms | easeInQuad |
| 97% → 100% | 245–280 ms | 195–230 ms | easeOutQuad |

### 1.3 3D 附加：Y 轴落下 + 触地压扁（仅 `viewMode === "3d"`）

需要把 `viewMode` 从 Scene 传进 Stone（Scene 已持有该 prop）。

- **下落**：`y = restY + 0.55 * (1 - easeOutCubic(min(1, t / 120ms)))`，restY = `STONE_RADIUS*STONE_FLAT` ≈ 0.189。即从上方 0.55 世界单位、120ms 落到位。castShadow 已开启，阴影随落下收拢是免费的重量感。
- **触地压扁（squash）**：`squash(p)` 只作用于 y 缩放：
  - 120–170 ms：yScale 因子 1.0 → **0.84**（easeOutQuad）
  - 170 ms–D：0.84 → 1.0（easeOutQuad）
  - 其余时间恒 1.0。
- **2D 替代**：正俯视下 Y 位移与压扁完全不可见 → 不执行（`viewMode==="2d"` 时跳过 1.3 全部），由 1.2 的 XZ 过冲 + §2 尘埃波纹承担落子冲击感。**这两项在俯视图里清晰可见，是等价表现，不是缩水。**

### 1.4 终止条件

`t ≥ D` 后钳制 scale = (1, STONE_FLAT, 1)、y = restY，置 settled，useFrame 早退。

### 1.5 reduced-motion

退回现状：160ms easeOutCubic 缩放弹入，无过冲、无下落、无压扁（现有行为即为降级态，零额外工作）。

---

## 2. 落点尘埃波纹（P0，用户点名）— **新增组件** `ImpactRipple`

### 2.1 挂载与生命周期（防内存泄漏的关键）

- Scene 中：`{lastMove && !reduced && <ImpactRipple key={`${lastMove.x}-${lastMove.y}`} move={lastMove} />}`。key 变化即重挂载重播，与新落子天然同步。
- 组件内部 `const [done, setDone] = useState(false)`；useFrame 中 `t ≥ 生命周期` 时 `setDone(true)` 一次；`done` 时 `return null` → mesh 从场景树移除，R3F 自动 dispose JSX 声明的 geometry/material。**不做任何手动池化**（每 ≥1s 才落一子，分配量可忽略）。
- 时序对齐：波纹 0ms 起播，与 §1.3 触地时刻（120ms）相比略早，视觉上读作"落定激起"，实测差异不可辨；不为对齐增加延迟复杂度。

### 2.2 双环参数

几何：`ringGeometry(0.30, 0.40, 40)`，两环共用同一份（组件内 useMemo 一份，两 mesh 引用）；材质各自独立（opacity 独立动画）。

| 参数 | ring1（主环） | ring2（回声环） |
|---|---|---|
| 延迟 | 0 ms | 90 ms |
| 时长 | 450 ms | 380 ms |
| scale（XZ 等比） | 1.0 → **2.2**（外半径 0.40→0.88），easeOutCubic | 0.8 → **1.7**，easeOutCubic |
| opacity | `0.50 * (1-p)^1.5`（p 为线性时间进度） | `0.32 * (1-p)^1.5` |
| y | 0.055 | 0.052 |

材质公共项：`meshBasicMaterial`，color = DUST_COLOR `#b78a54`，`transparent`，**`depthWrite={false}`**，`blending` 保持 Normal（浅色棋盘上 Additive 会被洗白），`renderOrder={2}`；`rotation={[-Math.PI/2,0,0]}`。

- 与 GridLines（顶面 y=0.022）、准线（顶面 y=0.05）无共面：0.052/0.055 高于两者且 depthWrite=false，无遮挡写入。
- 环外半径峰值 0.88 <（SPACING/2=0.5 的两倍），会轻微越过相邻交叉点——刻意的，"扬尘"需要越界才有冲击感；opacity 到达邻点时已 < 0.12，不干扰判断。

### 2.3 2D / reduced-motion

- 2D：完全平面效果，原样可见，**同时充当 §1.3 的俯视替代**，无需适配。
- reduced-motion：整个组件不挂载（见 2.1 条件）。

---

## 3. 悬停呼吸预览（P0，用户点名）— 改 `HoverPreview`

### 3.1 工程前置警告

`HoverPreview` 现在 `if (!hover) return null` 在函数体最上方——**加 useFrame 前必须重构**（hooks 不能在条件 return 之后）。方案：外层保留早退，内部拆一个始终调用 hooks 的子组件 `<HoverPreviewInner …/>`；或把早退改为 `visible={!!hover}` + hover 缓存。二选一，推荐前者（最小 diff）。

### 3.2 呼吸载体：opacity（不是 scale）

scale 呼吸会让幽灵棋子大小失真、干扰"这颗子落下多大"的预判，**否决**。用 opacity 正弦呼吸：

- 有效落点（valid）：`opacity = 0.38 + 0.10 * sin(2π * 0.9 * clock.elapsedTime)` → 区间 **[0.28, 0.48]**，频率 **0.9 Hz**（周期 ≈1.11s，比心跳略快，读作"活"而非"闪"）。
- 无效落点（已有子）：恒 **0.18**，不呼吸（保留现状值）。
- 附加微缩放（可选装饰，同相位）：`scaleXZ = 1 + 0.015 * sin(同相位)`，振幅仅 1.5%，不影响尺寸预判。工程上多 1 次 scale.set，可做可不做；做则与 opacity 同一个 useFrame。

### 3.3 十字准线

**保持静态**（emissiveIntensity 0.6 / opacity 0.7 不变）。理由：准线横贯整盘 14 单位长，跟随呼吸会造成全屏低频闪烁，违反"不吵"。P2 可选：准线 opacity 以 **±0.08** 振幅同相位微呼吸（0.62–0.78），默认不做。

### 3.4 AI 回合（`interactive === false`）

InteractionPlane 的 onHover 不受 interactive 门控（只有 onPlace 受），所以 AI 回合仍会有 hover。规则：给 HoverPreview 新增 prop `interactive: boolean`：

- `interactive=false` 时：幽灵棋子恒 opacity **0.12**、不呼吸；**十字准线隐藏**（不渲染两条 box）。语义 = "看得见位置、明确不是你的回合"。
- 恢复 interactive 后瞬时切回 3.2 行为（无过渡，呼吸相位用 `clock.elapsedTime` 全局相位，无跳变）。

### 3.5 2D / reduced-motion

- 2D：opacity 呼吸俯视完全可见，无需适配。
- reduced-motion：恒 opacity 0.45（= 现状），准线现状，不呼吸。

---

## 4. 最后一手光环（P0，用户点名）— 增强 `LastMovePulse` + Scene 层避让

### 4.1 形态：双环（外扩散环 **保留改参** + 内呼吸环 **新增**）

**外环（现有 ring 改参）**：`ringGeometry(0.42, 0.54, 40)` 不变。

- 周期 **1.6 s**（现 1.4s），`t = (clock.elapsedTime % 1.6) / 1.6`
- scale：`0.75 + easeOutQuad(t) * 0.95` → 0.75 → 1.70（现在是线性 0.7→2.2，改为前快后慢、收小最大半径，减少与邻格串扰）
- opacity：`0.50 * (1 - t)`
- y = 0.219（现值保留）

**内环（新增 mesh，同组件内）**：`ringGeometry(0.46, 0.52, 40)`，y = 0.216，静止不扩散：

- `opacity = 0.35 + 0.15 * sin(2π * 0.7 * clock.elapsedTime)` → **[0.20, 0.50]**，0.7 Hz
- color = GUIDE_COLOR，meshBasicMaterial，transparent，depthWrite=false

棋子本体的 highlight emissive（0.35，现有）**保留**——它是 2D 模式最稳的"最后一手"标记。

### 4.2 避让规则（消除同格视觉打架，全部在 Scene 层条件渲染）

| 冲突方 | 规则 |
|---|---|
| Hover 命中同格 | `hover && hover.x===lastMove.x && hover.y===lastMove.y` → **整个 LastMovePulse 不渲染**（该格已有子，hover 是无效落点幽灵 opacity 0.18，让位给它 + 棋子 emissive 已足够标记）。相位用 `clock.elapsedTime` 绝对时间，卸载重挂不跳相。 |
| winLine 存在 | `winLine != null` → **LastMovePulse 不渲染**（最后一手必在赢线上，胜利动效 §5 全面接管；现状是两者叠放，属 bug 级噪声，本规格明确移除）。 |
| 尘埃波纹（§2） | 无需避让：波纹 450ms 内自灭，且色相（木色）与光环（橙）分离；外环首个周期与波纹重叠 <0.3s，可接受。 |

Scene 渲染条件汇总：`{lastMove && !winLine && !(hover 同格) && <LastMovePulse move={lastMove} />}`。

### 4.3 消失时机

- 下一手落下：lastMove prop 变化，环自动迁移（现状，保留）。
- 胜利：立即消失（4.2）。
- 平局：见 §7.2（400ms 淡出后卸载）。

### 4.4 2D / reduced-motion

- 2D：双环均为平面效果，原样可见。
- reduced-motion：只渲染内环，恒 opacity **0.40**，无呼吸无扩散（比现状的持续扩散动画更安静，符合降级本意）。

---

## 5. 胜利时刻（P0，用户点名：流光 + 跳动）

### 5.1 赢线流光：逐子行波（改 `Stone` + 改 `WinLine`）

**实现位置**：给 `Stone` 新增 prop `winIndex?: number`（0–4，按 winLine 数组顺序；Scene 里用 `winLine.findIndex(m => m.x===s.x && m.y===s.y)` 建 Map 一次性算好）。`winIndex !== undefined` 的棋子在自己已有的 useFrame 里跑行波（不新增 useFrame 回调）。

**行波公式**（T=1800ms 循环，逐子相位差 **216 ms**，波从赢线第 0 子流向第 4 子，循环不息直到重开）：

```
w_i(t) = max(0, sin(2π * (clock.elapsedTime*1000 - i*216) / 1800))
emissiveIntensity_i = 0.25 + 0.85 * w_i^3        // 基线 0.25，峰值 1.10
emissive 色 = GUIDE_COLOR（黑白子同色，白子会呈橙热感，实测对比足够）
```

`w^3` 使亮斑窄而锐（脉冲感），相邻子峰间 216ms、单峰半宽 ≈300ms → 视觉连续流光。**循环式**而非一次性：胜利画面停留期间持续可读。

**点火序（一次性，仅第一循环）**：celebrate 置位后第 i 子在 `i*120ms` 才允许 w_i > 0（之前钳 0）。即 0/120/240/360/480ms 依次点亮，600ms 内完成点火，随后进入稳态循环。

**WinLine 发光条（改参，保留组件）**：从主角降为底衬——脉冲频率 3 rad/s → **0.5 Hz**（`sin(2π*0.5*t)`），emissiveIntensity 区间 0.6–1.2 → **[0.55, 0.90]**。逐子行波成为主视觉。

### 5.2 五子跳动

**3D**（`viewMode==="3d"`）：复用同一 `w_i`：

```
y_i = restY + 0.35 * w_i^2      // 峰值抬升 0.35 世界单位（≈0.83 倍棋子直径）
```

行波相位天然形成"波浪跳"，每子每 1.8s 跳一次、350ms 左右在空中。castShadow 让影子同步呼吸，免费。

**2D 替代（必给，正俯视 Y 不可见）**：`viewMode==="2d"` 时以 XZ 缩放脉冲替代：

```
scaleXZ_i = 1 + 0.12 * w_i^2    // 峰值 112%，与 emissive 行波同相位
```

俯视下读作"逐子放大发亮的波"，与 3D 的跳动等价级存在感。（y 恒 restY。）

### 5.3 非赢线棋子压暗

celebrate 置位起 **500 ms**、easeOutQuad，把非赢线棋子 material.color 从原色 lerp 到压暗色：

| 棋子 | 原色 | 目标色 | 说明 |
|---|---|---|---|
| 白 | `#f4f4f5` | **`#a8a29e`**（DIM_WHITE，约 65% 明度） | 主要对比来源 |
| 黑 | `#16161a` | **`#0b0b0d`**（DIM_BLACK） | 黑子本就深，微降即可 |

实现：Stone 持有 `baseColor`（useMemo 的 THREE.Color），每帧 `material.color.lerpColors(base, dimTarget, k)`，k 由 0→1 的 500ms 进度驱动（**基于存量插值，禁止累积 lerp**，否则帧率相关）。不用 opacity（会迫使全部棋子 transparent，引发排序成本），emissive 不动。重开局棋子全部卸载，无需恢复逻辑。此项为静态状态变化，**reduced-motion 下保留**（500ms 过渡改为瞬时）。

### 5.4 与 App 层 2D Confetti 的配合

- 场景内**不新增**任何粒子爆发（Confetti 已承担"爆"的角色；再加 3D 粒子 = 吵 + draw call 失控）。
- CelebrationGlow 保留现参数（opacity 0.10–0.16 封顶 ≤0.18），与 Confetti 叠加后总亮度不过曝。
- 时序：celebrate 置位 → 场景点火序 600ms + Confetti（App 层自主时序）并行；点火序短于 confetti 生命周期，互为前后景，无需跨层同步代码。

### 5.5 reduced-motion

- 行波、跳动/缩放脉冲：**关**。赢线五子恒 emissiveIntensity **0.6**（静态点亮），WinLine 条恒 0.9（= 现有降级行为）。
- 压暗：瞬时应用（见 5.3）。
- CelebrationGlow：现有降级逻辑保留。

---

## 6. AI 思考微光（P0，用户点名）— **新增组件** `ThinkingFrame`

> **依赖：`thinking` prop 目前未传入 GameBoard，需要 App 层新增传递**（见 §11）。在 prop 就绪前此项无法上线，其余各节不受影响。

### 6.1 作用对象选型

- ❌ 全局环境光脉动：影响所有材质观感、干扰棋面判断，否决。
- ❌ 最后一手位置发光：与 §4 光环同位打架，否决。
- ✅ **棋盘边缘细框微光**：4 条细 box 组成方框，处于视野边缘，符合"极轻、不干扰判断"。

### 6.2 几何与参数

4 个 `boxGeometry`，共用 1 份材质实例（opacity 统一动画，恰好要同步）：

- 两条横：size `[15.2, 0.02, 0.08]`，position `[0, 0.026, ±7.6]`
- 两条纵：size `[0.08, 0.02, 15.2]`，position `[±7.6, 0.026, 0]`
- 位置在网格边缘（±7）与棋盘物理边缘（±8）之间，不压任何交叉点。

材质：`meshBasicMaterial`，color GUIDE_COLOR，transparent，depthWrite=false，Normal blending。

**呼吸**：`opacity = env(t) * (0.12 + 0.12 * (sin(2π * clock.elapsedTime / 2.4) + 1) / 2)` → 稳态区间 **[0.12, 0.24]**，周期 **2.4 s**（慢于一切其他动效，读作"后台在想"）。

**包络 env(t)**（进出场）：

- thinking=true：0 → 1，**300 ms** easeOutQuad 淡入。
- thinking=false：1 → 0，**450 ms** easeOutQuad 淡出，到 0 后组件卸载（AI 落子瞬间框光正好熄灭，衔接 §1 落子弹跳，形成"想完→落"的节奏）。

### 6.3 2D / reduced-motion

- 2D：平面框，俯视完全可见，无需适配。
- reduced-motion：不呼吸，thinking 期间恒 opacity **0.14**，淡入淡出保留但缩短为 0ms/0ms（瞬时）。

---

## 7. 棋盘本体

### 7.1 入场动画（P2，成本量化后：值得做但排最后）

- **方案**：Scene 中把棋盘基座 + GridLines + ContactShadows 包一个 `<group>`，首帧 group.position.y = **-0.35**，450 ms easeOutCubic 升到 0。一次性，结束后 useFrame 早退。
- **成本量化**：1 个 useFrame 回调 × 450ms（之后 0 成本）、每帧 1 次矩阵更新、**0 新增 draw call**、0 新增材质。首屏无 shader 编译、无额外资源加载。结论：成本近零，但收益也只在首次加载 1 次，故 P2。
- **2D 替代**：Y 位移俯视不可见 → 建议改用 DOM 层 CSS：Canvas 容器 `opacity 0→1, 300ms ease-out`（App 层 className，见 §11；GPU 合成层淡入，3D 侧零成本）。3D 模式两者叠加，2D 模式只有 CSS 淡入。
- reduced-motion：直接终态，无动画。

### 7.2 平局收束（P1）

触发：对局结束且 `winLine == null` 且棋盘满 / App 判和（GameBoard 可由 `interactive===false && !winLine && 盘满` 推断，或依赖 App 未来传状态——本版用推断，不加 prop）。

- 全部棋子 600 ms easeOutQuad 压暗至 §5.3 目标色的 **50% 程度**（k 终值 0.5，比胜利压暗轻，语义"尘埃落定"而非"衬托赢家"）。
- LastMovePulse：**400 ms** opacity 线性 → 0 后卸载（在 LastMovePulse 内加 `fading` prop，或 Scene 延迟 400ms 卸载；推荐前者）。
- 不加任何新几何。reduced-motion：瞬时压暗、瞬时卸载。2D：色彩变化俯视可见，无需适配。

---

## 8. 性能与降级预算

### 8.1 每帧计算量

| 状态 | useFrame 回调数（新增） | 矩阵更新/帧（新增） | 说明 |
|---|---|---|---|
| 平时（对局中，有 hover） | +2（HoverPreviewInner、LastMovePulse 内环并入现有回调不新增） | ≤2（幽灵微缩放、外环 scale 已存在） | Stone settled 早退后，满盘 225 子的存量空跑归零（净赚） |
| 落子瞬间 450ms 窗口 | +1（ImpactRipple） | +3（弹跳子 1 + 双环 2） | 瞬态 |
| AI 思考中 | +1（ThinkingFrame） | 0（只改 opacity） | |
| 胜利循环 | +0（行波并入 5 颗 Stone 已有回调） | +5（5 子 y/scale） | 压暗 500ms 内额外 ≤225 次 color lerp（无矩阵更新，Color.lerpColors 是纯 CPU 三次乘加，可忽略） |

**稳态新增 useFrame 回调 ≤ 3，峰值 ≤ 5。**

### 8.2 draw call 增量上限

| 元素 | 增量 | 存续 |
|---|---|---|
| 尘埃双环 | +2 | 450ms 瞬态 |
| LastMovePulse 内环 | +1 | 常驻（对局中） |
| ThinkingFrame（4 box） | +4 | 仅 AI 回合 |
| 其余（弹跳/呼吸/流光/跳动/压暗） | +0 | 全是既有 mesh 的材质/变换动画 |

**硬上限：稳态新增 ≤ 5，瞬时峰值新增 ≤ 7。** 超限即砍 ThinkingFrame 合并为 1 条（只留顶边横条）。

### 8.3 reduced-motion 逐项降级总表

| # | 动效 | 降级行为 |
|---|---|---|
| 1 | 落子弹跳 | 现状 160ms easeOutCubic，无过冲/下落/压扁 |
| 2 | 尘埃波纹 | 不挂载 |
| 3 | 悬停呼吸 | 恒 opacity 0.45（现状） |
| 4 | 最后一手光环 | 仅静态内环 opacity 0.40 |
| 5a | 赢线流光 | 五子恒 emissive 0.6，条恒 0.9，无行波 |
| 5b | 五子跳动/脉冲 | 关 |
| 5c | 非赢线压暗 | 保留，瞬时应用（非运动） |
| 6 | AI 思考微光 | 恒 opacity 0.14，无呼吸，瞬时进出 |
| 7a | 棋盘入场 | 直接终态 |
| 7b | 平局收束 | 瞬时压暗 + 瞬时卸载光环 |

### 8.4 2D 正俯视逐项适配总表

| # | 动效 | 2D 表现 |
|---|---|---|
| 1 | 落子弹跳 | XZ 过冲缩放原样可见；Y 下落/压扁**跳过** |
| 2 | 尘埃波纹 | 原样（平面效果），兼任落子冲击的 2D 主表现 |
| 3 | 悬停呼吸 | 原样（opacity） |
| 4 | 最后一手光环 | 原样（平面双环） |
| 5a | 赢线流光 | 原样（emissive 行波俯视可见） |
| 5b | 五子跳动 | **替换**为 XZ scale 脉冲 1→1.12，同相位 |
| 5c | 压暗 | 原样 |
| 6 | 思考微光 | 原样（平面框） |
| 7 | 棋盘入场 | Y 位移跳过，改 CSS 容器淡入 300ms |

### 8.5 低端设备兜底

- 不引入设备探测库（零依赖红线）。启发式：`gl.getPixelRatio() 被 dpr 钳到 1` **或** 首 60 帧平均 delta > 24ms（掉帧 <42fps）→ 置模块级 `fxLite = true`。
- fxLite 砍单：尘埃只留 ring1；ThinkingFrame 恒 opacity 0.14 不呼吸；胜利行波保留、跳动关（只留 emissive）；悬停呼吸保留（几乎零成本）。
- `dpr={[1,2]}` 与 shadow map 1024 现状不动。

---

## 9. 实施优先级

| 级别 | 项 | 用户点名 |
|---|---|---|
| **P0** | §1 落子弹跳、§2 尘埃波纹、§3 悬停呼吸、§4 光环增强+避让、§5.1/5.2 流光+跳动、§6 思考微光*、§8.3 reduced-motion 全表 | ✅ 全部点名 |
| **P1** | §5.3 压暗、§7.2 平局收束、Stone settled 早退（性能）、§8.5 fxLite | — |
| **P2** | §7.1 棋盘入场、§3.3 准线同步呼吸（默认不做） | — |

\* §6 被 `thinking` prop 阻塞（§11），可在 P0 批次内最后合入。

---

## 10. 风险与替代方案（含 shader 决策）

1. **内联 shader：本规格明确不用。** 唯一候选是赢线流光的渐变扫光 shader，成本：首次胜利瞬间的 program 编译会造成一次 10–50ms 主线程/GPU 卡顿（恰在最需要流畅的时刻），且 ShaderMaterial 绕开 three 颜色管理需额外维护。§5.1 的逐子 emissive 行波用零 shader 达成 90% 的效果。**若未来要更华丽：预编译（挂一个 1px 不可见 mesh 提前 warm-up）后再用 shader，属 v2。**
2. **"棋子跳动"在 2D 不可见**是用户点名项里唯一的硬冲突，已给等价替代（§5.2 XZ 脉冲），不建议在 2D 强行做假透视缩放（会被误读为棋子变大）。
3. **HoverPreview hooks 重构**（§3.1）是唯一有回归风险的结构改动，改完需回归验证 hover 进出、AI 回合、2D/3D 切换三条路径。
4. **TS 严格模式**（noUnusedLocals/Params）：分段实现时未用的缓动函数别预留，用到再加；useFrame 未用形参写成 `(_, delta)` / `({ clock })`（现有代码风格已如此）。
5. **满盘读档批量挂载**：§1.1 的 `entrance="pop"` 门控是防"整盘 225 子齐跳"的必要措施，不能省。

---

## 11. 对外依赖清单（GameBoard 之外的配合项）

| # | 依赖 | 改动位置 | 说明 |
|---|---|---|---|
| 1 | **`thinking: boolean` prop** | App 层 → `GameBoardProps` 新增可选 `thinking?: boolean` → Scene → ThinkingFrame | §6 唯一阻塞项；AI 计算期间为 true |
| 2 | Canvas 容器 CSS 淡入 | App 层容器 className：`opacity 0→1 / 300ms ease-out`（首挂载一次） | §7.1 的 2D 入场替代，纯 CSS |
| 3 | （可选）平局信号 | 若 App 已有 `gameStatus === "draw"`，传入替代 §7.2 的盘满推断，更可靠 | P1 |
| 4 | Confetti 时序 | 无需改动，确认 App 侧 confetti 仅在 celebrate 置位时触发一次即可 | §5.4 |

——完——
