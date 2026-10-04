package com.yinling.hotline

import com.yinling.core.ActionSignature
import com.yinling.core.AgentMessage
import com.yinling.core.SkillLint
import com.yinling.core.SkillRedaction

/**
 * Turns one verified task transcript into a candidate skill.
 *
 * This is deliberately a single text-only model call with a strict output format. It never decides
 * whether a task succeeded; the caller only invokes it after the loop's completion check passed and
 * the person confirmed the result.
 *
 * The prompt now also asks for the fields a *machine* has to judge: `goal_family`, `validators` (only
 * names from [SkillLint.VALIDATORS] — free invention is rejected because a gate cannot run prose) and
 * `forbidden`. The stable `id` is requested separately from the display `name`, because renaming a
 * skill must not mint a new one.
 */
class SkillWriter(private val ask: suspend (instructions: String, prompt: String) -> String?) {

    suspend fun draft(
        goal: String,
        appPackage: String?,
        transcript: List<AgentMessage>,
        goalFamily: String = "",
        evidenceRun: String = "",
        baselineRun: String = "",
    ): Skill? {
        val answer = ask(INSTRUCTIONS, prompt(goal, appPackage, transcript, goalFamily))?.trim().orEmpty()
        if (answer.isBlank()) return null
        return parse(answer, goal, appPackage, goalFamily, evidenceRun, baselineRun, transcript)
    }

    private fun prompt(
        goal: String,
        appPackage: String?,
        transcript: List<AgentMessage>,
        goalFamily: String,
    ): String = buildString {
        appendLine("目标：${redact(goal)}")
        appendLine("当前 App：${appPackage.orEmpty().ifBlank { "未知" }}")
        appendLine("任务族 goal_family：${goalFamily.ifBlank { "未定" }}")
        appendLine()
        appendLine("操作记录：")
        transcript.forEach { message ->
            when (message.role) {
                AgentMessage.Role.USER -> appendLine("用户：${redact(message.content).take(400)}")
                AgentMessage.Role.ASSISTANT -> {
                    append("助手：")
                    if (message.content.isNotBlank()) append(redact(message.content).take(300))
                    if (message.toolCalls.isNotEmpty()) {
                        append(" [调用] ")
                        append(
                            message.toolCalls.joinToString("；") { call ->
                                val args = call.arguments.entries.joinToString(",") {
                                    "${it.key}=${redact(it.value).take(60)}"
                                }
                                "${call.tool}($args)"
                            },
                        )
                    }
                    appendLine()
                }
                AgentMessage.Role.TOOL -> appendLine("工具结果：${redact(message.content).take(240)}")
                AgentMessage.Role.SYSTEM -> Unit
            }
        }
    }.take(MAX_PROMPT_CHARS)

    /**
     * The transcript may contain a phone number, ID, bank card, waybill or address seen on screen.
     * The model is asked not to put them in the skill, and the shared [SkillRedaction] rules keep them
     * out of the summarization request as well. Tier 0 rejects anything that still slips through.
     */
    private fun redact(text: String): String = SkillRedaction.redact(text)

    private fun parse(
        answer: String,
        goal: String,
        appPackage: String?,
        goalFamily: String,
        evidenceRun: String,
        baselineRun: String,
        transcript: List<AgentMessage>,
    ): Skill {
        val text = answer
            .removePrefix("```markdown")
            .removePrefix("```")
            .removeSuffix("```")
            .trim()
        val lines = text.lines()
        val meta = mutableMapOf<String, String>()
        var bodyStart = 0
        if (lines.firstOrNull()?.trim() == "---") {
            bodyStart = lines.size
            for (index in 1 until lines.size) {
                val line = lines[index].trim()
                if (line == "---") {
                    bodyStart = index + 1
                    break
                }
                val colon = line.indexOf(':')
                if (colon > 0) meta[line.substring(0, colon).trim().lowercase()] = line.substring(colon + 1).trim()
            }
        }
        val body = lines.drop(bodyStart).joinToString("\n").trim().ifBlank { text }
        val fallback = "learned_" + System.currentTimeMillis().toString(36)
        val id = slug(meta["id"].orEmpty().ifBlank { meta["name"].orEmpty() }).ifBlank { fallback }.take(48)
        val display = meta["name"].orEmpty().takeIf { name -> name.any { it.code > 127 } }
            ?: meta["description"].orEmpty().take(40).ifBlank { id }
        val family = goalFamily.ifBlank { meta["goal_family"].orEmpty() }
        return Skill(
            name = redact(display).take(48),
            body = redact(body).take(MAX_BODY_CHARS),
            description = redact(meta["description"] ?: meta["title"] ?: goal).take(80),
            apps = meta["apps"].orEmpty()
                .split(',')
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .toSet()
                .ifEmpty { appPackage?.let { setOf(it) } ?: emptySet() },
            hint = redact(meta["hint"].orEmpty()),
            version = meta["version"]?.toIntOrNull() ?: 1,
            status = "candidate",
            source = "learned",
            id = id,
            gate = meta["gate"]?.takeIf { it.isNotBlank() } ?: "gate-v1",
            goalFamily = family,
            requires = meta["requires"].commaList(),
            // Only names from the shipped list survive; anything invented is dropped here and would be
            // rejected by Tier 0 anyway.
            validators = meta["validators"].commaList().filter { it in SkillLint.VALIDATORS },
            forbidden = meta["forbidden"].commaList(),
            evidenceRun = evidenceRun,
            baselineRun = baselineRun,
            signature = ActionSignature.of(toolNames(transcript)),
        )
    }

    private fun toolNames(transcript: List<AgentMessage>): List<String> =
        transcript.filter { it.role == AgentMessage.Role.ASSISTANT }
            .flatMap { message -> message.toolCalls.map { it.tool } }

    private fun slug(value: String): String = value
        .lowercase()
        .replace(Regex("[^a-z0-9_]+"), "_")
        .trim('_')

    private fun String?.commaList(): List<String> = this.orEmpty()
        .split(',', '，')
        .map { it.trim() }
        .filter { it.isNotBlank() }

    companion object {
        private const val MAX_PROMPT_CHARS = 12_000
        private const val MAX_BODY_CHARS = 6_000

        val INSTRUCTIONS = """
你是银龄专线的技能提炼器。用户刚刚完成一次任务，系统将把这次记录交给家人查看。
请把记录总结成一个可复用的 skill.md，只输出 Markdown 内容，不要解释，不要代码围栏。

格式必须是：

---
id: 英文小写稳定标识，例如 meituan_order（同一方法的改进版沿用同一个 id，只改 version）
name: 中文短名，给家人看的
description: 一句中文说明
version: 1
gate: gate-v1
goal_family: 任务族，必须用系统给出的那一个
apps: 应用包名，多个用逗号分隔；不确定就留空
requires: 适用前必须成立的页面事实，逗号分隔，例如 home_page,logged_in
validators: 只能从下面清单里选（逗号分隔），不许自己发明：${SkillLint.VALIDATORS.joinToString(", ")}
forbidden: 交由本人完成的动作词，逗号分隔，例如 去支付,提交订单,发送
source: learned
---

## 适用条件
...

## 流程
1. ...
2. ...

## 失败恢复
...

## 安全边界
到付款、发送、验证码、密码、提交订单等步骤必须交给本人，使用 ask_person，不允许自动执行。

要求：
- 不要写截图、坐标、控件编号、姓名、电话、地址、验证码、密码、金额或聊天内容。
- 步骤写“页面条件 + 动作意图”，不要写死位置；可以用比例坐标（如 tap_xy(0.5, 0.9)）。
- 信息不足就写保守的候选流程，不要编造没有发生的步骤。
- validators 必须是清单里的名字，否则这条技巧会被门禁直接拒绝。
""".trimIndent()
    }
}
