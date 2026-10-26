package com.yinling.hotline.settings

import com.yinling.core.SkillSelect

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yinling.hotline.ElderCard
import com.yinling.hotline.HotlineApp
import com.yinling.hotline.Skill
import com.yinling.hotline.BuildConfig
import org.json.JSONObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SkillSettings() {
    val context = LocalContext.current
    val app = context.applicationContext as HotlineApp
    val store = remember { app.skills }
    val scope = rememberCoroutineScope()
    var tick by remember { mutableIntStateOf(0) }
    var expanded by remember { mutableStateOf<String?>(null) }
    val candidates = remember(tick) { store.candidateSkills().groupBy { it.stableId } }
    val active = remember(tick) { store.activeSkills().groupBy { it.stableId } }

    fun refresh() {
        app.refreshSkills()
        tick++
    }

    val importReport = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) scope.launch {
            val accepted = withContext(Dispatchers.IO) { runCatching {
                val text = context.contentResolver.openInputStream(uri)?.reader(Charsets.UTF_8)?.use { reader ->
                    buildString {
                        val buffer = CharArray(8192)
                        var count = reader.read(buffer)
                        while (count != -1) {
                            require(length + count <= 1_048_576)
                            append(buffer, 0, count)
                            count = reader.read(buffer)
                        }
                    }
                } ?: return@runCatching false
                val report = JSONObject(text)
                store.recordValidation(report.getString("skill_id"), report.getInt("version"), report.toString())
            }.getOrDefault(false) }
            Toast.makeText(context, if (accepted) "独立验证通过，可以手动采用" else "报告不完整、不匹配或未通过验证", Toast.LENGTH_LONG).show()
            if (accepted) refresh()
        }
    }

    @Composable
    fun SkillCard(skill: Skill, isCandidate: Boolean) {
        val blocked = !SkillSelect.eligible(skill) || store.lint(skill).rejected
        val key = "${skill.stableId}@${skill.version}"
        ElderCard {
            Text(skill.description, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "${skill.stableId} · v${skill.version} · " +
                    (if (isCandidate) "候选" else "生效") +
                    " · " + (if (skill.source == "learned") "模型生成" else "内置"),
                fontSize = 13.sp,
                color = Color.DarkGray,
            )
            Text(skillApplicabilityLine(skill), fontSize = 13.sp, color = Color.DarkGray)
            Text(skillFixLine(skill), fontSize = 14.sp)
            Text(
                skillRegressionLine(skill),
                fontSize = 14.sp,
                color = if (blocked) Color(0xFFB00020) else Color.DarkGray,
            )
            Text(skillEvidenceLine(skill), fontSize = 13.sp, color = Color.DarkGray)
            Text(skillSafetyLine(skill), fontSize = 13.sp, color = Color.DarkGray)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = { expanded = if (expanded == key) null else key }) { Text("查看") }
                if (isCandidate) {
                    if (BuildConfig.DEBUG && app.session.developerMode) {
                        TextButton(onClick = {
                            if (app.session.queueSkillTrial(skill)) {
                                Toast.makeText(context, "下一个新任务试用此候选，自动确认已关闭。请仅用于可撤销的测试任务。", Toast.LENGTH_LONG).show()
                            }
                        }) { Text("下个任务试用（开发版）") }
                    }
                    TextButton(
                        enabled = !blocked,
                        onClick = {
                            if (runCatching { store.promote(skill.stableId, skill.version) }.getOrDefault(false)) {
                                Toast.makeText(context, "已采用，下一次任务会看到它", Toast.LENGTH_SHORT).show()
                                refresh()
                            } else {
                                Toast.makeText(context, "采用被门禁拒绝", Toast.LENGTH_SHORT).show()
                            }
                        },
                    ) { Text(if (blocked) "采用（已禁用）" else "采用") }
                    TextButton(onClick = { expanded = null }) { Text("保持候选") }
                    TextButton(onClick = {
                        if (runCatching { store.deleteCandidate(skill.stableId) }.getOrDefault(false)) refresh()
                    }) { Text("删除") }
                } else if (skill.source == "learned") {
                    TextButton(onClick = {
                        if (runCatching { store.rollback(skill.stableId) }.getOrDefault(false)) {
                            Toast.makeText(context, "已回退到上一个可用版本", Toast.LENGTH_SHORT).show()
                            refresh()
                        }
                    }) { Text("回退到上一版") }
                    TextButton(onClick = {
                        if (runCatching { store.rollback(skill.stableId, 1) }.getOrDefault(false)) {
                            Toast.makeText(context, "已回退到 v1", Toast.LENGTH_SHORT).show()
                            refresh()
                        }
                    }) { Text("回退到 v1") }
                    TextButton(onClick = {
                        if (runCatching { store.retire(skill.stableId) }.getOrDefault(false)) {
                            Toast.makeText(context, "已退休，下一次任务不再加载它", Toast.LENGTH_SHORT).show()
                            refresh()
                        }
                    }) { Text("退休") }
                }
            }
            if (expanded == key) {
                Text(skill.body, fontSize = 14.sp)
                Text("验证契约：${com.yinling.core.SkillValidation.contractHash(skill)}", fontSize = 12.sp)
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("技巧", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "模型从成功任务里总结出的流程先进入候选；采用后才会出现在 load_skill 里，可随时回退。" +
                "只有通过回归测试（没让旧任务变差、没有谎报）的候选才能点“采用”。" +
                "这里只存文字步骤，不存截图，也不自动执行关键操作。",
            fontSize = 15.sp,
        )

        Text("候选技巧", fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        TextButton(onClick = { importReport.launch("application/json") }) { Text("导入独立验证报告") }
        if (candidates.isEmpty()) {
            Text("暂无候选技巧。", fontSize = 15.sp, color = Color.DarkGray)
        }
        candidates.forEach { (_, versions) ->
            versions.sortedByDescending { it.version }.forEach { SkillCard(it, isCandidate = true) }
        }

        Text("当前生效的技巧", fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        active.forEach { (_, versions) ->
            versions.sortedByDescending { it.version }.forEach { SkillCard(it, isCandidate = false) }
        }
    }
}

private fun skillApplicabilityLine(skill: Skill): String =
    "适用：${skill.apps.joinToString("、").ifBlank { "通用" }} · 任务族 ${skill.goalFamily.ifBlank { "未定" }}"

private fun skillFixLine(skill: Skill): String =
    "它修好了：基线失败留档 ${skill.baselineRun.ifBlank { "无（还没有失败基线）" }}"

private fun skillRegressionLine(skill: Skill): String = when {
    skill.regressionResult == "fail" ->
        "这条技巧会让 ${skill.regressionSet.joinToString("、").ifBlank { "旧任务" }} 变差，不能采用"
    skill.regressionResult == "pass" ->
        "旧任务回归 ${skill.regressionSet.joinToString("、").ifBlank { "无" }}：仍通过"
    else -> "还没通过冻结任务集回归，不能采用"
}

private fun skillEvidenceLine(skill: Skill): String =
    "证据：成功留档 ${skill.evidenceRun.ifBlank { "无" }} · 独立验证 ${skill.verifiedRuns} 次"

private fun skillSafetyLine(skill: Skill): String = buildString {
    append("安全：禁做词 ${skill.forbidden.size} 个")
    if (skill.forbidden.isNotEmpty()) append("（${skill.forbidden.joinToString("、")}）")
    append(if (skill.falseDone == 0) " · 未出现谎报" else " · 出现过 ${skill.falseDone} 次谎报")
}
