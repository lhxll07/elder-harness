package com.yinling.core

/**
 * 证据层核验：声明里"可核对的内容"，必须能在**本轮实际看到过的页面**上找到。
 *
 * 它补的是 [OutcomeCheck] 够不着的那一类：只读结论没有执行记录可查。
 * 例如页面上写着"共 5 个包裹、2 个已签收"，模型却回答"一共 4 单，其中 3 单已签收"——
 * 这一轮只调用了截图，没有任何动作可以核对，机械核验只能放行。
 *
 * 与机械核验的分工：
 * - [OutcomeCheck] 管"**有没有做**"——查本轮自己的执行记录，是下限；
 * - 本对象管"**读到的对不对**"——查本轮实际看过的页面文字。
 * 两者都是本地确定性判定，模型的说辞无法说服任何一方。
 *
 * ## 两类可核对内容的规则不同，这是刻意的
 *
 * **引号内文字**：既然加引号，就是声称"页面上这么写的"，因此必须在页面上找到，找不到即降级。
 *
 * **数字**：不能要求字面出现。真实场景里大量结论是**数出来的**——
 * "一共 4 单，其中 3 单已签收"对应页面上四行包裹记录，数字本身并不印在屏幕上；
 * 若要求字面出现，就会把这类**诚实的汇总结论**一并降级（这正是原型 2/4 代价的来源）。
 * 因此数字的规则是"字面出现，**或**不超过页面条目数"：
 * 数出来的数不可能比页面上的东西还多。上例中页面只有两行、却声称四单，
 * `4 > 2` 说明它不可能是数出来的，于是被拒。
 *
 * ## 拿不到页面文字时不判
 *
 * 无障碍树读不到内容的"盲页面"、以及敏感页面，本轮本来就没有可核对的文字。
 * 此时返回 Supported——**"我没看见"不等于"你在撒谎"**，把读不到的页面一律降级，
 * 只会重演《Safe, or Simply Incapable?》批评的那种混淆：把"更保守"当成"更安全"。
 */
object EvidenceCheck {

    /** 引号内的引用文字；中英文引号都算。 */
    private val QUOTED = Regex("[\u201C\u201D\"]([^\u201C\u201D\"]{1,60})[\u201C\u201D\"]")

    private val NUMBER = Regex("\\d+")

    /**
     * "一共／共／总共 N" —— 页面上**印出来的总数**。
     *
     * 总数是印在屏幕上、不是数出来的，所以它可以直接比对；而"页面上有几个条目"只能给出
     * 一个宽松上限，单靠它判不动（五条包裹记录声称"四单"时，4 ≤ 5 就放过去了）。
     */
    private val STATED_TOTAL = Regex("(?:一共|共|总共)\\s*(\\d+)")

    /**
     * @param claim 模型给出的完成声明。
     * @param postScreen 本轮实际看到过的页面文字（标签与元素文本）。
     * @param screenReadable 本轮是否真的读到过页面文字；盲页面或敏感页面为 false。
     */
    fun check(
        claim: String,
        postScreen: List<String>,
        screenReadable: Boolean,
    ): OutcomeVerdict {
        if (!screenReadable) return OutcomeVerdict.Supported

        val haystack = postScreen.joinToString(" ")
        // 条目数：页面上非空行的数量，作为"数得出来"的上限。
        val itemCount = postScreen.count { it.isNotBlank() }

        QUOTED.findAll(claim).forEach { m ->
            val cited = m.groupValues[1].trim()
            // 单双引号成对时，正则可能把前一个引号的开引号与后一个引号的闭引号配错，
            // 取到的内容会带上标点；去掉首尾标点后再比对，避免假降级。
            val core = cited.trim('，', '。', '、', '：', '；', ',', '.', ':', ';', ' ')
            if (core.isNotEmpty() && core !in haystack) {
                return OutcomeVerdict.Unsupported(
                    "声明里引用的内容“$core”没有出现在本轮看到的页面上",
                )
            }
        }

        NUMBER.findAll(claim).forEach { m ->
            val n = m.value
            if (n in haystack) return@forEach
            // 字面没出现：只有当它可能"数得出来"时才放行。
            val value = n.toIntOrNull()
            if (value == null || value > itemCount) {
                return OutcomeVerdict.Unsupported(
                    "声明里的数字 $n 既不在本轮看到的页面上，也超过页面上能数出来的条目数（$itemCount）",
                )
            }
        }

        // 页面上印出来的总数与声明里的总数必须一致。
        // 这是本核验里最硬的一条：总数是印在屏幕上的，不是数出来的，因此没有"可能算错"的余地。
        val pageTotals = STATED_TOTAL.findAll(haystack).map { it.groupValues[1] }.toSet()
        if (pageTotals.isNotEmpty()) {
            STATED_TOTAL.findAll(claim).forEach { m ->
                val claimed = m.groupValues[1]
                if (claimed !in pageTotals) {
                    return OutcomeVerdict.Unsupported(
                        "声明说“共 $claimed”，但本轮看到的页面上写的是“共 ${pageTotals.first()}”",
                    )
                }
            }
        }
        return OutcomeVerdict.Supported
    }
}
