# 银龄智办——可信跨应用助老智能体

Android 助老办事原型：老人用语音或文字提出目标，智能体结合无障碍页面和截图操作手机；付款、发送、身份验证、删除等关键步骤交还本人，证据不足的完成声明进入待核对状态。

**当前定位：研究与比赛原型，不是已达到生产交付标准的产品。** 不替代医疗监护，不提供亲友远程控制。审查结论与未解决问题见 [2026-10-09 项目审查](docs/reviews/2026-10-09.md)。

## 能力与边界

| 能力 | 当前实现 | 边界 |
|---|---|---|
| 跨应用办事 | 纯 Kotlin 执行循环、工具调用、截图/无障碍观察、有限重试 | 真机适配受 App 控件树、输入法和 OEM 后台策略影响 |
| 分级执行 | 可逆动作自动执行；敏感动作拒绝并交还本人 | 词表和页面规则不是完整的业务语义风险识别 |
| 完成核验 | 机械一致性与本轮证据先行，通过后再调用模型复核 | 不等同于外部业务系统的成功回执；视觉事实核验仍有限 |
| 持续语音 | 录音、断句、语音听写代理、TTS、插话打断 | 需配置语音服务并在目标设备验证 |
| 亲友协作 | 配对、角色权限、求助认领、留言送达/已读、心跳失联检查 | 服务端通知目前只记录日志，不会自动发送真实短信 |
| 技能学习 | 成功确认后生成候选、家人审核启用、技能门禁与离线回放 | 尚未证明跨应用泛化，也不是无人监督的自动自进化 |

已留存的真机实验是小样本工程验证，不能当作老年用户试验或总体成功率。

## 目录

```text
app/        Android UI、无障碍、语音、悬浮窗与会话适配
core/       不依赖 Android 的执行循环、核验、安全策略与技能规则
server/     FastAPI + SQLite 亲友协作与语音代理；含服务端测试
harness/    JVM 协议/循环回归与本地 mock 提供方
tasks/      真机任务清单、执行器、真值记录与技能回放
docs/       架构、审查、测试基线、参赛材料和历史归档
gradle/     Gradle Wrapper
```

完整导航与文件维护规则见 [文档索引](docs/README.md)，执行路径见 [架构说明](docs/architecture.md)。

## 本地运行

### 1. 服务端

需要 Python、JDK 17；编译 Android 还需要 Android SDK 35。

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8787
```

在 `server/.env` 中填写语音服务配置；空配置允许亲友服务运行，但不能语音听写。密钥、设备令牌和真实会话不得入库。详细参数与部署限制见 [服务端说明](server/README.md)。

### 2. Android

```bash
./gradlew :app:assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8787 tcp:8787
```

在手机设置中配置模型端点、模型名称、API Key 和亲友服务地址 `http://127.0.0.1:8787`，按界面引导开启无障碍、悬浮窗和录音权限。真实安全演示必须关闭自动确认。

「家人设置」按家人与求助、语音与手机常驻、模型与隐私、技巧审核、高级调试分区。已有守护圈通过刷新邀请码邀请成员，不需要重新配对；联系人与模型设置分别保存，日志和演示自动确认独立控制。

非回环地址使用 HTTPS；当前 release 仍用 debug 签名，仅可用于本机验证，不作为正式发布包。

## 验证

```bash
./gradlew :core:test
harness/run.sh
server/.venv/bin/pip install -r server/requirements-dev.txt
server/.venv/bin/python -m pytest server/tests -q
./gradlew :app:assembleDebug :app:assembleRelease :app:lintDebug
```

可用 `ELDERHARNESS_OFFLINE=1 harness/run.sh` 使用已有依赖缓存。真机评测命令与人在环要求见 [任务说明](tasks/README.md)；不连接设备时可执行 `python3 tasks/run.py --list` 查看清单。

测试数量、回归输出和未验证项统一记录在 [验证基线](docs/testing/README.md)，不在多个入口重复维护数字。JVM/mock 测试不覆盖真实控件树、触摸时序、输入法和设备后台行为。

## 参赛与研究材料

- [参赛材料导航](docs/aic-2026/README.md)：方案 Markdown、23 页演示源文件、实验及构建步骤。
- `docs/aic-2026/提交-2026AIC/`：保留现有命名的最终计划书与答辩 PDF，不由构建脚本自动覆盖。
- `docs/aic-2026/refs/`：唯一一套参赛调研文本、文献抓取脚本与原始证据。
- `docs/archive/`：已被当前审查取代的工程记录和已删除视频工程的旧分镜；不是当前产品说明。

本项目采用 MIT License，见 [LICENSE](LICENSE)。
