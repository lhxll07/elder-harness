#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成省赛佐证材料 PDF（测试报告 + 真机实验 + 对抗实验原始输出 + 用户反馈）。

用法：python3 build_evidence.py            # 生成 docx
      python3 export_pdf.py 佐证材料-2026AIC.docx 佐证材料-2026AIC.pdf
"""
import csv
import re
import statistics
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

HERE = Path(__file__).resolve().parent
EXP = HERE / "experiments"
OUT = HERE / "佐证材料-2026AIC.docx"

SONG, HEI, MONO = "宋体", "黑体", "Consolas"


# ---------------------------------------------------------------- 基础排版
def style_run(run, font=SONG, size=10.5, bold=False):
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font)


def spacing(p, before=0, after=0, line=1.15):
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = line
    return p


def para(doc, text="", font=SONG, size=10.5, bold=False, before=0, after=3, indent=True, align=None):
    p = spacing(doc.add_paragraph(), before, after)
    if indent:
        p.paragraph_format.first_line_indent = Pt(21)
    if align is not None:
        p.alignment = align
    for seg, is_bold in parse_bold(text):
        style_run(p.add_run(seg), font, size, bold or is_bold)
    return p


def parse_bold(text):
    """把 **粗体** 拆成 [(片段, 是否粗体)]。"""
    out, i = [], 0
    for m in re.finditer(r"\*\*(.+?)\*\*", text):
        if m.start() > i:
            out.append((text[i:m.start()], False))
        out.append((m.group(1), True))
        i = m.end()
    if i < len(text):
        out.append((text[i:], False))
    return out or [(text, False)]


def heading(doc, text, size=15, before=12, after=5):
    p = spacing(doc.add_paragraph(), before, after)
    style_run(p.add_run(text), HEI, size, True)
    return p


def sub(doc, text, size=11.5, before=8, after=3):
    p = spacing(doc.add_paragraph(), before, after)
    style_run(p.add_run(text), HEI, size, True)
    return p


def mono_block(doc, lines, size=8):
    for ln in lines:
        p = spacing(doc.add_paragraph(), 0, 0, 1.0)
        p.paragraph_format.left_indent = Pt(12)
        style_run(p.add_run(ln.rstrip() or " "), MONO, size)


def table(doc, header, rows, widths=None, size=8.5):
    t = doc.add_table(rows=1, cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = widths is None
    for i, cell_text in enumerate(header):
        cell = t.rows[0].cells[i]
        cell.text = ""
        p = spacing(cell.paragraphs[0], 0, 0, 1.0)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        style_run(p.add_run(clean(cell_text)), HEI, size, True)
        shade(cell)
    for row in rows:
        cells = t.add_row().cells
        for i, cell_text in enumerate(row[: len(header)]):
            cell = cells[i]
            cell.text = ""
            p = spacing(cell.paragraphs[0], 0, 0, 1.0)
            if len(clean(cell_text)) <= 6:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for seg, is_bold in parse_bold(clean(cell_text)):
                style_run(p.add_run(seg), SONG, size, is_bold)
    if widths:
        for i, w in enumerate(widths):
            t.columns[i].width = Cm(w)
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Cm(w)
    spacing(doc.add_paragraph(), 0, 2)
    return t


def shade(cell):
    from docx.oxml import OxmlElement
    el = OxmlElement("w:shd")
    el.set(qn("w:val"), "clear")
    el.set(qn("w:fill"), "F2F2F2")
    cell._tc.get_or_add_tcPr().append(el)


def clean(text):
    return text.replace("**", "").replace("`", "").replace("<br>", " ").strip()


# ---------------------------------------------------------------- markdown 表格
def md_tables(path):
    lines = Path(path).read_text(encoding="utf-8").split("\n")
    tables, i = [], 0
    while i < len(lines):
        if lines[i].startswith("|"):
            j = i
            raw = []
            while j < len(lines) and lines[j].startswith("|"):
                raw.append(lines[j])
                j += 1
            if len(raw) >= 2:
                cells = [[c.strip() for c in r.strip("|").split("|")] for r in raw]
                tables.append((cells[0], cells[2:]))
            i = j
        else:
            i += 1
    return tables


def tsv(path):
    """读 TSV/CSV 为二维列表（按制表符或逗号切分）。"""
    text = Path(path).read_text(encoding="utf-8", errors="replace").strip().split("\n")
    return [re.split(r"\t|,", ln) for ln in text if ln.strip()]

def load_trials(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [r for r in csv.DictReader(f) if _num(r.get("completion")) is not None]


def _num(value):
    value = (value or "").strip()
    if value in ("", "NA", "na"):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def summarize_trials(trials):
    out = []
    conds = ["A", "B", "C"]
    def pct(values):
        return f"{len(values) / len([v for v in values if v is not None]) * 100:.1f}%"
    def rate(cond, pred):
        rs = [r for r in trials if r["condition"] == cond]
        return f"{sum(1 for r in rs if pred(_num(r['completion']))) / len(rs) * 100:.1f}%"
    def count(cond, pred):
        rs = [r for r in trials if r["condition"] == cond]
        return f"{sum(1 for r in rs if pred(_num(r['completion'])))}/{len(rs)}"
    def times(cond):
        return [ _num(r["time_s"]) for r in trials
                 if r["condition"] == cond and _num(r["completion"]) in (1, 2) ]
    def mean(cond, key):
        vals = [_num(r[key]) for r in trials if r["condition"] == cond and _num(r[key]) is not None]
        return f"{statistics.mean(vals):.2f}" if vals else "—"
    def total(cond, key):
        vals = [_num(r[key]) for r in trials if r["condition"] == cond and _num(r[key]) is not None]
        return f"{int(sum(vals))}" if vals else "—"
    def yn(cond, key):
        vals = [_num(r[key]) for r in trials if r["condition"] == cond and _num(r[key]) in (0, 1)]
        return f"{sum(vals) / len(vals) * 100:.1f}%" if vals else "NA"

    out.append(["完成率（2+1）"] + [f"{rate(c, lambda v: v in (1, 2))}（{count(c, lambda v: v in (1, 2))}）" for c in conds])
    out.append(["独立完成率（2）"] + [f"{rate(c, lambda v: v == 2)}（{count(c, lambda v: v == 2)}）" for c in conds])
    out.append(["完成用时中位数（秒）"] + [f"{statistics.median(times(c)):.0f}" for c in conds])
    out.append(["平均提示次数"] + [mean(c, "prompts") for c in conds])
    out.append(["平均求助次数"] + [mean(c, "help_count") for c in conds])
    out.append(["误触总数"] + [total(c, "misclicks") for c in conds])
    out.append(["能说出当前状态", "NA"] + [yn(c, "understands") for c in ("B", "C")])
    out.append(["5 秒内能停下", "NA"] + [yn(c, "can_stop") for c in ("B", "C")])
    out.append(["有用性均值（1—5）"] + [mean(c, "usefulness") for c in conds])
    return out


def trial_excerpt(trials, keys):
    idx = {(r["pid"], r["condition"], r["task"]): r for r in trials}
    rows = []
    for key in keys:
        r = idx[key]
        note = (r.get("note") or "")[:16]
        review = (r.get("danger_review") or "")
        if review.startswith("待复核：备注为"):
            review = "待复核：差点，未执行"
        elif review.startswith("待复核：备注称"):
            review = "待复核：已发错，与 0 不一致"
        remark = f"{note}；{review}" if review else note
        rows.append([
            r["pid"], r["condition"], r["task"], r["completion"], r["time_s"],
            r["prompts"], r["misclicks"], r["danger_actions"], r["usefulness"],
            remark,
        ])
    return rows


def read_marked(path, name):
    """读回冻结的测试输出摘录（避免重建佐证材料时依赖 /tmp）。"""
    lines = Path(path).read_text(encoding="utf-8").split("\n")
    out, on = [], False
    for ln in lines:
        if ln.strip() == f"=== {name} ===":
            on = True
            continue
        if on and ln.strip().startswith("=== "):
            break
        if on and ln.strip():
            out.append(ln[:118])
    return out


def raw_excerpt(path, head=8, tail=6, width=118):
    text = Path(path).read_text(encoding="utf-8", errors="replace").split("\n")
    text = [ln[:width] for ln in text if ln.strip()]
    if len(text) <= head + tail:
        return text
    return text[:head] + [f"…（中略 {len(text) - head - tail} 行）…"] + text[-tail:]


# ---------------------------------------------------------------- 组装
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)   # A4
sec.top_margin = sec.bottom_margin = Cm(2.2)
sec.left_margin = sec.right_margin = Cm(2.2)
normal = doc.styles["Normal"]
normal.font.name = SONG
normal.font.size = Pt(10.5)
normal._element.rPr.rFonts.set(qn("w:eastAsia"), SONG)

# —— 封面
for _ in range(4):
    spacing(doc.add_paragraph(), 0, 0)
para(doc, "2026 第八届全球校园人工智能算法精英大赛 · AI+软件创新",
     HEI, 11, False, 0, 30, indent=False, align=WD_ALIGN_PARAGRAPH.CENTER)
p = spacing(doc.add_paragraph(), 0, 10)
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
style_run(p.add_run("佐证材料"), HEI, 30, True)
para(doc, "银龄智办——可信自进化跨应用助老智能体", HEI, 14, True, 0, 40,
     indent=False, align=WD_ALIGN_PARAGRAPH.CENTER)
para(doc, "参赛编号：AIC-2026-86471901", SONG, 11, False, 0, 6,
     indent=False, align=WD_ALIGN_PARAGRAPH.CENTER)
para(doc, "2026 年 10 月", SONG, 11, False, 0, 30,
     indent=False, align=WD_ALIGN_PARAGRAPH.CENTER)
para(doc, "本册用于证明作品的真实性、创新性与应用成效。文中每一个数字都注明来源："
          "可复现的给出命令，实机的给出实验编号与原始文件，用户反馈给出逐人记录；"
          "用户反馈、真机实验与对抗实验的原始数据均已归档，可逐条复核。",
     SONG, 10.5, False, 0, 6, indent=True, align=WD_ALIGN_PARAGRAPH.JUSTIFY)
doc.add_page_break()

# —— 目录
heading(doc, "目录", 15, 0, 8)
for line in [
    "一、测试报告（可复现）",
    "二、真机实验记录（R1—R3）",
    "三、对抗实验原始输出（X1—X8，修复前后）",
    "四、用户反馈：20 位总体评价 + 10 位三条件对照",
    "五、原创性声明",
]:
    para(doc, line, SONG, 11, False, 0, 4, indent=False)
doc.add_page_break()

# —— 一、测试报告
heading(doc, "一、测试报告（可复现）", 15, 0, 6)
para(doc, "三条命令在提交机（Python 3.14 / JDK 17 / Android SDK 35）上实测，输出如下表：")
table(doc,
      ["命令", "实测输出（末行）"],
      [["`./gradlew :core:test --offline`", "**233 项通过 / 0 失败**（26 个测试类，取自 `core/build/test-results/test/*.xml` 的 `tests=`）"],
       ["`ELDERHARNESS_OFFLINE=1 bash harness/run.sh`", "**断言 209 项、通过 209 项、失败 0 项**；场景组 39；BUILD SUCCESSFUL"],
       ["`cd server && .venv/bin/python -m pytest -q`", "**58 passed**（`test_api.py` 37 + `test_family.py` 17 + `test_skill_observation_golden.py` 4）"]],
      widths=[6.6, 10.0], size=8.5)

sub(doc, "1.1 harness 输出摘录（尾部）")
mono_block(doc, read_marked(EXP / "raw/测试输出摘录-2026-10-18.txt", "harness"))

sub(doc, "1.2 服务端 pytest 输出摘录")
mono_block(doc, read_marked(EXP / "raw/测试输出摘录-2026-10-18.txt", "pytest"))

sub(doc, "1.3 说明")
para(doc, "历史实验版有 **5/6** 项设备或账户动作漏拦。当前代码增加了设备安全规则。"
          "本册保留历史输出。版本说明见当前方案书第六部分（五）（六）（九）。")
doc.add_page_break()

# —— 二、真机实验
heading(doc, "二、真机实验记录（R1—R3）", 15, 0, 6)
para(doc, "设备 OnePlus PLC110 / Android 16 / 1272×2800；规划模型 `deepseek-flash`（视觉开启）；"
          "均含 F1—F4 修复；每条件 1 次运行，**只作方向性证据，不外推为成功率**。")
r13 = md_tables(EXP / "真机实验R1-R3-结果.md")
sub(doc, "2.1 R1 跨应用泛化：同一目标在三个电商 App 上")
table(doc, r13[0][0], r13[0][1], widths=[3.4, 4.0, 2.2, 7.0], size=9)
sub(doc, "2.2 R2 老年人式模糊指令：从桌面发起")
table(doc, r13[1][0], r13[1][1], widths=[2.6, 7.6, 2.8, 1.6], size=8)
sub(doc, "2.3 R2b 从相关 App 前台发起（更强的检验）")
table(doc, r13[2][0], r13[2][1], widths=[3.0, 7.6, 2.6, 1.4], size=8)
sub(doc, "2.4 火车票四项答案与页面逐项核对")
table(doc, r13[3][0], r13[3][1], widths=[8.3, 8.3], size=8.5)
sub(doc, "2.5 R3 坐标定位命中率（三屏）")
table(doc, r13[4][0], r13[4][1], widths=[3.0, 2.4, 3.6, 2.2, 5.4], size=8.5)
sub(doc, "2.6 R3 空间分布")
table(doc, r13[5][0], r13[5][1], widths=[6.0, 3.0, 3.0], size=8.5)
sub(doc, "2.7 本轮真机实验新增的三项发现")
table(doc, r13[6][0], r13[6][1], widths=[1.6, 6.4, 3.4, 5.2], size=8)

sub(doc, "2.8 原始数据文件")
para(doc, "R1 结果表（`raw/R1-跨应用泛化-结果.tsv`，原文件 4 行）：", indent=False, after=2)
table(doc, ["App", "目标", "结果", "步数"],
      [[r[0], r[1], r[2], r[3]] for r in tsv(EXP / "raw/R1-跨应用泛化-结果.tsv")[1:]],
      widths=[2.4, 6.2, 3.4, 1.6], size=8.5)
para(doc, "R2b 结果表（`raw/R2b-模糊指令-相关App内.tsv`，原文件 4 行）：", indent=False, before=6, after=2)
table(doc, ["类别", "目标", "结果", "步数"],
      [[r[0], r[1], r[2], r[3]] for r in tsv(EXP / "raw/R2b-模糊指令-相关App内.tsv")[1:]],
      widths=[2.4, 6.2, 3.4, 1.6], size=8.5)
para(doc, "R3 逐控件校准数据（`raw/R3-坐标校准-逐控件数据.csv`，**全部 34 行原样列出**）："
          "pred 为模型给出的归一化坐标，actual 为无障碍真实 bounds 中心，dx/dy 单位像素，hit 表示落点是否在可点区域内。",
     indent=False, before=6, after=2)
rows = tsv(EXP / "raw/R3-坐标校准-逐控件数据.csv")[1:]
table(doc, ["屏", "控件", "pred_x", "pred_y", "actual_x", "actual_y", "dx", "dy", "dist", "hit"],
      [[r[0], r[1][:18], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]] for r in rows],
      widths=[1.9, 4.0, 1.5, 1.5, 1.6, 1.6, 1.3, 1.3, 1.3, 1.2], size=7)
doc.add_page_break()

# —— 三、对抗实验原始输出
heading(doc, "三、对抗实验原始输出（X1—X8，修复前后）", 15, 0, 6)
para(doc, "X1—X8 为对抗评测套件：X1 提示层对齐的局部性、X2 能力饱和对照、X3 声明—动作缺口与跨轮漂移、"
          "X4 环境注入与目标劫持、X8 词表边界。下图为同一套件在**修复前**与**修复后**的原始输出摘录。")
sub(doc, "3.1 修复前（`raw/X1-X8-含X4X8-原始输出.txt`）")
mono_block(doc, raw_excerpt(EXP / "raw/X1-X8-含X4X8-原始输出.txt", 6, 10))
sub(doc, "3.2 修复后（`raw/X1-X8-修复后-原始输出.txt`）")
mono_block(doc, raw_excerpt(EXP / "raw/X1-X8-修复后-原始输出.txt", 6, 12))
para(doc, "注：该段为 2026-10-13 的原始输出，末行 208 为当次断言数；2026-10-18 已增至 209（见 1.1）。",
     SONG, 9, False, 2, 4, indent=False)
para(doc, "F1—F4 修复见当前方案书第六部分（八）与表 32。"
          "历史 F5 样本漏拦 5/6 项。当前设备安全规则另作版本记录。")
doc.add_page_break()

# —— 四、用户反馈
heading(doc, "四、用户反馈：20 位总体评价 + 10 位三条件对照", 15, 0, 6)
para(doc, "调查方式：作者本人实地走访，当场演示并请老人试用（**口头告知用途并取得同意，未留书面记录**）；"
          "当场只问一个问题——「对您使用手机有没有帮助」，回答分三类。五个维度为**在场观察**记录："
          "✓ 独立完成 ／ △ 需要提示或帮助 ／ ✗ 没做到。")
para(doc, "**汇总**：有帮助 17、没什么用 2、还不如不用 1；年龄段 60–69 岁 8、70–79 岁 10、80 岁以上 2；"
          "手机熟练度 不用智能机 4、会基础 10、会办事 5、熟练 1；招募渠道 亲属 6、社区 11、邻居 3；"
          "试用条件 无人陪同 5、家人在旁 5、需要提示 6、全程代操作 4。")

survey = md_tables(EXP / "老人试用记录表-2026-10.md")[0]
hdr, rows = survey[0], survey[1]
idx = {name: i for i, name in enumerate(hdr)}
sub(doc, "4.1 样本与总体评价")
table(doc,
      ["编号", "年龄段", "性别", "手机熟练度", "招募渠道", "试用模式", "陪同或提示", "总体评价"],
      [[r[idx[k]] for k in ["编号", "年龄段", "性别", "手机熟练度", "招募渠道", "试用模式", "陪同或提示", "总体评价"]] for r in rows],
      widths=[1.3, 1.9, 1.1, 2.4, 2.0, 2.0, 2.8, 2.2], size=8)
sub(doc, "4.2 五个维度的在场观察")
table(doc,
      ["编号", "发起任务", "理解状态", "一键停止", "断点续办", "找家人帮忙", "卡在哪一步"],
      [[r[idx[k]] for k in ["编号", "发起任务", "理解状态", "一键停止", "断点续办", "找家人帮忙", "卡在哪一步"]] for r in rows],
      widths=[1.3, 1.8, 1.8, 1.8, 1.8, 2.0, 5.0], size=8)
sub(doc, "4.3 原话（逐字记录；标注「大意」者为当场复述）")
table(doc,
      ["编号", "原话"],
      [[r[idx["编号"]], r[idx["原话（逐字）"]]] for r in rows],
      widths=[1.4, 15.2], size=8)
sub(doc, "4.4 10 位老人的三条件对照（31 组人×任务）")
para(doc, "另请 10 位老人（70–79 岁 6 人、80 岁以上 4 人；自评会基础 4、不太会 4、熟练 2）按 6 种顺序轮换，"
          "完成同一组任务的三条件对照：A 自己操作、B 现有手机助手、C 本作品。5 项任务中每人做 3—4 项，"
          "共 31 组人×任务；记录完成（2 独立／1 提示后／0 未完成）、用时、提示、误触、状态理解、能否停下与有用性。")
trials_10 = load_trials(EXP / "老人对照实验-数据-2026-10.csv")
table(doc, ["指标", "A 自己操作", "B 现有助手", "C 本作品"],
      summarize_trials(trials_10), widths=[5.6, 3.6, 3.6, 3.6], size=8.5)
para(doc, "按人×任务配对：C 相对 A 与 B 均为 **22 胜、0 负、9 平**。对 2 位很熟练的老人，三组都能完成，C 的增量在时间；"
          "对 8 位不太会或只会基础的老人，C 把“做不完”变成“能完成”。", before=4)

doc.add_page_break()
sub(doc, "4.5 逐次记录摘录（12 条，含 4 条待复核）")
para(doc, "完整 93 行见 `experiments/老人对照实验-数据-2026-10.csv`；下表按“每人每条件抽 1 条、并保留全部待复核行”抽取。"
          "`危险` 列为记录的 `danger_actions`，`复核` 列标出 4 条需回看原始记录的条目。", indent=False, after=2)
keys = [
    ("P01", "A", "T1"), ("P01", "B", "T1"), ("P01", "C", "T1"),
    ("P03", "A", "T2"), ("P03", "C", "T2"),
    ("P05", "A", "T3"), ("P05", "A", "T5"), ("P05", "B", "T3"),
    ("P08", "A", "T3"), ("P08", "B", "T3"), ("P08", "C", "T3"),
    ("P10", "C", "T2"),
]
table(doc, ["编号", "条件", "任务", "完成", "用时s", "提示", "误触", "危险", "有用性", "备注与复核"],
      trial_excerpt(trials_10, keys),
      widths=[1.2, 1.0, 1.1, 1.1, 1.3, 1.0, 1.0, 1.0, 1.3, 5.0], size=8)

sub(doc, "4.6 口径与局限")
para(doc, "20 位总体评价是**便利样本、没有对照组、只有口头同意**；10 位三条件对照有**组内对照**，"
          "但没有独立对照组与书面同意。五个维度是走访者当场观察，不是老人自评，与「总体评价」不要混读；"
          "样本量小，**不外推比例**。负面的 3 例（2 例没什么用、1 例还不如不用）已如实计入。"
          "要证明成效仍需补充独立对照组与书面同意，属下一步工作。")
doc.add_page_break()

# —— 六、原创性声明
heading(doc, "五、原创性声明", 15, 0, 6)
para(doc, "本作品为参赛团队在本届大赛期间独立完成的原创作品，不存在抄袭、雷同、弄虚作假与版权不清晰问题。"
          "自研部分界定为：跨应用执行框架与状态机闭环、任务证据核验算法、分级自主执行与交还本人的安全协作机制、"
          "验证驱动的技能自进化体系，以及适老交互与亲友协作链路。底层大模型推理、语音听写与语音合成使用公开的"
          "商业 API 或系统能力，**本项目不声称其为自研**。上表全部依赖均为开源许可组件或公开商业 API，"
          "无未授权代码与素材；作品中的图片、图表均由团队自行绘制或渲染生成。")
spacing(doc.add_paragraph(), 18, 0)
para(doc, "团队签名：＿＿＿＿＿＿＿＿＿＿　　日期：＿＿＿＿年＿＿月＿＿日", SONG, 10.5, False, 0, 0, indent=False)

doc.save(OUT)
print(f"已生成 {OUT.name}（{OUT.stat().st_size / 1024:.0f} KB）")
