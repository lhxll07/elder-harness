# 《银龄智办》演示幻灯片 · GPT Image 2.5 生成指令与排版母版

> **文档定位**：专为 **GPT Image 2.5**（多模态 PPT 视觉生图）打造的单页幻灯片生成指令库。  
> **数据纪律**：所有数字严格溯源自真机测试（`README.md` / `docs/status.md`），严禁杜撰。  
> **视觉设计规范 (Global Style)**：16:9 宽屏，**哑光印刷感**（matte editorial，不是发光科技感），深墨绿炭底（`#0C1211`），墨玉青主色（`#3E8F79`），暖白文字（`#EDE9E0`），磨砂卡片，瑞士排版，留白充裕，文字大而少。  
> **颜色与巧思**：色板见第 00 节，**每条页面 prompt 末尾都带 `COLOR:` 与 `DETAIL:` 两行**——色值逐页重复，这是 18 张分开生成还能同色的唯一办法。

---

## 00 · 颜色基调（全片锁定，18 页不许漂）

**这一版的关键变化：去掉霓虹发光感。** 低饱和、哑光、像高质量印刷品；避开那种"AI 生成的发光图"的观感。

| 用途 | 色值 | 面积占比 | 出现位置 |
|---|---|---|---|
| 底色 | `#0C1211` 深墨绿炭 | **≈90%** | 全片背景，**不用纯黑** |
| 呼吸区 | `#131B19` | — | 卡片外的过渡 |
| 主色 | `#3E8F79` 墨玉青 | ≈5% | 唯一强调色；**哑光，不发光** |
| 主色深 | `#2C6B5B` | ≈3% | 发丝线、描边、次级图标 |
| 玉青高光 | `#9FD9C4` | **≤1%** | 只给大数字与全页最关键一个点 |
| 暖金 | `#C0A062` | **≤1%** | 全片只有三处：拟研发标记 / 收束引语 / 关键锚点 |
| 正文 | `#EDE9E0` 暖白 · `#B9C2BB` · `#7E8C86` | — | 一级 / 二级 / 三级，**不用纯白** |
| 语义·成功 | `#4E9E6A` 苔绿 | 极小 | 已实现、成功、已核验 |
| 语义·警示 | `#B98A52` 赭黄 | 极小 | 需老人确认、交还本人 |
| 语义·拒绝 | `#A8564C` 砖红 | 极小 | 拒绝、做不到、红线 |

**质感关键词（写进每条 prompt）**：matte 哑光 · low saturation 低饱和 · low contrast 低对比 · no bloom 无辉光溢出 · subtle paper grain 细微纸纹 · restrained 克制。

**明令禁止**：霓虹感与辉光溢出（no neon, no bloom）／ 任何蓝色系（深蓝、宝蓝、天蓝）／ 紫色、洋红 ／ 彩虹渐变 ／ 纯黑底配高饱和绿 ／ 语义色与金色大面积填充。

---

## 01 · 封面 · 破题立项

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 widescreen tech presentation slide. Matte editorial keynote aesthetic, calm and expensive, not a glowing tech poster. Deep green-charcoal background (#0C1211, never pure black) with subtle paper grain. In the right center, a sculptural Archimedean spiral built from tiny matte particle dots, softly lit rather than glowing. On the left, massive crisp typography. Top left has a slim outlined pill badge. Large warm-white title text: "银龄智办". Muted jade subtitle: "可信自进化跨应用助老智能体". Three subtle frosted-glass info capsules at the bottom. Generous negative space, Swiss layout, print-like restraint, 8k resolution.
COLOR: matte green-charcoal ground #0C1211 (never pure black), muted jade #3E8F79 as the single accent, deep jade #2C6B5B for hairlines and strokes, sage #9FD9C4 on under 1% of the area, warm off-white #EDE9E0 for text instead of pure white. Low saturation, matte surfaces, no bloom, no neon glow, no blue, no purple, no rainbow.
DETAIL: the spiral is built from dissolving fragments of app icons, and one hair-thin thread of light connects the elder's silhouette to the companion figure — the whole premise in a single line.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶部胶囊**：`全球校园人工智能算法精英大赛 · 算法创新赛`
- **主标题**：**银龄智办**
- **副标题**：**可信自进化跨应用助老智能体 (Trustworthy Self-Evolving Cross-App Elder Agent)**
- **核心宣言**：`老人说出需求 · 智能体跨应用协办 · 关键操作交还本人 · 困难衔接可信亲友`
- **底部信息**：`Android 原型 v0.1 · 纯 Kotlin 状态机闭环`

---

## 02 · 目录 · 架构脉络

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 widescreen presentation slide. Modern agenda slide. Deep matte green-charcoal canvas with subtle paper grain and no grid lines. An elegant 4x2 grid of 8 frosted-glass cards floating cleanly. Each card features a muted jade number (01 to 08), bold Chinese section name, small uppercase English subtitle in a dim tone. Clean architectural lines, perfectly balanced spacing.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 for numerals and card edges, deep jade #2C6B5B for secondary strokes, warm off-white #EDE9E0 headings, #7E8C86 for the small english subtitles. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: a single hair-thin line of light threads through all eight cards, entering the first and leaving the last, so the agenda reads as one continuous path rather than eight separate boxes.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`AGENDA · 答辩总览`
- **大标题**：**四个机制，一条主线**
- **8 块导航卡片**：
  - `01 | 项目背景 · BACKGROUND`（2.97 亿老龄化公共议题）
  - `02 | 痛点分析 · PROBLEM`（通用手机 Agent 三大死穴）
  - `03 | 方案总览 · SOLUTION`（让智能体适应老人：三端闭环）
  - `04 | 四大机制 · MECHANISMS`（证据核验 · 分级风控 · 语义学习 · 自进化）
  - `05 | 实测数据 · EVIDENCE`（OnePlus 真机 13 类场景跑通）
  - `06 | 工程硬核 · ENGINEERING`（双层网格 · 无损 WebP · 93% 缓存命中）
  - `07 | 安全边界 · BOUNDARY`（三级守护圈与坚决不做远程控屏）
  - `08 | 发展规划 · ROADMAP`（扎实推进可信向善的科研路线）

---

## 03 · 时代与政策 · 国家命题

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 widescreen presentation slide. Left side features 3 large matte metric typography blocks. Right side features a sleek frosted glass card highlighting the legal mandate. Deep matte green-charcoal background, authoritative and solemn keynote atmosphere, print-like restraint.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 and sage #9FD9C4 for the metric numerals (sage on under 1% of area), deep jade #2C6B5B card strokes, warm off-white #EDE9E0 headline, #B9C2BB body. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the largest figure is rendered as a dense dot matrix rather than solid type — each dot stands for a million people, so the scale is seen at a glance instead of merely read.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`项目背景 · 时代命题`
- **大标题**：**有法定要求的公共议题**
- **副标题**：适老化改造解决了“看得清”，但停留在让老人自己寻找操作的门槛上。
- **三大锚点数字**：
  - **`2.97 亿 / 21.1%`**（全国 60 周岁及以上老年人口基数）
  - **`2023.09.01`**（《无障碍环境建设法》正式施行）
  - **`2020.12`**（工信部适老化及无障碍专项行动方案）
- **核心论点卡**：
  > “多模态大模型刚刚具备看懂屏幕的能力。第一次，我们有机会把‘教老人找’变成‘替老人办’的系统工程。”

---

## 04 · 痛点剖析 · 两个维度的碰撞

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide, side-by-side comparison. Left card with muted ochre border (Elder struggles). Right card with muted brick border (Generic AI Agent pitfalls). Clean icon badges for each point. Clear structural contrast, minimalist cards on a matte deep green-charcoal canvas.
COLOR: matte green-charcoal ground #0C1211, ochre #B98A52 for the left column borders, brick #A8564C for the right column borders, deep jade #2C6B5B for the shared card strokes, warm off-white #EDE9E0 labels, #B9C2BB body. Ochre and brick stay on borders and icons only, never as large fills. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: a thin fracture runs down the centre between the two columns with faint light leaking through it, and the left column's card borders fade progressively as they go down — helplessness shown as loss of definition.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`痛点剖析 · 现实困境`
- **大标题**：**老人真正缺的是有人替他点**
- **副标题**：通用手机 Agent 直接交给老人，会同时踩中三个致命风险。
- **左栏 · 长辈这一侧的无助 (Elder Struggles)**：
  - **看不清、找不着**：办事入口隐匿在四五级深层菜单里
  - **怕点错、怕扣费**：开屏摇一摇广告与连环弹窗防不胜防
  - **儿女不在身边**：电话里教半天“点右上角齿轮”，还是找不到
- **右栏 · 现有 Agent 三大死穴 (Agent Pitfalls)**：
  - **容易「吹牛交差」**：页面报错卡死，却张口谎报“已为您办妥”（幻觉）
  - **容易「擅自越权」**：全自动无刹车，误替老人下单、扣费、转账（资金失控）
  - **容易「死板僵化」**：死记固定屏幕坐标，App 一改版就点偏崩溃（脆弱）

---

## 05 · 定位颠覆 · 核心范式转移

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. Paradigm shift visual. Left card muted charcoal (Traditional app redesign). Right card quietly lit muted jade (Our adaptive agent). A slim directional transition marker in the middle. Ultra-clean typography and high negative space, matte editorial feel.
COLOR: matte green-charcoal ground #0C1211, the left card desaturated charcoal #171A19 with a dim #3A403E stroke, the right card muted jade #3E8F79 with deep jade #2C6B5B stroke and a very soft #9FD9C4 inner edge, warm off-white #EDE9E0 headline. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the muted left card is lit only by spill light coming off the right card — the argument is shown physically, not merely stated.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`方案总览 · 范式转移`
- **大标题**：**别人教老人适应手机，我们让智能体适应老人**
- **副标题**：同一部手机，两种完全不同的假设。
- **左卡 · 传统做法 (教老人找与点)**：
  - 每个 App 各改各的，大号字体仍藏在深层目录
  - App 每次更新改版，长辈学习成本全部清零
  - 改造停在“看得清”，没走到“事情办得成”
- **右卡 · 本方案 (智能体跨应用代办)**：
  - **不换手机**：长辈现有的普通安卓机即开即用
  - **不改 App**：第三方商业应用零改造、零适配成本
  - **零边际硬件成本**：无需专用手环或外置机械臂
  - **守住底线**：手脚替老人跑，最终决定权交还本人

---

## 06 · 产品形态 · 三端闭环

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. 3 sleek smartphone UI mockups floating in space with soft matte shadows: 1. Elder home screen with a large circular voice button. 2. Floating pill capsule overlayed on an e-commerce app. 3. Clean desktop web dashboard for family. A single slim filament of light connects them.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 for the voice button and the connecting filament, deep jade #2C6B5B for card strokes, warm off-white #EDE9E0 labels, #B9C2BB captions. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: one continuous filament of light enters the first panel as an oscillating sound wave, becomes a tapping cursor point inside the second, and leaves the third as a written line of ink — the task changes form as it crosses each end.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`方案总览 · 产品形态`
- **大标题**：**一条办事任务，平滑穿过三个端**
- **副标题**：老人端只管说话，悬浮胶囊随任务跳到第三方 App，亲友端仅在需要接力时出现。
- **三端形态**：
  - **① 老人端首页**：一屏一件事。状态行 + 一个大圆钮（绿待命/橙倾听） + 一行大字提示
  - **② 跨应用悬浮台**：跳转第三方 App 后仍陪伴在侧，显示“正在办第几步”，支持随时叫停
  - **③ 家人 Web 看板**：浏览器输入 6 位配对码直连，子女免装 App，大字语音温暖留话
- **架构底线**：
  > “云端只做两件事：大模型规划 + 语音转写；**执行调度、证据核验、物理风控 100% 在本地**。”

---

## 07 · 四大机制 · 核心总览

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. A clean 4-column Bento grid. Each column has a status pill (Verified / In-Progress / Planned), bold title, core problem answered, and a minimal diagram. Highly structured architectural breakdown on a matte deep green-charcoal background.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 for the first three columns, deep jade #2C6B5B for strokes, warm gold #C0A062 used only on the fourth column, warm off-white #EDE9E0 titles, #7E8C86 status pills. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the first three columns are solid while the fourth is drawn as an unlit dashed outline — its "拟研发" status is shown rather than merely labelled.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`四大机制 · 核心总览`
- **大标题**：**四个自研机制，各自回答一个大模型会出事的地方**
- **副标题**：真正的难关在这四个风险关口。
- **四栏矩阵**：
  1. **办成有证据**  
     - *回答*：它说“办好了”，凭什么信？  
     - *做法*：机械三道铁门 + 前后视觉比对，证据不足绝不谎报  
     - *状态*：`✅ 已实现真机闭环`
  2. **帮忙有分寸**  
     - *回答*：哪些它自己能做，哪些必须老人按？  
     - *做法*：绿/橙/红三级风控阶梯，支付密码硬性交还本人  
     - *状态*：`✅ 已实现真机闭环`
  3. **家人教一次**  
     - *回答*：App 界面改版，技能会不会立刻失效？  
     - *做法*：学办事套路，不锁死坐标，3 条出厂核心技能，动态重定位  
     - *状态*：`✅ 基础机制已落地`
  4. **越用越会办**  
     - *回答*：会不会越学越坏、把人带沟里？  
     - *做法*：三关严格回归才转正，异常随时一键安全回退  
     - *状态*：`🔷 拟研发进阶方向`

---

## 08 · 机制一 · 办成有证据

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. Abstract inspection gates diagram, matte not glowing. 3 slim vertical barrier gates (Gate R1, R2, R3) sweeping across a floating digital claim block. Thin scanning lines, quiet technical inspection concept, print-like.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 for the scanning light and gate edges, deep jade #2C6B5B for the claim block outline, sage #9FD9C4 at the moment of contact only, warm off-white #EDE9E0 labels. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the claim block carries a hairline crack that widens by a fraction each time one of the three gates sweeps over it — damage accumulating pass by pass.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`核心机制 ① · 任务证据核验`
- **大标题**：**没有证据的完成，就是谎报**
- **副标题**：模型极擅长输出一句“已为您办好”。我们要求拿出凭证；证据不足，宁可承认“我无法确认”。
- **三道机械铁门 (OutcomeCheck)**：
  - **`R1 · 文字真实来源`**：声明中引用的文字，当前轮次必须真正输入过，文本严格对得上
  - **`R2 · 时间因果锚点`**：声明引用的时间戳必须晚于任务启动时刻，严禁借用历史老痕迹
  - **`R3 · 改变类动作校验`**：断言改变外部世界的动作，必须产生真实的物理修改操作
- **最新算法优化高光**：
  > **正文与收件人解耦核验**：将收件人引用与真实正文拆分成独立规则，杜绝长联系人名干扰，防谎报的同时不误伤合法消息。

---

## 09 · 机制一 · 真实拦截实证

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. Forensic comparison card. Left card carries a faint brick-tinted scan grid over a half-erased statement. Right side shows a 3-row data card of intercepted real-device cases on WeChat, Alipay, and Pinduoduo. Authentic, rigorous audit feel, matte and restrained.
COLOR: matte green-charcoal ground #0C1211, brick #A8564C used only as a thin scan grid and one verdict mark, deep jade #2C6B5B for the right-hand card strokes, muted jade #3E8F79 for the action chips, warm off-white #EDE9E0 text. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the false statement is visibly half-erased and smudged, while the four real action chips are solid and pressed-in — like keys someone actually pressed.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`核心机制 ① · 拦截实证`
- **大标题**：**百分之百拦截「物理上不可能」的虚假声明**
- **副标题**：真实拦截真机运行中大模型的自夸幻觉，全部出自测试记录。
- **声明 vs 证据 对照实证**：
  - **模型输出的虚假结论**：`“已帮您把消息发出去了……发送时间是 17:37，发送成功。”`
  - **本轮真实记录的底层动作**：`open_app` $\rightarrow$ `wait` $\rightarrow$ `tap_xy` $\rightarrow$ `screenshot` (无输入)
  - **判定结果**：`🛑 证据链断裂，判定虚假完成，不予采信`
  - **系统如实告知老人**：`“我没法确认这件事真的办成了，接着办。”`
- **三起高危真机拦截数据**：
  - **微信转账申请**：识别资金敏感，6 步主动拒绝
  - **支付宝付款码**：命中目标级拒付词库，3 步 6 秒秒级拦截
  - **拼多多盲页面下单**：跳转第三方支付后，主动在第 14 步点击“取消支付并返回”

---

## 10 · 机制二 · 帮忙有分寸

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. 3-tier glass staircase on the left (three steps with clear labels). Right side displays a mobile phone screen with a 10%+5% dual-layer coordinate grid overlay and a highlighted hit target. Clean infographic aesthetic, matte and quiet.
COLOR: matte green-charcoal ground #0C1211, moss green #4E9E6A for the first step, ochre #B98A52 for the second, brick #A8564C for the third, muted jade #3E8F79 for the coordinate grid and crosshair, warm off-white #EDE9E0 labels. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the three steps read as one brake-light strip ending in a solid stop line, and in the grid the crosshair has already snapped onto the target with a very short dashed error vector — precision shown as a short gap.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`核心机制 ② · 分级自主执行`
- **大标题**：**替老人省手脚，绝不替老人做决定**
- **副标题**：分级判定只有一条铁律——这一步会不会不可逆地动到老人的钱袋子与社交关系。
- **三级风控阶梯**：
  - **🟢 绿级 · 直接代办**：查阅、翻页、跳转。美团外卖加购 10 步连贯交互，**全程 0 次打扰**
  - **🟠 橙级 · 谨慎确认**：盲页面坐标点按。单次任务仅温和确认一次，确认后顺畅执行
  - **🔴 红线 · 坚决停手**：付款、下单、发送、验证码。**交还本人**，大字朗读“多少钱、送哪、点哪”
- **底层量化支撑工程**：
  - **10% + 5% 双层坐标网格**：主刻度 10%，辅助刻度 5%，坐标参考密度翻倍
  - **`calibrate_coords` 真机量化校准**：以无障碍真实 bounds 为基准，量化点按误差（命中率 94.2%、p50 误差 12.4px）

---

## 11 · 机制三 · 家人教一次

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. Comparison between rigid pixel coordinates and semantic flow. Left card shows drifting broken crosshairs. Right card shows an abstract dashed semantic path adapting smoothly around an obstacle block. High contrast structure, conceptual illustration, matte editorial feel.
COLOR: matte green-charcoal ground #0C1211, the left card desaturated charcoal #171A19 with dim #3A403E strokes, the right card muted jade #3E8F79 with deep jade #2C6B5B stroke and soft #9FD9C4 node dots, warm off-white #EDE9E0 headings. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: on the left the crosshairs drift apart and fracture, while on the right the path bends smoothly around one small obstacle block standing in for a pop-up ad — the same problem, two outcomes.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`核心机制 ③ · 语义技能学习`
- **大标题**：**记住办事意图，忘掉屏幕坐标**
- **副标题**：传统自动化脚本死记 (x, y)，商业 App 弹个广告或按钮微调就立刻点偏。
- **左卡 · 死记硬编码坐标的脆弱性**：
  - 记的是“第 3 个按钮在 (620, 880)”
  - App 界面微调或节日弹窗，全部点偏点崩
  - 更换不同分辨率手机，脚本推倒重写
- **右卡 · 语义技能的动态自适应**：
  - 提炼业务套路：`进入个人中心` $\rightarrow$ `找到最新订单` $\rightarrow$ `点开在途包裹`
  - **里面一个坐标都没有**！复用时根据当前屏幕控件与图像动态重新定位吸附
  - 界面彻底重构无法识别时，果断退回求助真人
- **出厂精简 3 条核心高频技巧**：
  - `01 查表格 (reading_tables)` ｜ `02 盲页面 (blind_page)` ｜ `03 微信输入 (wechat_input)`

---

## 12 · 机制四 · 越用越会办

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. 5-step lifecycle flow with 3 gate icons on the path. Flow: Diagnosis -> Candidate -> 3 Verification Gates -> Safe Deployment. An emergency rollback branch leading back to the stable version. Modern vector workflow on a matte deep green-charcoal background.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 for the flow line and gates, deep jade #2C6B5B for node strokes, warm gold #C0A062 reserved solely for the rollback branch, warm off-white #EDE9E0 labels. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the fourth gate is drawn as a closed ring the flow must physically pass through, and the rollback branch is the only gold element on the page — the safety net is the one thing worth marking.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`核心机制 ④ · 技能自进化`
- **大标题**：**新技能连过三关才上线，退步随时一键回退**
- **副标题**：自进化不改代码、不动安全红线、不碰模型底层权重——它只让“常用办事套路”安全长大。
- **角标**：`[拟研发进阶方向]`
- **五步闭环流程**：
  `01 真实卡点` $\rightarrow$ `02 复盘归因` $\rightarrow$ `03 提炼候选` $\rightarrow$ `04 三关严格验证` $\rightarrow$ `05 安全按版本启用`
- **三道本地检验关卡**：
  1. **脱敏页面回放**：在历史脱敏快照上重跑，结果必须与记录一致
  2. **界面换版泛化**：在不同布局下测试，只认语义控件，不认死坐标
  3. **老任务防退化**：在常用历史任务上全量回归，**绝不许“修好一个、弄坏三个”**
- **安全回退机制**：
  > “任一关不过，或上线后监测到成功率下降与违规，**立刻毫秒级回退至上一稳定版本**。”

---

## 13 · 真机实测 · 13 类场景全矩阵

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. A clean, high-density benchmark results matrix table. 13 verified test rows with small checkmarks, step counts, duration in seconds, and slim bookmark edges marking standout tasks. Crisp professional benchmark table on a matte deep green-charcoal background.
COLOR: matte green-charcoal ground #0C1211, moss green #4E9E6A for checkmarks and numerals, deep jade #2C6B5B for row hairlines and table strokes, brick #A8564C for the two refusal rows, warm gold #C0A062 as a thin bookmark edge on three standout rows, warm off-white #EDE9E0 text. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the numeral 13 in the headline is composed of thirteen small blocks, and the three standout rows carry a slim gold bookmark edge on the left instead of a filled highlight.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`实测数据 · 真实场景`
- **大标题**：**13 类生活场景，真机上全量跑通**
- **副标题**：OnePlus 真机（Android 16）+ 真实商用主流 App 环境，逐条实测记录。
- **精选真机实测核心矩阵表**：

| 主流应用 | 真实代办任务 | 实测结果 | 步数 | 耗时 | 核心亮点与技术突破 |
|---|---|---|:---:|:---:|---|
| **喜鹊儿** | 查看某天课程表 | ✅ 成功 | 3 步 | 7 秒 | ★ 突破无障碍空白，纯靠视觉 7 秒穿透纯图课表 |
| **美团外卖** | 外卖点餐加入购物车 | ✅ 成功 | 10 步 | 28 秒 | ★ 复杂商品列表连续滑动，**全程 0 次多余打扰** |
| **美团外卖** | 进入最终结算页 | 🛑 交还 | 4 步 | 20 秒 | 临门一脚精准刹车，清晰语音播报金额与地址 |
| **12306** | 查询火车车次余票 | ✅ 成功 | 13 步 | 75 秒 | 跨日期、多车次复杂筛选，准确读出真实余票 |
| **拼多多** | 汇总查询在途快递 | ✅ 成功 | 6 步 | 18 秒 | 智能汇总 6 个包裹，播报在途件承运商与预计到达 |
| **微信** | 填写聊天消息 | ✅ 成功 | 7 步 | 16 秒 | 攻克无障碍盲区，通过候选栏输入，粘贴后清空剪贴板 |
| **微信** | 申请转账操作 | 🛑 主动拒绝 | 6 步 | 18 秒 | 识别涉及资金敏感，坚决判定无法代办 |
| **支付宝** | 唤起打开付款码 | 🛑 秒级拦截 | 3 步 | 6 秒 | 命中目标级防盗刷词库，秒级拦截拒绝 |
| **系统设置** | 深入系统调大字体 | ✅ 成功 | 6 步 | 20 秒 | 识别 AbsSeekBar 滑块，字体 1.0 调至 1.35 校验生效 |

---

## 14 · 工程硬核 · 系统落地填坑

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. 4 engineering challenge cards around a central metric spotlight. Technical callouts: 93% cache hit rate and a lossless WebP comparison chart. Matte dark software engineering presentation slide, print-like restraint.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 for the metric numerals and card accents, deep jade #2C6B5B for strokes, ochre #B98A52 on one card edge and brick #A8564C on one card edge only, warm off-white #EDE9E0 text. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: each problem card carries a small stitched patch notch in its top-right corner, and the 151KB block is drawn at almost exactly the same size as the 154KB one — the point is that it is smaller while looking equal.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`工程质量 · 落地填坑`
- **大标题**：**真正让系统落地的，是这些论文里不写的工程细节**
- **副标题**：从实验室“调通 Demo”到长辈“放心使用”，中间隔着的全是操作系统级的暗坑。
- **四大真机系统填坑**：
  1. **攻克系统缺失识别 API**：ColorOS 等定制系统自建轻量服务端听写代理；手机只录放音，Key 留服务端
  2. **化解 Android 11+ 包可见性**：在 `<queries>` 声明 `TTS_SERVICE`，治愈语音引擎被屏蔽的“哑巴”通病
  3. **剪贴板隐私随用随清**：输入法候选栏输入通道，在粘贴完成后立即调用 `clearPrimaryClip()` 彻底防泄露
  4. **滑块控件全兼容识别**：显式适配 `android.widget.AbsSeekBar`，避免少元素页面被误当成纯图页吞掉
- **两组核心量化工程突破**：
  - **原生分辨率无损 WebP 管线**：旧压缩 JPEG (154KB) 正确率仅 1/3；原生无损 WebP 仅 **151KB**，正确率 **3/3**
  - **会话断点续办前缀缓存**：恢复后第 1 步前缀缓存命中率 **93%**，第 2 步达 **96%**，秒级唤醒，极大压降老人等待延迟

---

## 15 · 质量验证体系 · 自动化护栏

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. Quality assurance dashboard. 3 large metric blocks: 74 JVM, 28 Pytest, 2 Core suites. A central card illustrating an adversarial test against a "Lying Mock Provider". Matte dark benchmark slide, quiet and precise.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 for the three large numerals, deep jade #2C6B5B for ring strokes, ochre #B98A52 only on the dashed disclosure strip, warm off-white #EDE9E0 text. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the three rings are drawn as return arrows rather than plain circles — these are regression loops, and the dashed disclosure strip is deliberately left unclosed at its right end.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`工程质量 · 回归测试`
- **大标题**：**全套自动化护栏，可回归可量化**
- **副标题**：执行主循环、多工具调度协议、死循环拦截与收尾语义，全部由严格的回归套件兜底。
- **三组核心测试守护数字**：
  - **`74 项`** JVM 核心行为回归校验（`harness/run.sh`，毫秒级脱机跑通）
  - **`28 项`** 服务端 pytest 自动化测试（鉴权隔离、心跳失联、配对码 TTL）
  - **`2 组`** Core 单元测试（协程取消安全性与证据规则单元覆盖）
- **核心实验亮点：对抗“会撒谎的 Mock 提供方”**：
  > “测试套件中专门部署了一个恶意制造幻觉的 Mock Provider。只要它敢输出假话，系统就会精确验证任务证据核验能否在循环中将其硬性截断并报警。”
- **六大科学评测指标**：
  - 任务完成率 ｜ 虚假完成率（谎报率） ｜ **危险操作漏拦率（必须为 0）** ｜ 误拦率 ｜ 每任务打扰次数 ｜ 端到端耗时

---

## 16 · 可信圈子 · 亲友协同与防电诈

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. 3 concentric guardian rings (Family, Community worker, Neighbour) protecting an elder at the centre. A soft frosted privacy mask over a document. A quiet security mark indicating NO REMOTE SCREEN CONTROL. Protective, high-trust theme, matte and calm, no fear imagery.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 for the innermost ring fading outward, deep jade #2C6B5B for the middle ring, brick #A8564C only on the third rule card and its broken line, warm off-white #EDE9E0 text. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: hair-thin sight-lines radiate from the elder at the centre toward each ring, but only the innermost is drawn solid — visibility itself is the diagram.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`安全边界 · 亲友协同`
- **大标题**：**困难有人接得住，但绝不把手机交到别人手里**
- **副标题**：家人免装 App，浏览器输配对码即可接力；每个人能看到什么，由角色身份严格决定。
- **同心三级守护圈**：
  - **家人（最内层）**：可查看完整办事上下文，协助认领卡点
  - **社区网格员（中层）**：仅看求助呼叫与失联报警，防范意外
  - **邻居（外层）**：仅在需要上门协助时收到提醒，保护长辈日常隐私
- **守护圈的三条铁律**：
  1. **看什么由身份决定**：身份证号、银行卡等隐私受磨砂隐私罩物理遮蔽，绝不全量外泄
  2. **只有家人能留话朗读**：老人手机朗读出的留言具有极高信任度，严格防范陌生人伪造假消息
  3. **坚决不做远程投屏代控 (核心防诈红线)**：远程投屏往往是当前电信诈骗与黑客钓鱼最常用的犯罪通道，系统从架构上彻底封死

---

## 17 · 诚实的边界 · 评审答辩预案

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 presentation slide. 4 honest boundary cards with dashed ochre outlines. A clean Q&A dialogue box on the right. Scientific rigor and academic integrity, matte editorial keynote layout.
COLOR: matte green-charcoal ground #0C1211, ochre #B98A52 for the dashed boundaries, deep jade #2C6B5B for the Q&A box strokes, muted jade #3E8F79 for small icon accents, warm off-white #EDE9E0 text. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: all four cards use dashed borders and every dash stops short at the top-right corner — nothing here is closed, on purpose.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`安全边界 · 答辩预案`
- **大标题**：**把做不到的说清楚，比把计划吹成已实现更能拿分**
- **副标题**：以下四条是我们主动交代的边界，也是答辩现场评委最赞赏的求真务实态度。
- **四项主动披露的系统边界**：
  - **任务证据核验**：已上线机械层一致性拦截；“动手了但页面没成功”的深度视觉比对仍在研发
  - **风控路径统一**：盲页面坐标点按路径的安全加固与统一风控仍在持续完善
  - **定位边界清晰**：聚焦手机日常办事辅助，**不是全天候医疗监护**；心跳反映设备活跃度，不等同于健康诊断
  - **技能自进化阶段**：已跑通“经验沉淀 + 家人审核启用”闭环；GUI 自动泛化回放为后续重点攻关方向
- **答辩现场高频 Q&A 预案**：
  - **Q：底层 LLM 和 ASR 是你们自己训练的吗？**  
    *A：不是。底层依托成熟基础设施；我们自研的核心在于：跨 App 执行状态机闭环、证据核验算法、分级风控机制与自进化体系。*
  - **Q：系统能 24 小时监护老人健康吗？**  
    *A：不能，绝不夸大宣传。系统核心是手机日常办事，设备心跳绝不能替代专业医疗设备。*

---

## 18 · 发展规划与收束 · 科技向善

### 【GPT Image 2.5 视觉生成 Prompt】
```text
16:9 closing presentation slide. Calm, warm and dignified. A muted gold horizon line low on the frame. Central bold gold slogan: "办成有证据，帮忙有分寸". 3 elegant milestone cards (Near-term, Mid-term, Long-term) sharing one rising baseline. Dignified tribute to bridging the digital divide for elders, matte editorial finish.
COLOR: matte green-charcoal ground #0C1211, muted jade #3E8F79 for the milestone card light, warm gold #C0A062 for the horizon line, the closing slogan and a single point of light, deep jade #2C6B5B for strokes, warm off-white #EDE9E0 text. Low saturation, matte, no bloom, no neon, no blue, no purple, no rainbow.
DETAIL: the three milestone panels share one rising baseline, and the gold horizon carries a single small point of light exactly where the line begins — the story starts again from that dot.
```

### 【画面必须渲染的文字 (On-Slide Text)】
- **顶栏微标**：`发展规划 · 答辩总结`
- **大标题**：**先在有证据的范围内把事办成，再让它在验证中越用越会办**
- **三阶段发展演进路线图**：
  - **近期 (扎实证据)**：前后关键截屏视觉差分核验；盲页坐标点按路径全量风控加固
  - **中期 (技能泛化)**：家人示范的自动意图提取与跨界面迁移；GUI 自动选版与防退化回归
  - **远期 (社区生态)**：从家庭走向智慧社区，在守住安全红线的前提下适配更多高频民生场景
- **终极结语金句 (Hero Closing)**：
  > **“办成有证据，帮忙有分寸。”**  
  > **替长辈省下的是手脚，最终的决定始终在他自己手里。**
- **答辩谢幕**：
  - `作品名称：银龄智办——可信自进化跨应用助老智能体`
  - `致谢：感谢各位专家评委的聆听！欢迎进入问辩交流环节`
