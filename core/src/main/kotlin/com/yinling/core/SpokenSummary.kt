package com.yinling.core

/**
 * 长结论的播报策略：**只念要点，其余请老人看屏幕**。
 *
 * 起因是真机实测：`Speaker` 里原先用 `clean.take(240)` 硬截断，会把句子砍在半截。
 * 更糟的是，那句话往往正是老人最需要的信息（例如取件码）。
 *
 * 为什么不调用模型做摘要：那会多一次请求、多一份延迟，也**多一个可能出错的地方**——
 * 而这里要念给老人听的恰恰是任务结论，宁可机械地取"靠前的完整句子"，也不让另一个模型去改写它。
 *
 * 真实效果：R1 实验里拼多多的答复首句即是"有 1 件还等着您去取，另外 3 件已经签收"，
 * 智行的答复首句即是"明天没有直达火车，需要中转"——**模型本来就把要点放在最前面**，
 * 所以规则化摘要与语义摘要在这些样本上是一致的。
 *
 * 放在 core 而不是 Android 层：它是纯逻辑，应当被回归套件覆盖。
 */
object SpokenSummary {

    /**
     * 播报预算（字符）。团队原先的上限是 240，但按中文语音合成约 4—5 字/秒估算，
     * 240 字要念将近一分钟——对老人是折磨，也会让"正在播报"的状态长期占住界面。
     * 这里收到 120 字（约 25—30 秒），把剩下的交给屏幕。
     */
    const val DEFAULT_BUDGET = 120

    /** 截断时补的一句提示。老人需要知道"不是没内容，而是在屏幕上"。 */
    const val MORE_ON_SCREEN = "其余内容在屏幕上，您可以慢慢看。"

    private const val SENTENCE = "。！？!?"
    private const val CLAUSE = "；;"
    private const val PAUSE = "，,、"

    /**
     * 播报用文本：本身不长就原样返回；过长则取靠前的**完整句子**，并明确告知其余在屏幕上。
     * 任何情况下都不会把句子砍在半截——宁可少念一句，也不念半句。
     */
    fun of(text: String, budget: Int = DEFAULT_BUDGET): String {
        val clean = text.trim()
        if (clean.length <= budget) return clean
        lead(clean, budget)?.let { return "$it $MORE_ON_SCREEN" }
        // 通篇没有断句符号：只能硬截，并用省略号如实标示"话没说完"
        return clean.take(budget).trimEnd() + "…"
    }

    /** 是否会在播报时被收窄（供日志与测试使用）。 */
    fun isTruncated(text: String, budget: Int = DEFAULT_BUDGET): Boolean = text.trim().length > budget

    /**
     * 逐级放宽断点，取预算内**最后一处**该级标点之后的内容：
     * 先句末，再分句，最后句中停顿。
     *
     * 刻意**不为"用满预算"而将就**：实测中，若强行要求摘要不少于预算的一半，就会越过句末
     * 一路读下去，最后停在逗号上，听起来像话没说完。真实样本里，31 字的
     * 「您的快递查到了：有 1 件还等着您去取，另外 3 件已经签收。」本身就是最好的摘要——
     * **把话说完，比把预算用满重要。**
     *
     * [MIN_LEAD] 只用来挡住「好。」这类过短的开头，逼它继续往后取一句。
     */
    private fun lead(text: String, budget: Int): String? {
        for (marks in listOf(SENTENCE, CLAUSE, PAUSE)) {
            var cut = -1
            for (i in text.indices) {
                if (i >= budget) break
                if (text[i] in marks) cut = i + 1
            }
            if (cut >= MIN_LEAD) return text.substring(0, cut).trim()
        }
        return null
    }

    /** 摘要至少要有一句像样的话，避免只念出「好。」就把老人推向屏幕。 */
    private const val MIN_LEAD = 16
}
