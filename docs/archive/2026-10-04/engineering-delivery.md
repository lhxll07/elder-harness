# 2026-10-04 机制与一致性修复合并记录

本文件合并原《交付-机制ABC-实现与验证》和《交付-三处一致性缺陷修复》，保留设计结论；历史测试计数不作为当前验证基线。

## 执行机制

- **动作影响声明**：模型对屏幕动作声明预期影响；`ActionEffect` 表达 `CHANGED / NO_EFFECT / UNKNOWN`，不把 API 返回成功等同于实际页面已改变。
- **有限升级阶梯**：记录已经尝试的动作与无变化结果，限制等候、截图、重试和换路径的预算，避免遇到卡点无限重做。
- **可用控件机会**：当完成证据缺失且仍有未尝试的相关控件时，只给予一次受控补查机会；感知盲区或明确矛盾不触发自动重试。

## 三处一致性结论

1. **缺口原因是类型而不是文案**：以 `EvidenceGap` 区分世界状态未观察、感知盲区和冲突，决策不依赖中文提示词是否包含某个短语。
2. **观察口径跨语言一致**：技能 `requires` 使用去掉提示和应用清单装饰后的页面观察；Kotlin 与 Python 回放器读同一份 golden，且测试比较标记列表。
3. **影响命名保持一致**：`ActionEffect` 是执行结果信息，不是独立的“办成证明”；界面、日志和核验不能将 `NO_EFFECT` 解释成成功。

## 保留的验收锚点

- `core/src/test/kotlin/com/yinling/core/ActionEffectTest.kt`
- `core/src/test/kotlin/com/yinling/core/EscalationLadderTest.kt`
- `core/src/test/kotlin/com/yinling/core/EvidenceGapSourceTest.kt`
- `core/src/test/kotlin/com/yinling/core/SkillObservationGoldenTest.kt`
- `core/src/test/resources/skill_observation_golden.tsv`
- `server/tests/test_skill_observation_golden.py`
- `harness/src/main/kotlin/Harness.kt`

本次目录调整不更改上述协议与规则实现。当前风险与验证结果见 [2026-10-09 审查](../../reviews/2026-10-09.md) 和 [验证基线](../../testing/README.md)。
