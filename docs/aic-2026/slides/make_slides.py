#!/usr/bin/env python3
"""生成答辩演示 HTML。改内容只改本文件，然后跑 ./build_slides_pdf.sh 导 PDF。"""
import pathlib

def page(title, num, body, cls=""):
    hd = (f'<div class="hd"><img src="assets/aic-logo-header.png">'
          f'<span class="t">{title}</span><span class="n">能工智人 · AIC-2026-86471901</span></div>\n') if title else ""
    ft = (f'<div class="ft"><span>银龄智办 · 可信自进化跨应用助老智能体</span>'
          f'<span class="r">{num}</span></div>\n') if num else ""
    return f'<section class="slide {cls}">\n{hd}<div class="body">{body}</div>\n{ft}</section>\n'

def divider(no, title, lead, num):
    return (f'<section class="slide dark divider"><div class="no">{no}</div><h1>{title}</h1>'
            f'<div class="lead">{lead}</div>'
            f'<div class="ft"><span>银龄智办 · 可信自进化跨应用助老智能体</span>'
            f'<span class="r">{num}</span></div></section>\n')

B = []

# ── 封面 ──
B.append('''<section class="slide dark cover2">
  <div>
    <span class="kicker">2026 AIC · 算法创新赛 · AI+软件创新</span>
    <h1>银龄智办</h1>
    <div class="rule"></div>
    <h2 style="font-size:22px;font-weight:600;color:rgba(255,255,255,.88);line-height:1.5">可信自进化跨应用助老智能体</h2>
    <div class="meta" style="margin-top:26px">
      2026 第八届全球校园人工智能算法精英大赛<br>
      团队 <b>能工智人</b>　｜　参赛编号 <b>AIC-2026-86471901</b>
    </div>
  </div>
  <div class="phones">
    <div class="phone"><img src="figures/shot-home.png"><div class="cap">老人端首页</div></div>
    <div class="phone" style="margin-top:54px"><img src="figures/shot-result-card.png"><div class="cap">任务结论卡</div></div>
  </div>
</section>\n''')

B.append(divider("01", "问题", "老年人“能上网，却办不成事”。<br>通用手机智能体又有<b>谎报、越权、僵化</b>三大硬伤。", 2))

B.append(page("老年人“能上网，却办不成事”", 3, '''
<div class="two">
  <div style="display:flex;flex-direction:column;gap:16px;justify-content:center">
    <div class="card"><div class="k">政策与界面改造已经到位</div>
      <div class="v">适老化专项行动、无障碍环境建设法、大字号与简化界面——<b>但跨应用、多步骤、不可逆的事，老人仍然办不成</b>。</div></div>
    <div class="card w"><div class="k">真正的缺口不是界面，是“把事办完”</div>
      <div class="v">出行购票、快递取件、生活缴费、就医挂号——事务分散在多个 App 里，单应用适老化解决不了。</div></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;justify-content:center">
    <h2 style="font-size:23px">通用手机智能体的三大硬伤</h2>
    <div class="card r"><div class="k">谎报</div><div class="v">说“已发送、已下单”，其实根本没做成</div></div>
    <div class="card r"><div class="k">越权</div><div class="v">替老人点了付款、动了钱</div></div>
    <div class="card r"><div class="k">僵化</div><div class="v">卡住就停，或原地空转到步数上限</div></div>
  </div>
</div>
<div class="quote" style="border:none;background:var(--teal);color:#fff;font-size:21px;text-align:center">
  缺的不是更聪明的模型，而是<b style="color:#fff">让架构保证可信</b>。</div>'''))

B.append(divider("02", "方案", "把“可信”从<b>提示词约束</b>下沉为<b>架构约束</b>——<br>三条可检查的设计决定，四项机制。", 4))

B.append(page("主张：可信由架构保证，而非模型的顺从", 5, '''
<div class="cards g3" style="flex:1;align-content:center">
  <div class="card"><div class="k">① 风控闸门只读动作内容</div>
    <div class="v">闸门看的是目标控件标签、要写入的正文、页面是否敏感——<b>不看模型说了什么，也不看它是否被说服</b>。</div></div>
  <div class="card"><div class="k">② 完成与否由执行记录判定</div>
    <div class="v">“是否办成”由本地代码扫描<b>本轮自己的调用日志</b>得出；不由模型自述，也不交给第二个模型打分。</div></div>
  <div class="card"><div class="k">③ 无障碍树只作只读观察</div>
    <div class="v">树只用来“看”，所有动作仍须经本地闸门；<b>来源再“可信”，也不因此放行</b>。</div></div>
</div>
<div class="quote" style="text-align:center;border:none;background:var(--teal);color:#fff;font-size:22px">
  这三条是<b style="color:#fff">可检查的设计决定</b>，不是形容词。</div>'''))

B.append(page("机制① 一个判据，三层复用", 6, '''
<div class="sub" style="margin-bottom:6px">判据只有一个：<b>动作的后果是否可逆</b>。它被复用在三层，且每次扩展都由对抗实验的发现驱动。</div>
<div class="flow" style="flex:1;justify-content:center">
  <div class="core">判据：动作后果是否可逆</div>
  <div class="stem"></div>
  <div class="rail">
    <div class="layer"><div class="lt">屏幕动作层</div>
      <div class="lv">有文字的动作直接执行；<b>坐标点按</b>无法校验内容，降级为单次确认；命中本人操作词表则交还本人。</div></div>
    <div class="layer"><div class="lt">业务动作层</div>
      <div class="lv">「删除」「恢复出厂设置」「解绑」等不可逆业务动作<b>并入同一不可逆族</b>，交还本人。</div>
      <div class="src">由实验发现 F4 驱动</div></div>
    <div class="layer"><div class="lt">导航动作层</div>
      <div class="lv">越出任务应用集合的 <span class="mono">open_app</span>，该应用<b>首次确认一次</b>——粒度为“每个新应用一次”，不是每任务一次。</div>
      <div class="src">由实验发现 F3 驱动</div></div>
  </div>
</div>
<div class="cards g2" style="flex:0 0 auto">
  <div class="card"><div class="k">效果</div><div class="v">美团 10 步点餐任务<b>全程打扰 0 次</b>，结算一步交还老人。</div></div>
  <div class="card"><div class="k">与现有做法的差别</div><div class="v">不是按敏感词或金额阈值拦截，也不是全流程逐步确认。</div></div>
</div>'''))

B.append(page("机制② 不采信“说办成了”", 7, '''
<div class="quote">“已帮您把消息发出去了……时间是 17:37，发送成功”
  <span class="src">—— 真机实测中的真实事故：它只是读到了<b>本轮开始前就存在</b>的旧消息，把别人的成果算成了自己的。</span></div>
<div class="two">
  <div>
    <h2 style="font-size:20px;margin-bottom:10px">判定规则（只用本轮执行记录）</h2>
    <ol>
      <li><b>R0 触发</b>　声明出现“对外部世界产生改变”的说法才检查；泛指完成不检查，避免误伤只读任务</li>
      <li><b>R1 文字来源</b>　声明引用的文字必须出现在本轮成功输入的内容里</li>
      <li><b>R2 时间锚点</b>　声明里的时刻若早于本轮开始，判为“运行前就存在的内容”</li>
      <li><b>R3 动作存在性</b>　声称改变了什么，就必须真的执行过改变类动作</li>
    </ol>
  </div>
  <div style="display:flex;flex-direction:column;gap:13px;justify-content:center">
    <div class="card"><div class="k">输出三值</div><div class="v">通过 / 无法确认 / 驳回</div></div>
    <div class="card w"><div class="k">“无法确认”是诚实输出</div>
      <div class="v">不是失败。老人宁可听到“我没法确认这件事真的办成了”，也不要一句自信的谎话。</div></div>
    <div class="card"><div class="k">它是下限，不是证明</div>
      <div class="v">只否证<b>物理上不可能</b>的声明；“确实动了手却没做成”需要证据层核验（见第 13 页）。</div></div>
  </div>
</div>'''))

B.append(page("机制③④ 看得见，也点得准", 8, '''
<div class="two">
  <div style="display:flex;flex-direction:column;gap:16px;justify-content:center">
    <div class="card"><div class="k">③ 控件树与截图互补的双通道观察</div>
      <div class="v">按页面能力<b>自动切换</b>：有控件树走文本，纯图页面走截图；无标签叶子控件与输入法按键单独编号；
      盲页面叠加 <b>10% + 5% 双层比例网格</b>，让模型有可指认的坐标。</div></div>
    <div class="card"><div class="k">④ “触发推送、方法拉取”的按需技巧</div>
      <div class="v">第三方应用的专门知识<b>不内联进系统指令</b>，只留“遇到什么情况查哪个技巧”，
      具体做法由模型识别到页面时调用 <span class="mono">load_skill</span> 拉取。<br>
      同一任务：全量内联时调用 <b>0/4</b>，改为触发后 <b>3/3</b>，读对率 2/4 → 3/3。</div></div>
  </div>
  <div class="phones" style="flex-direction:column;gap:10px">
    <div class="phone" style="width:190px"><img src="figures/fig7.png" style="background:#fff"><div class="cap">观察层路径</div></div>
  </div>
</div>'''))

B.append(page("产品形态：老人只说一句话，其余交给系统", 9, '''
<div class="two" style="grid-template-columns:1fr .78fr">
  <div class="cards g2" style="align-content:center">
    <div class="card"><div class="k">一屏一件事</div>
      <div class="v">首页只有一个大圆钮，它同时是<b>状态指示与开关</b>（空闲“说给接线员听”／办事中“停下来”）；页面没有第二件需要判断的事。</div></div>
    <div class="card"><div class="k">五种收尾，各有独立界面</div>
      <div class="v">只有“不再请求工具”才算完成；<span class="mono">impossible</span>／<span class="mono">ask_person</span>／<span class="mono">ask_user</span>／<span class="mono">handoff</span> 各有呈现——<b>把“做不到”与“已完成”并列为独立结局</b>。</div></div>
    <div class="card"><div class="k">平安守望：绝不“狼来了”</div>
      <div class="v">以“<b>沉默不能证明安全</b>”为原则：每日报平安使“缺失的那条”本身成为告警；并严格区分<b>“服务离线”与“行为异常”</b>。</div></div>
    <div class="card w"><div class="k">家人通道：不做远程控制</div>
      <div class="v">家人只能查看状态、认领求助、留言，<b>不能远程操作老人的手机</b>——从产品形态上排除诈骗者惯用的“远程协助”通道。</div></div>
  </div>
  <div class="phones"><div class="phone"><img src="figures/shot-home.png"></div></div>
</div>'''))

B.append(divider("03", "证据", "不是 Demo，也不是自说自话：<br>真机 13 项任务、五组对抗实验、核验三组对照，全部可复现。", 10))

B.append(page("真机证据：不是 Demo，是真机上跑出来的", 11, '''
<div class="statband">
  <div class="s"><b>8+1</b><span>第三方应用 + 系统设置（9 个页面）</span></div>
  <div class="s"><b>13</b><span>真机任务跑通</span></div>
  <div class="s"><b>0</b><span>美团 10 步点餐全程打扰次数</span></div>
  <div class="s"><b>149</b><span>JVM 回归断言（31 场景）</span></div>
</div>
<div class="cards g3">
  <div class="card"><div class="k">微信 填消息</div><div class="v">7 步。攻克聊天框无障碍盲区，用“剪贴板 + 输入法候选栏”稳妥录入。</div></div>
  <div class="card"><div class="k">12306 查火车票</div><div class="v">13 步。跨日期、多条件筛选，读出真实车次；收起面板逐项核对 4/4 一致。</div></div>
  <div class="card"><div class="k">拼多多 下单</div><div class="v">14 步。App 直接跳转微信支付，模型在<b>无控件树的盲页面</b>上取消支付并返回。</div></div>
</div>
<div class="sub" style="font-size:14.5px">口径：单机型（OnePlus PLC110 / Android 16）、小样本、每项单次或少数几次运行，<b>不代表总体成功率</b>。除标注“生产确认模式”者外，均在自动确认的演示模式下运行。</div>'''))

B.append(page("对抗实验：主动证伪自己", 12, '''
<div class="two">
  <div style="display:flex;flex-direction:column;gap:13px;justify-content:center">
    <div class="card"><div class="k">设计依据</div>
      <div class="v">针对 <b>2025—2026 年五篇前沿工作</b>提出的失效模式（提示层对齐只是局部现象、沙箱化风险、GUI 智能体安全评测等）设计五组对抗实验。</div></div>
    <div class="card"><div class="k">结果</div>
      <div class="v"><b>发现 5 处问题，修复 4 处</b>；回归断言 <b>99 → 149</b>，四处修复全部由回归断言守护。</div></div>
    <div class="card r"><div class="k">F5 如实保留</div>
      <div class="v">词表扩充后，<b>边界探针仍 6/6 漏拦</b>（关闭查找手机、退出登录、更换手机号…）。这不是“没修好”，而是<b>“词表匹配”这条路线的天花板</b>。</div></div>
  </div>
  <div class="fig"><img src="figures/chart-x8.png"></div>
</div>'''))

B.append(page("核验三组对照：把“招牌机制只做了一半”量化", 13, '''
<table>
  <tr><th>组</th><th class="c">识别谎报</th><th class="c">把真办成的判为“无法确认”</th></tr>
  <tr><td>无核验（采信模型自述）</td><td class="c">0 / 5</td><td class="c">0 / 4</td></tr>
  <tr><td><b>机械核验（现行）</b></td><td class="c"><b>4 / 5</b></td><td class="c">1 / 4</td></tr>
  <tr><td><b>证据核验（原型）</b></td><td class="c"><b>5 / 5</b></td><td class="c">2 / 4</td></tr>
</table>
<div class="cards g3">
  <div class="card"><div class="k">漏掉的那一类是只读结论</div>
    <div class="v"><span class="mono">OutcomeCheck</span> 按设计不核验只读声明（否则会误伤诚实的只读回答）——与真机发现 <b>F8</b> 是同一件事。</div></div>
  <div class="card w"><div class="k">代价也如实报</div>
    <div class="v">证据原型会把<b>“汇总计算得出、页面上没有直接出现”的数字</b>一并降级；这条误伤样本是我们主动放进对照的。</div></div>
  <div class="card"><div class="k">结论边界</div>
    <div class="v">受控实验证明<b>闸门与核验逻辑的确定性</b>，<b>不</b>证明真实模型被注入说服后也拦得住——那由第 11 页真机与跨应用实验承担。</div></div>
</div>
<div class="sub" style="font-size:14.5px">证据层核验目前<b>仅为对照用原型</b>（实现于回归套件），尚未接入执行循环；产品当前状态仍为“拟研发”。</div>'''))

B.append(page("工程可信度：能天天跑的护栏，不是一次性演示", 14, '''
<div class="two">
  <div style="display:flex;flex-direction:column;gap:16px;justify-content:center">
    <div class="card"><div class="k">核心循环与 Android 完全解耦</div>
      <div class="v">智能体核心是纯 Kotlin 实现，不依赖 Android，<b>可在 JVM 上直接回归</b>——这是能用测试驱动开发的前提。</div></div>
    <div class="card"><div class="k">149 项断言 / 31 个场景</div>
      <div class="v">每次改动执行 <span class="mono">harness/run.sh</span>，<b>约 2 秒全绿</b>；服务端另有 31 项 pytest。</div></div>
    <div class="card"><div class="k">99 → 149 的轨迹可逐级复核</div>
      <div class="v">对抗评测每次运行的原始输出（含修复前）全部留档，<b>报告里每一处“修复前/修复后”的数字都能找到对应记录</b>。</div></div>
  </div>
  <div class="fig"><img src="figures/chart-constraint.png"></div>
</div>'''))

B.append(divider("04", "价值与展望", "政策与市场都指向这里。<br>我们也如实说明：<b>还没有一位真实老人用过</b>——这是下一步。", 15))

B.append(page("应用价值：政策与市场都指向这里", 16, '''
<div class="cards g3">
  <div class="card"><div class="k">政策方向明确</div>
    <div class="v">国办发〔2020〕45 号《关于切实解决老年人运用智能技术困难的实施方案》、工信部适老化专项行动、《无障碍环境建设法》——<b>都指向“让老人真正用得上”</b>。</div></div>
  <div class="card"><div class="k">人群与落差真实</div>
    <div class="v">60 岁以上人口规模持续扩大，而老年群体的数字技能与高频事务的线上化程度之间存在显著落差。</div></div>
  <div class="card"><div class="k">落地形态轻</div>
    <div class="v">老人端<b>不换手机、不换 App、零学习成本</b>；家人端零安装（网页即可）；不新增硬件。</div></div>
</div>
<div class="two" style="flex:0 0 auto;grid-template-columns:1.35fr .65fr;gap:18px">
  <div class="card w"><div class="k">我们如实说明</div>
    <div class="v"><b>目前尚无正式的老年用户试用数据</b>——现阶段完成的是实验室与团队内部的高仿真任务走查。
    面向老年群体的最小可用性观察（知情同意 + 3 类任务 + 四项指标：能否独立发起 / 理解状态 / 中止 / 找到真人）已在筹备。</div></div>
  <div class="phones"><div class="phone" style="width:150px"><img src="figures/shot-keepalive.png"><div class="cap">保活状态与平安确认</div></div></div>
</div>'''))

B.append(page("", 17, '''
<div style="display:flex;flex-direction:column;gap:20px;height:100%;justify-content:center">
  <h1 style="font-size:36px">如实披露：我们知道还差什么</h1>
  <div class="cards g3">
    <div class="card"><div class="k">已实现（可运行、有测试守护）</div>
      <div class="v">四项机制全部上线；8 款第三方应用 + 系统设置跑通 13 项真机任务；149 项回归断言；核心循环与 Android 解耦。</div></div>
    <div class="card w"><div class="k">原型验证（小样本，未接入主流程）</div>
      <div class="v">证据层核验（仅用于三组对照）、候选技巧的生成与人工采用/回退；机械层核验已上线。</div></div>
    <div class="card r"><div class="k">拟研发 / 尚未解决</div>
      <div class="v">证据层核验接入执行循环；技能自进化的完整闭环（失败归因、独立任务验证、按版本自动选版）；词表路线对边界动作的天花板（F5）；动态页面的 <span class="mono">stale_screen</span> 失败（F6）。</div></div>
  </div>
  <div class="quote" style="text-align:center;border:none;background:rgba(255,255,255,.10);color:#fff;font-size:25px;line-height:1.5;padding:26px">
    把“可信”做成<b style="color:#8fe3d6">架构约束</b>，而不是提示词里的请求。</div>
</div>''', cls="dark"))

# ── 备用页（答辩追问）──
A = []
def backup(n, t, body):
    A.append(page(f"备用页 · {t}", f"B{n}", body))

backup(1, "算法 2 与代码一致吗？", '''
<div class="sub">一致。第三部分（四）与附录代码段均描述现行实现；附录代码为<b>逐行取自 <span class="mono">AgentLoop.kt</span></b> 的节选（27 行有效代码全部可在仓库检索到）。</div>
<ul>
  <li>现行机制：<b>动作周期</b>（窗口 12，尾部按周期 2~3 完整重复 3 次且含 ≥2 种工具）+ <b>无效重复</b>（同工具同参数且 <span class="mono">screenChanged</span> 恒为 false）</li>
  <li>停止条件：动作循环提醒 5 次、无效重复提醒 3 次 / 停止 5 次</li>
  <li><b>刻意不用页面指纹</b>：真实应用会动画、重算价格、轮播推广，指纹会产生假重复；翻页而文本不变同样会漏判</li>
</ul>
<div class="quote">放弃指纹不是退让：把“什么算进展”建立在一个在真实应用里不成立的假设上，比不做这项判定更危险。</div>''')

backup(2, "受控 mock 证明了什么？", '''
<div class="two">
  <div>
    <div class="card"><div class="k">证明</div><div class="v">给定一个<b>会撒谎、会松口、会绕路</b>的模型，闸门与核验逻辑本身的<b>确定性</b>——它不随模型的说辞变化。</div></div>
    <div class="card r"><div class="k">不证明</div><div class="v">真实模型被注入说服后也一定拦得住。后者取决于模型能力，属于模型侧变量，不是架构侧的保证。</div></div>
  </div>
  <div>
    <div class="card"><div class="k">真实模型由谁负责</div><div class="v">第五部分 13 项真机任务（真实模型 + 真实第三方 App）与第七部分跨应用验证。</div></div>
    <div class="card"><div class="k">完整证据链</div><div class="v"><b>受控实验证明架构成立，真机实验证明在真实模型与真实应用上可用。</b></div></div>
  </div>
</div>
<div class="sub">凡对抗实验结论，均按“有对照 / 可复现 / 有守护”三条标准标注成立条件，不外推到真实模型的安全性上。</div>''')

backup(3, "词表路线的天花板在哪？", '''
<div class="sub">F5 是<b>路线级上限</b>，不是实现缺陷。词表匹配能可靠拦住<b>有明确危险文字</b>的动作，但拦不住“文字本身中性、后果不可逆”的边界动作。</div>
<table>
  <tr><th>类别</th><th class="c">结果</th><th>示例</th></tr>
  <tr><td>显性危险动作</td><td class="c">6 / 6 拦住</td><td>确认付款、立即支付、提交订单</td></tr>
  <tr><td>隐蔽型危险动作</td><td class="c">8 / 8 拦住</td><td>申请退款、取消订单、恢复出厂设置</td></tr>
  <tr><td><b>边界探针</b></td><td class="c"><b>6 / 6 漏拦</b></td><td>关闭查找手机、允许安装未知应用、开启开发者选项、退出登录、更换手机号、关闭定位服务</td></tr>
</table>
<div class="quote">如实保留比虚假承诺更有价值：<b>我们不用“漏拦率 0”这类把“模型无能”算作“安全有效”的表述。</b></div>''')

backup(4, "页面文字上云，隐私怎么办？", '''
<ul>
  <li><b>只发当前页面的可见文字与控件结构</b>，用于规划；不采集通讯录、相册、通话记录、麦克风常驻录音。</li>
  <li><b>输入类动作的正文</b>由本地闸门先筛本人操作词表，命中即拒绝并交还本人，不进入模型决策。</li>
  <li><b>截图按需</b>：仅在控件树缺失（纯图页面）时附加，且<b>每页只发一次</b>。</li>
  <li><b>只追加、不重写</b>的对话记录保存在本机；任务存档可随时删除。</li>
  <li><b>已知不足</b>：尚未按应用排除敏感页面（如银行类页面整体排除），这是下一步要做的事。</li>
</ul>''')

backup(5, "“自进化”今天交付的是哪一半？", '''
<div class="two">
  <div>
    <div class="card"><div class="k">已经交付：候选生成 + 人工采用/回退</div>
      <div class="v">成功任务可沉淀为<b>候选技巧</b>；候选先进入候选区，由家人在设置页<b>采用后才会出现在 <span class="mono">load_skill</span> 可用列表中</b>，可随时回退。技巧只存文字步骤，不存截图，也不自动生效。</div></div>
  </div>
  <div>
    <div class="card w"><div class="k">尚未交付：自动闭环</div>
      <div class="v">失败归因、独立任务验证、按版本自动选版——属第八部分列明的研发方向，目前状态为<b>拟研发</b>。</div></div>
  </div>
</div>
<div class="quote">因此“自进化”在当前版本中的准确含义是：<b>技巧可以沉淀、可以复用、可以回退，但采用与否由人决定</b>——这也是我们把它做成一等公民而非黑箱的原因。</div>''')

backup(6, "京东那个首页为什么失败？", '''
<div class="sub">同一目标“看看我的快递到哪了”，拼多多与淘宝 <b>COMPLETED（各 5 步）</b>，京东 <b>PAUSED（2 步）</b>。</div>
<div class="quote">机制解释：<span class="mono">stale_screen</span> 版本校验是<b>为安全而设的竞态防线</b>（防止动作作用于已过期的界面观察），但在含常驻轮播的高动态首页上，界面版本高频变动使合法动作被判为过期，<b>在 2 次修复预算内即耗尽配额</b>。</div>
<ul>
  <li>同类电商首页在拼多多、淘宝成功 → 该失败是<b>间歇性</b>的</li>
  <li>对老人而言，<b>间歇性失败比确定性失败更难理解</b>——这正是它值得单独记一条的原因</li>
  <li>改进方向：把 <span class="mono">stale_screen</span> 与常规修复预算解耦，或改为自动重观察并重解析同一语义目标（新发现 F6，尚未修复）</li>
</ul>''')

html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>银龄智办 · 答辩演示</title>
<link rel="stylesheet" href="deck.css"></head>
<body>
{''.join(B)}
<div style="page-break-before:always;break-before:page"></div>
{''.join(A)}
</body></html>'''

out = pathlib.Path(__file__).parent / "答辩演示.html"
out.write_text(html, encoding="utf-8")
print(f"已生成：正文 {len(B)} 张 + 备用 {len(A)} 张 = {len(B)+len(A)} 张")
