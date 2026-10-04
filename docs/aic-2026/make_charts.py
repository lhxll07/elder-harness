# -*- coding: utf-8 -*-
"""把报告里的实测数据画成图。数值全部取自《作品方案-定稿.md》，不新造数据。"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import rcParams

rcParams["font.sans-serif"] = ["Noto Sans CJK SC"]
rcParams["axes.unicode_minus"] = False
rcParams["figure.dpi"] = 200
rcParams["savefig.bbox"] = "tight"
rcParams["axes.edgecolor"] = "#8a8a8a"
rcParams["axes.linewidth"] = 0.8
C = {"mine": "#0f7b6c", "old": "#b0b0b0", "warn": "#c0392b", "mid": "#4a90a4"}

def style(ax, ymax=None):
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", ls=":", lw=0.6, alpha=0.5)
    ax.set_axisbelow(True)
    if ymax: ax.set_ylim(0, ymax)

# ── 图 A：R3 定位命中率（真机，七（三））──────────────────────────
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 3.6))
screens = ["系统设置\n(13 样本)", "显示与亮度\n(12 样本)", "拼多多首页\n(9 样本)"]
hit = [77, 83, 44]
bars = a1.bar(screens, hit, color=[C["mine"], C["mine"], C["warn"]], width=0.62)
for b, v in zip(bars, hit):
    a1.text(b.get_x()+b.get_width()/2, v+2, f"{v}%", ha="center", fontsize=11, fontweight="bold")
a1.set_title("命中率：第三方推广页近乎腰斩", fontsize=11.5, pad=8)
a1.set_ylabel("视觉定位命中率（%）"); style(a1, 100)
a1.axhline(83, ls="--", lw=0.9, color=C["old"]); a1.text(2.42, 84, "设置类基线", fontsize=8, color="#666")

zones = ["上段\ny<0.33", "中段\n0.33–0.67", "下段\ny>0.67"]
zh = [62, 90, 62]
bars = a2.bar(zones, zh, color=[C["mid"], C["mine"], C["mid"]], width=0.62)
for b, v in zip(bars, zh):
    a2.text(b.get_x()+b.get_width()/2, v+2, f"{v}%", ha="center", fontsize=11, fontweight="bold")
a2.set_title("空间分布：中段明显优于上下边缘", fontsize=11.5, pad=8)
a2.set_ylabel("命中率（%）"); style(a2, 100)
fig.suptitle("每屏单次、合计 34 样本，仅作方向性证据", fontsize=9.5, color="#666", y=1.05)
fig.savefig("figures/chart-r3.png"); plt.close(fig)

# ── 图 B：执行约束三组对照（六（七））────────────────────────────
fig, (b1, b2) = plt.subplots(1, 2, figsize=(11, 3.7))
groups = ["逐步确认", "固定词表\n（修复前）", "分级执行\n（本作品）"]
executed = [0, 14, 5]      # 由智能体执行的危险动作数（20 项样本，越低越安全；分级执行拦住 15/20 → 执行 5）
asks = [10, 1, 1]          # 一次 10 步任务的确认次数（越低越不打扰）
cols = [C["old"], C["old"], C["mine"]]
bars = b1.bar(groups, executed, color=cols, width=0.6)
for b, v in zip(bars, executed):
    b1.text(b.get_x()+b.get_width()/2, v+0.4, str(v), ha="center", fontsize=11, fontweight="bold")
b1.set_title("安全性：由智能体执行的危险动作数（共 20 项，越低越好）", fontsize=10.5, pad=8)
b1.set_ylabel("项"); style(b1, 22)
bars = b2.bar(groups, asks, color=cols, width=0.6)
for b, v in zip(bars, asks):
    b2.text(b.get_x()+b.get_width()/2, v+0.25, str(v), ha="center", fontsize=11, fontweight="bold")
b2.set_title("少打扰：一次 10 步任务的确认次数（越低越好）", fontsize=10.5, pad=8)
b2.set_ylabel("次"); style(b2, 12)
fig.suptitle("分级执行（绿柱）同时占住两项指标的低位：危险动作执行得少、打扰也少", fontsize=10, color="#444", y=1.05)
fig.savefig("figures/chart-constraint.png"); plt.close(fig)

# ── 图 C：隐蔽型危险动作的修复前后（六（六））────────────────────
fig, ax = plt.subplots(figsize=(9.5, 3.4))
cats = ["显性危险动作\n（词表设计目标内）", "隐蔽型危险动作\n（后果同样不可逆）", "边界探针\n（路线级上限）"]
before = [6, 0, 0]; after = [6, 8, 1]; totals = [6, 8, 6]
x = range(len(cats)); w = 0.34
b1 = ax.bar([i-w/2 for i in x], before, w, label="修复前拦住", color=C["old"])
b2 = ax.bar([i+w/2 for i in x], after, w, label="修复后拦住", color=C["mine"])
for i, (bf, af, tt) in enumerate(zip(before, after, totals)):
    ax.text(i-w/2, bf+0.18, f"{bf}/{tt}", ha="center", fontsize=9.5)
    ax.text(i+w/2, af+0.18, f"{af}/{tt}", ha="center", fontsize=9.5, fontweight="bold")
ax.axhline(0, color="#ccc", lw=0.8)
ax.set_xticks(list(x)); ax.set_xticklabels(cats, fontsize=9.5)
ax.set_ylabel("被拦住的动作数"); ax.set_ylim(0, 9.6)
ax.legend(frameon=False, fontsize=9.5, loc="upper left")
style(ax)
ax.set_title("隐蔽型由 0/8 提升至 8/8；边界探针由 6/6 漏拦改善为 5/6（如实保留）", fontsize=10.5, pad=10)
fig.savefig("figures/chart-x8.png"); plt.close(fig)

# ── 图 D：只追加策略下的缓存命中（三（三）5 / 附录（三））──────────
fig, ax = plt.subplots(figsize=(9.5, 3.3))
steps = ["首轮", "第 2 步", "第 3 步", "中断前\n第 5 步", "恢复后\n第 1 步", "恢复后\n第 2 步"]
rate = [0, 89, 67, 73, 93, 96]
ax.plot(steps, rate, marker="o", color=C["mine"], lw=2, ms=6)
for i, v in enumerate(rate):
    ax.annotate(f"{v}%", (i, v), textcoords="offset points", xytext=(0, 9),
                ha="center", fontsize=9.5, fontweight="bold")
ax.axvspan(3.5, 5.5, color=C["mine"], alpha=0.07)
ax.text(4.5, 30, "从存档恢复后", ha="center", fontsize=9, color="#555")
ax.set_ylabel("前缀缓存命中率（%）"); ax.set_ylim(-5, 110)
style(ax, 110)
ax.set_title("只追加对话记录带来的前缀缓存命中（同一任务，deepseek-chat）", fontsize=10.5, pad=10)
fig.savefig("figures/chart-cache.png"); plt.close(fig)
print("已生成 chart-r3 / chart-constraint / chart-x8 / chart-cache")

# ── 图 D：完成核验的分层收益与代价（六（八），由 harness/run.sh 实跑）──────
fig, (d1, d2) = plt.subplots(1, 2, figsize=(11, 3.6))
groups = ["无核验\n（采信模型自述）", "机械核验", "机械 + 文本证据核验\n（本作品）"]
blocked = [0, 12, 22]      # 阻止错误结论直接完成（共 22 项）
cost = [0, 0, 1]           # 把真办成的判为“待核对”（共 10 项）
cols = [C["old"], C["mid"], C["mine"]]
bars = d1.bar(groups, blocked, color=cols, width=0.6)
for b, v in zip(bars, blocked):
    d1.text(b.get_x()+b.get_width()/2, v+0.5, f"{v}/22", ha="center", fontsize=11, fontweight="bold")
d1.set_title("识别：阻止错误结论直接完成（共 22 项，越高越好）", fontsize=10.5, pad=8)
d1.set_ylabel("项"); style(d1, 26)
bars = d2.bar(groups, cost, color=cols, width=0.6)
for b, v in zip(bars, cost):
    d2.text(b.get_x()+b.get_width()/2, v+0.08, f"{v}/10", ha="center", fontsize=11, fontweight="bold")
d2.set_title("代价：把真办成的判为“待核对”（共 10 项，越低越好）", fontsize=10.5, pad=8)
d2.set_ylabel("项"); style(d2, 3)
fig.suptitle("文本证据层把机械核验够不着的那一类补上（12/22 → 22/22），代价如实计入 1/10",
             fontsize=10, color="#444", y=1.05)
fig.savefig("figures/chart-verify.png"); plt.close(fig)
print("chart-verify.png")
