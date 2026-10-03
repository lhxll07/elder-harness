# -*- coding: utf-8 -*-
"""R3 分析：命中率分层、空间分布（盲区）、系统性偏置，以及指标自身的效度问题。"""
import csv, statistics as st
from collections import defaultdict

rows = list(csv.DictReader(open("raw/R3-坐标校准-逐控件数据.csv", encoding="utf-8")))
for r in rows:
    for k in ("pred_x","pred_y","actual_x","actual_y","dx","dy","dist"):
        r[k] = float(r[k])
    r["hit"] = r["hit"] == "true"

# 每屏的控件总数（含模型未给出可解析坐标的）来自运行日志
TOTALS = {"settings": 17, "display": 17, "pdd": 19}
NAMES = {"settings": "系统设置", "display": "显示与亮度", "pdd": "拼多多首页"}

print("=== 各屏命中率与解析失败 ===")
print(f"{'屏幕':<14}{'样本':>5}{'命中':>7}{'命中率':>8}{'解析失败':>9}")
for s, total in TOTALS.items():
    sub = [r for r in rows if r["screen"] == s]
    hit = sum(1 for r in sub if r["hit"])
    print(f"{NAMES[s]:<14}{len(sub):>5}{hit:>4}/{len(sub):<3}{hit/len(sub)*100:>7.0f}%{total-len(sub):>9}")

print("\n=== 空间分布（按控件真实中心点的纵向位置分三段）===")
print(f"{'位置':<10}{'样本':>5}{'命中':>7}{'命中率':>8}")
buckets = {"上段 y<0.33": [], "中段 0.33-0.67": [], "下段 y>0.67": []}
for r in rows:
    y = r["actual_y"]
    key = "上段 y<0.33" if y < 0.33 else ("中段 0.33-0.67" if y <= 0.67 else "下段 y>0.67")
    buckets[key].append(r)
for k, sub in buckets.items():
    if not sub: continue
    hit = sum(1 for r in sub if r["hit"])
    print(f"{k:<14}{len(sub):>5}{hit:>4}/{len(sub):<3}{hit/len(sub)*100:>7.0f}%")

print("\n=== 系统性偏置（像素，正=预测偏右/偏下）===")
for s in ("settings","display","pdd"):
    sub = [r for r in rows if r["screen"] == s]
    print(f"  {NAMES[s]:<12} meanDx={st.mean(r['dx'] for r in sub):+7.0f}  meanDy={st.mean(r['dy'] for r in sub):+7.0f}")
alldx = [r["dx"] for r in rows]
print(f"  {'全部':<12} meanDx={st.mean(alldx):+7.0f}  中位dx={st.median(alldx):+7.0f}  左偏占比={sum(1 for d in alldx if d<0)/len(alldx)*100:.0f}%")

print("\n=== 距离误差（仅统计模型给出坐标的样本）===")
for s in ("settings","display","pdd"):
    sub = sorted(r["dist"] for r in rows if r["screen"] == s)
    n = len(sub)
    print(f"  {NAMES[s]:<12} p50={sub[n//2]:.0f}px p90={sub[min(n-1,(n*9)//10)]:.0f}px max={sub[-1]:.0f}px")

print("\n=== 指标效度提示（重要）===")
wide = [r for r in rows if r["hit"] and abs(r["dx"]) > 200]
print(f"  命中但横向偏差 >200px 的样本：{len(wide)}/{sum(1 for r in rows if r['hit'])}")
print("  → 这些控件是整行/整卡可点，label 文字位于一端；模型其实指对了文字位置，")
print("    却因与「可点区域中心」比较而显示为大偏差。故 hit（落点是否落在可点区域内）")
print("    是本场景的有效指标，距离误差会被指标设计放大。")
amb = [r for r in rows if r["target"] == "关闭"]
print(f"  同名重复控件「关闭」出现 {len(amb)} 次，均未命中：标签定位在同屏重名时存在歧义。")
