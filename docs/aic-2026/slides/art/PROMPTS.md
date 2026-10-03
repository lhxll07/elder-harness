# 美术素材生成指令（GPT Image 2.5）

**用法**：把下面每条粘进 GPT Image 2.5。生成后按文件名存到本目录（`docs/aic-2026/slides/art/`），
我来接入 `deck.css`（封面/章节页/收尾页的背景位已预留）。

## 三条硬约束（每次都要带上）

1. **画面里不要出现任何文字、字母、数字、logo**——中文尤其会糊。所有文字由我们在 HTML 里叠加。
2. **配色锁死**：深青 `#0a3733` → `#0f4a4a`（主），点缀金 `#c9a227`，浅青 `#4fd1c5`。不要出现其它色相。
3. **禁止"AI 味"元素**：发光大脑、霓虹电路、机器人、机械手、蓝色粒子、赛博朋克。这些在技术答辩里是减分项。

---

## 艺术方向：**局部可观测的地形**

这个项目最本质的技术处境是——**智能体在一个它只能部分看见的环境里办事**：
控件树可能读不到文字，只能靠截图；页面会动画、改价、轮播。
所以我们用「**等高线 / 地形图**」作为整套视觉的隐喻：**在未知地形上，一层层测出可走的路径**。
它同时呼应深青主色（深海、未探明），也比"科技蓝光效"高级得多。

---

## 1. `hero-contour.png` —— 封面背景

> Deep, dark abstract background for a technology competition cover slide. 16:9, 1920x1080.
>
> Base: a very dark teal gradient from #0a3733 (top-left) to #0f4a4a (bottom-right).
> Over it, an extremely fine topographic contour-line field (thin 1px hairlines, #4fd1c5 at
> 10-18% opacity), as if mapping an uncharted seabed. The contour lines should be dense
> and organic in the LOWER-LEFT corner and gradually thin out to almost nothing toward the
> upper right.
> A single soft volumetric light shaft entering from the upper-right, very subtle,
> #4fd1c5 at 8% opacity.
> One very thin gold #c9a227 hairline contour, slightly thicker than the rest,
> running diagonally across the middle third — the only warm accent in the image.
>
> Mood: quiet, deep, precise, cartographic. Not sci-fi. Not corporate stock.
> Composition: keep the RIGHT 45% and the TOP 25% almost entirely empty dark space.
> No text, no letters, no numbers, no icons, no logos, no grid of dots, no circuit traces.

## 2. `section-contour.png` —— 章节页背景（一张即可，我用 CSS 调色区分四节）

> Very dark minimal section-divider background. 16:9, 1920x1080.
> Solid #0a3733 base. A sparse, barely-visible topographic contour field
> (#4fd1c5 at 7-12% opacity) occupying only the RIGHT third of the frame,
> fading out toward the left. The LEFT 60% must be almost pure dark, empty space.
> A single thin gold #c9a227 vertical hairline at the far right edge.
> Flat, architectural, restrained. No text, no letters, no numbers, no icons.

## 3. `closing-horizon.png` —— 收尾页背景

> Minimal closing slide background. 16:9, 1920x1080.
> Deep teal gradient #0a3733 (top) to #123f52 (bottom), suggesting depth.
> A single fine #4fd1c5 hairline contour horizon sweeping gently across the lower third,
> with two or three fainter parallel contours beneath it.
> A faint soft radial light in the upper-left corner.
> Otherwise nearly empty dark space. Calm, resolved, forward-looking.
> No text, no letters, no numbers, no icons, no sun, no landscape, no stars.

---

## 4. 可选：`texture-grain.png` —— 全局纸面颗粒（叠加用）

> An extremely subtle monochrome noise/grain texture tile, 1024x1024, seamless.
> Neutral gray noise at very low contrast (values between #e8e8e8 and #ffffff only),
> no pattern, no lines, no shapes. Intended to be overlaid at 3-5% opacity.
