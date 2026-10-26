# 银龄智办——可信跨应用助老智能体

Android 助老办事原型：老人用语音或文字提出目标，智能体结合无障碍页面和截图操作手机，并通过亲友服务登记求助、认领和留言。

**研究与比赛原型，未达到生产交付标准；不替代医疗监护，不提供亲友远程控制。** 求助登记不等于通知送达或家人接手，也未默认接通真实短信。

## 3PA 定位与边界

3PA（三平面可信执行架构）是运行时约束，不是语义正确性证明：
- **绑定面**：动作绑定观察到的页面版本，派发前检查页面与目标。
- **授权面**：普通导航和可撤销调节可继续；付款、发送、身份验证、删除等关键步骤交还本人。
- **证据面**：完成声明先经本地核验，再做模型复核；证据不足进入待核对，输入草稿不算独立完成证据。

风险规则不覆盖完整业务语义，页面事实不等于外部业务回执，像素变化也不等于成功。真机适配受控件树、输入法及后台策略影响；现有小样本工程验证不能代表老年用户试验或总体成功率。经验技巧需独立验证后由家人采用，不声称自动自进化。

模型请求可能发送页面文字和截图，语音代理会向语音提供方发送录音；局部脱敏不能全面覆盖敏感内容，本项目不是纯端侧、零数据出网方案。密钥、设备令牌和真实会话不得提交入库。

## 目录

| 目录 | 职责 |
|---|---|
| `app/` | Android UI、无障碍、语音、悬浮窗与会话适配 |
| `core/` | 纯 Kotlin 执行循环、核验、安全策略与技巧门禁 |
| `server/` | FastAPI + SQLite 亲友协作、语音代理与服务端测试 |
| `harness/` | JVM 循环、模型协议与本地 mock 回归 |
| `tasks/` | 真机任务、执行器、人工真值与技巧回放 |
| `scripts/` / `tools/` | 文案检查脚本 / 真机评测用测试替身，非产品组件 |
| `video/` | 演示视频工程与渲染工具 |
| `docs/` | 架构、审查、测试基线、参赛材料与历史归档 |
| `gradle/` | Gradle Wrapper |

## 启动与构建

需要 Python 3、JDK 17 和 Android SDK 35。以下从仓库根目录执行；先启动服务端：

```bash
(cd server &&
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt &&
(test -f .env || cp .env.example .env) &&
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8787)
```

语音听写需在 `server/.env` 配置凭证并重启服务；空配置可运行亲友服务。服务按单进程部署，非回环连接需 HTTPS，公开部署须配置注册口令，详见 [服务端说明](server/README.md)。

另开终端，在仓库根目录构建 Android 调试包：

```bash
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8787 tcp:8787
```

USB 调试时亲友服务地址填 `http://127.0.0.1:8787`。装机后配置模型端点、名称和 API Key，按引导授权无障碍、悬浮窗和录音；安全演示必须关闭自动确认。Release 缺少正式签名配置时生成未签名包，不能直接安装发布。

## 测试与文档

- 本地回归：`./gradlew :core:test`、`harness/run.sh`；服务端测试依赖及命令见 [服务端说明](server/README.md)。
- [验证基线](docs/testing/README.md) 记录结果和未验证项；JVM/mock 不覆盖真实控件树、触摸时序、输入法及设备后台行为。
- [真机任务与人在环要求](tasks/README.md)；仅查看清单、不连接设备：`python3 tasks/run.py --list`。
- [文档索引](docs/README.md) · [架构与信任边界](docs/architecture.md) · [技巧验证](docs/skill-validation.md) · [参赛材料](docs/aic-2026/README.md)。

许可证：[MIT License](LICENSE)。
