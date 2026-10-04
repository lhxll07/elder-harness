package com.yinling.hotline

import com.yinling.core.AgentToolSpec
import com.yinling.core.GoalFamily
import com.yinling.core.SkillMeta
import com.yinling.core.SkillSelect
import com.yinling.core.SkillShadow
import com.yinling.core.ToolCall
import com.yinling.core.ToolResult

/**
 * Optional know-how the model can pull in when it needs it.
 *
 * The prompt only carries the one-line catalog below. The detail is fetched through the
 * `load_skill` tool and lands in the transcript, so ordinary tasks never pay for app-specific
 * text, and adding knowledge for a new app means adding data here rather than growing the
 * system prompt. This keeps the core loop free of third-party app scripts.
 *
 * [Skill] is now the shared core model: `id`/`version` separated, plus the provenance and gate
 * numbers the verification loop needs. Built-in skills leave `id` empty and fall back to `name`.
 */
typealias Skill = SkillMeta

object SkillCatalog {

    /**
     * Skills the model has earned from a verified run. [HotlineApp] refreshes this from [SkillStore]
     * after startup and after the family adopts or rolls back a candidate.
     */
    @Volatile
    var generated: List<Skill> = emptyList()

    private val builtin: List<Skill> = listOf(
        Skill(
            name = "reading_tables",
            id = "reading_tables",
            goalFamily = "read_table",
            validators = listOf("page_reached"),
            description = "读表格、课表、账单这类格子内容时的方法（防止把相邻列的内容读成目标列）",
            body = """
从截图里读表格时，按这个顺序做：
1. 先找表头：哪一行是列名（日期、星期、商品、科目…），哪一列是行名（节次、时间、序号…）。
2. 再定位：把老人问的那一项换算成表头里的具体标签（例如"明天"=9月30日=周三），确认它在第几列。
3. 逐条读：每条都写成"列头 + 行 + 内容"，例如"周三 第1-2节 离散数学"。
4. 自检：把这一列的条目连起来看，如果中间的列头跳变、或者目标列看着是空的而相邻列有内容，
   就说明列数错了，重新数一遍再答。
5. 拿不准就说拿不准：宁可回答"这一列我看不太清"，也不要把相邻列的内容算进来。
""".trimIndent(),
        ),
        Skill(
            name = "blind_page",
            id = "blind_page",
            goalFamily = "blind_app",
            validators = listOf("handed_back_to_person"),
            description = "页面读不到任何控件时（如微信、银行类应用）如何观察和操作",
            // Known blind apps: the page hint then names this skill while the person is in one.
            apps = setOf("com.tencent.mm"),
            body = """
这类应用屏蔽了无障碍读取，控件列表是空的，只能靠截图。系统会自动附上截图。
- 点按用 tap_xy，x、y 是屏幕比例：左上角 0,0，右下角 1,1。
- 不要用 click、tap_text、input_text、scroll —— 它们都需要控件编号，在这里必然失败。
- 需要滑动时用 swipe，坐标是像素。
- 如果截图连续失败，你实际上看不到页面：不要再猜位置，用 ask_person 请老人自己操作，或 handoff 交给家人。
""".trimIndent(),
        ),
        Skill(
            name = "wechat_input",
            id = "wechat_input",
            goalFamily = "send_message",
            validators = listOf("cursor_in_input_box"),
            hint = "微信里不要试图点屏幕键盘打字（点不准、也打不进去）：先点一下输入框，再用 paste_text 粘贴。" +
                "详细步骤见 wechat_input 技巧。",
            description = "微信里如何把文字填进输入框（它不接受程序写入和外部注入）",
            apps = setOf("com.tencent.mm"),
            body = """
微信不接受程序写入文字（input_text）也不接受外部注入（input text），但输入法可以帮忙：
0. 截图上有 **10% 主刻度 + 5% 辅助网格**（横竖红线标着 0.1~0.9），用它定位，不要靠目测：
   - 没有键盘时，输入框是屏幕**最底部那条细长框**（约 y=0.95）。
   - **键盘弹出后输入框会被顶到键盘上方**（约 y=0.55~0.6），之前算的坐标立刻失效，要重新截图。
   - 不要点键盘上的字母键找字——键盘又小又密，点不准；输入法候选栏才是要点的目标。
1. 用 tap_xy 点中底部输入框，让键盘弹出。
2. 调用 paste_text 把文字写进系统剪贴板。它很可能返回"不接受程序粘贴"，这不影响下一步。
3. 输入法通常把剪贴板内容显示为**键盘上方候选栏的第一项**。用 tap_xy 点那一栏靠左的第一项，
   文字就进入输入框了。

输入框里已有旧文字时先清空：用 tap_xy 点键盘右下角的删除键（退格），每点一次删一个字，
连续点是允许的；也可以长按输入框选"全选"再删除。

如果点候选栏没有效果，说明这台手机的输入法不支持这个做法：不要继续试，也不要一个键一个键地
敲屏幕键盘，用 ask_person 请老人自己输入。发送消息同理，由老人自己完成。
""".trimIndent(),
        ),
        Skill(
            name = "meituan_order",
            id = "meituan_order",
            goalFamily = "order_food",
            validators = listOf("no_send_no_pay"),
            hint = "美团里**不要点底部的“外卖”标签**（那是图片信息流，页面重、点不准）：" +
                "直接点首页顶部的搜索框搜要买的东西，路径最短。详细步骤见 meituan_order 技巧。",
            description = "美团点外卖/买药/买菜：直接在首页搜索，绕开外卖信息流",
            apps = setOf("com.sankuai.meituan"),
            body = """
美团底部那个“外卖”标签点进去是**图片信息流**：控件多、图片多、一直在动，既容易点错，
一次点击也要等很久。**用首页搜索可以完全绕开它**，这是最短路径：

1. 打开美团后**停在首页**。若弹出广告、活动弹窗或定位授权，先关掉（点右上角的“×”或“跳过”）。
2. **不要点底部的“外卖”“神券”“订单”“我的”。** 尤其不要点“外卖”。
3. 点**首页顶部的搜索框**（屏幕最上方那条，占位文字是“搜索”），先 click 一下让它获得焦点。
4. 用 input_text 把要买的东西写进去（例如“黄焖鸡”“降压药”“一箱纸巾”）。
   若 input_text 失败，改用 paste_text；再失败就用 ask_person 请老人自己输入，不要一个键一个键敲。
5. 点“搜索”（键盘右下角，或搜索框右侧的“搜索”按钮）。搜索结果页是列表，比外卖信息流好读得多。
6. 选一家店：点**店铺名或商品图片**进店；跳过带“广告”字样的结果。
   店很多、拿不准选哪家时，挑**配送时间短、评分高**的，或直接 ask_user 问老人。
7. 进店后选具体商品与规格（份量、辣度、口味）。
   **如果有多个同类商品**（例如七八款黄焖鸡），必须先用 ask_user 把选项念给老人挑，不要替他选。
8. 点“加入购物车”（或“选规格”后再加购）。
9. **到此停下**：把商品、金额、收货地址讲清楚，用 ask_person 请老人自己点“去支付/提交订单”。
   **绝对不要点“去支付”“提交订单”“立即支付”**——付款是老人自己的事。

读不到控件、或整页都是图片时：用 screenshot 看，再按图上的 **5% 网格**用 tap_xy 点，
点完会自动给你新截图，点偏了就按新截图修正。**不要靠逐个点进去试探**。
""".trimIndent(),
        ),
    )

    /** Built-in knowledge plus generated skills the family has adopted. */
    val skills: List<Skill>
        get() = builtin + generated

    /**
     * Skills are listed once, in the [toolSpec] description: the model must read that schema to
     * call the tool at all. Listing them again in the system prompt only wasted fixed tokens.
     */
    fun summary(): String = ""

    /**
     * A one-line nudge shown with the page when the current app has know-how available. A skill may
     * supply its own wording: "there is a skill" was too weak to stop the model from trying the
     * on-screen keyboard in WeChat first and only reaching for the clipboard much later.
     *
     * Only what the family has already adopted (`active/`) is here; `shadow` revisions stay invisible
     * until they beat the incumbent on the frozen task set.
     *
     * [observation] is the *page text* of the very render this hint is appended to, produced by
     * [com.yinling.core.SkillShadow.observationFor] so the decorations (installed-app list, this
     * hint's own `提示：` line) cannot satisfy a `requires`. A skill with a non-empty `requires` is
     * offered only when every entry matches; an empty observation therefore hides it rather than
     * silently falling back to `apps` alone — the same expression Tier 1 replays.
     */
    fun hintFor(app: String?, goalFamily: String? = null, observation: String = ""): String {
        val relevant = skills
            .filter { app != null && app in it.apps }
            .filter { SkillShadow.requiresSatisfied(it.requires, observation) }
        val matched = if (goalFamily.isNullOrBlank()) {
            relevant
        } else {
            relevant.filter { SkillSelect.matches(it, app, goalFamily) }
        }
        val pool = matched.ifEmpty { relevant }
        if (pool.isEmpty()) return ""
        pool.firstOrNull { it.hint.isNotBlank() }?.let { return "提示：${it.hint}" }
        return "提示：当前应用有可用技巧 " + pool.joinToString("、") { it.stableId } +
            "，遇到困难时可用 load_skill 查看。\n"
    }

    /**
     * Rule-based automatic choice, in the order written down in [SkillSelect]: app package, then
     * `goal_family`, then `requires` against [observation], then the passing version with the lowest
     * shadow rate (newest on a tie), only if at least two independent runs verified it. This is a
     * **gate, not a learned router** — there is deliberately no embedding ranker and no model in this
     * path.
     *
     * The `requires` half goes through [SkillSelect.surfaced], the exact predicate Tier 1 counts
     * exposed points with; passing an empty [observation] can only hide a `requires`-bearing skill.
     */
    fun selectFor(app: String?, goalFamily: String? = null, observation: String = ""): Skill? {
        val candidates = skills.filter { SkillSelect.surfaced(it, app, goalFamily, observation) }
        return SkillSelect.chooseActive(candidates)
    }

    fun find(name: String): Skill? = skills.find { it.stableId == name || it.name == name }

    /** Grouped view for the family screen: one entry per id, its versions newest first. */
    fun versionsOf(id: String, all: List<Skill>): List<Skill> =
        all.filter { it.stableId == id }.sortedByDescending { it.version }

    val toolSpec: AgentToolSpec
        get() = AgentToolSpec(
            // A pure lookup: asking again returns the same text, which is never progress.
            informational = true,
            name = "load_skill",
            description = "读取某个经验技巧的详细步骤。包含：" +
                skills.joinToString("；") { "${it.stableId}（${it.description}）" },
            parameters = listOf(
                // Named "argument" on purpose: the loop only forwards a fixed set of argument names
                // (argument/target/text/...), so a parameter called "name" would arrive empty.
                AgentToolSpec.ToolParam("argument", "string", "技巧名称，见本工具说明", required = true),
            ),
        )

    /** @return the skill body, or a failure explaining what names exist. */
    fun load(call: ToolCall): ToolResult {
        val skill = find(call.argument) ?: return ToolResult(
            false,
            "没有名为“${call.argument}”的技巧。可用：" + skills.joinToString("、") { it.stableId },
            "unknown_skill",
        )
        return ToolResult(true, skill.body)
    }

    /** Goals are mapped to families by a fixed keyword table (see `GoalFamily`), never by a model. */
    fun familyOf(goal: String): String = GoalFamily.of(goal)
}
