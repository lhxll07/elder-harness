# 验证基线

最新验证日期：2026-10-10；保留 2026-10-09 基线。基于现有本机依赖缓存；Python 3.14、JDK 17、Android SDK 35。原 README 中 109/149 等测试数量已过时，统一以本页注明日期的执行结果为准。

## 2026-10-10 家人端与设置重构

| 项目 | 命令或方式 | 结果 |
|---|---|---|
| 核心回归 | `./gradlew --offline :core:test` | 227 项通过；新增 5 项服务地址校验测试 |
| JVM/mock harness | `ELDERHARNESS_OFFLINE=1 harness/run.sh` | 208/208 断言通过；仍有既有 F5 词表边界发现 |
| 服务端 | `server/.venv/bin/python -m pytest server/tests -q` | 58 项通过；新增 17 项家人端专项回归 |
| Android 构建/静态检查 | `./gradlew --offline :app:assembleDebug :app:assembleRelease :app:lintDebug` | Debug/Release APK 与 Lint 成功；0 错误、10 警告、0 提示 |
| 网页布局 | Chromium 隔离配置与假数据，在 320/390/1440 px 设置实际视口 | 加入、家人、邻居、超长文本共 12 个布局检查无横向溢出；人工查看桌面与手机截图 |
| 修改检查 | 服务端 Python AST、`git diff --check` | 通过 |

专项回归覆盖网页与摘要 API 的角色过滤、私密背景和成员电话隔离、邻居认领范围、未知身份拒绝提权、旧求助不被最新记录挤掉、退出后旧 Cookie 失效、留言校验、提交与送达区分，以及修改老人称呼不破坏原配对和成员。

本次没有安装或操作真机，没有新增老年用户实验，没有真实模型、语音和短信供应商调用。Android 界面已通过编译和 Lint，但系统权限页返回、键盘、旋转与真实网络失败交互仍需在目标手机验收。Release 仍沿用现有调试签名，不等于正式发布验证。

F5 的 5/6 个设备或账户敏感动作漏拦未在此次家人端重构中修复；服务端仍出现 TestClient 弃用提醒。通知适配器仍只记日志，不把「页面能留言」写成「短信已接通」。

## 2026-10-09 基线

| 项目 | 命令 | 结果 |
|---|---|---|
| 核心回归 | `./gradlew --offline :core:test --rerun-tasks` | 222 项通过，0 失败/错误/跳过；本次强制重跑 |
| JVM/mock harness | `ELDERHARNESS_OFFLINE=1 harness/run.sh` | 208/208 断言通过；仍报告 1 项词表边界发现，见下文 |
| 服务端 | `server/.venv/bin/python -m pytest server/tests -q` | 41 项通过；原 38 项 + 3 项身份回归 |
| Android 构建/静态检查 | `./gradlew --offline :app:assembleDebug :app:assembleRelease :app:lintDebug` | Debug/Release APK 与 Lint 成功；0 错误、11 警告、1 条提示 |
| 答辩源、脚本与链接 | 拼接器隔离生成、Python AST、shell 语法、Markdown 本地链接检查 | 23 页、两份 HTML、9 个资源引用通过；24 个 Python、8 个 shell、59 个本地文档链接通过 |

报告 DOCX 在临时目录构建通过：57 张表、21 张图、91 条参考文献，全部在正文引用；5 张图表也在隔离目录生成通过。没有重建或覆盖两份冻结 PDF，没有执行会修改 LibreOffice 用户宏目录的报告 PDF 导出步骤。

`pip check` 无破损依赖，`pip install --dry-run --ignore-installed -r server/requirements-dev.txt` 完整解析通过；该步骤不安装或更新现有环境，也不等同于完成干净环境部署。`python3 tasks/run.py --list` 正常列出真机任务，不触发设备操作。

## 测试分层

执行 Gradle 时设置 `JAVA_HOME=/usr/lib/jvm/java-17-openjdk`。本机默认 JDK 为 25，不能把成功结果理解成 Gradle 8.10.2 已用默认 JDK 验证。

### 未被退出码覆盖的警告

- harness 的 F5 探针仍漏拦 5/6 个设备/账户敏感动作：关闭查找手机、允许安装未知应用、开启开发者选项、更换手机号、关闭定位服务。它被记录为发现，不计失败。
- Android 编译提示 `AccessibilityNodeInfo.recycle()` 已弃用；Lint 提示目标 SDK、内部 inset 资源、电池白名单、数据提取规则和旧 API 检查等。未在文件整理中扩大范围修复。
- 服务端测试出现 Starlette 对 httpx TestClient 的弃用提醒；本次保留现有测试栈，没有顺便迁移客户端。

### 覆盖范围

- `core/src/test/` 验证执行协议、核验、安全策略和技能规则；没有真实 Android 控件树。
- `harness/src/main/kotlin/Harness.kt` 运行真实 `AgentLoop` 和 `CloudPlanner`，对严格 mock 校验工具协议；其中“发现”是额外观察，不一定让进程失败，不能把进程退出 0 写成所有边界已修复。
- `server/tests/` 验证 API、角色、配对和 golden 观察规则；语音接口测试使用替身，不能证明真实供应商连接和听写质量。
- `tasks/` 是人在环的真机评测，`--yes` 下人工真值为未知；不能用系统自己说完成替代独立成功判定。

## 本次不声称验证的内容

没有新增真机任务、老年用户实验、线上语音服务调用、真实短信供应商或正式发布签名验证。本次构建使用现有缓存，不是干净系统上的完整依赖安装证明。

历史真机数据见 [2026-09-29 基线](device-baseline-2026-09-29.md) 和 [R1–R3 结果](../aic-2026/experiments/真机实验R1-R3-结果.md)。历史演示模式与生产确认模式必须分别解读。
