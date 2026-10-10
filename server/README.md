# 银龄专线 · 可信圈子服务端（M1）

老人手机上报"发生了什么"，家人/社区/邻居**打开一条链接**就能看到、并能接手。老人手机上
不需要额外权限（不再需要读短信），家人也不需要装任何东西。

## 本地跑起来

```bash
cd server
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8787
```

网页入口：<http://127.0.0.1:8787/>（邀请码在老人手机的「家人设置 → 家人与求助」里）。

测试：

```bash
cd server
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests -q
```

环境变量（都有默认值，测试会覆盖）：

| 变量 | 默认 | 含义 |
|---|---|---|
| `HOTLINE_DB` | `server/hotline.db` | SQLite 文件位置 |
| `HOTLINE_HEARTBEAT_SECONDS` | 300 | 手机应多久报到一次 |
| `HOTLINE_SILENCE_SECONDS` | 21600（6 小时）| 安静多久算异常，通知圈子 |
| `HOTLINE_PAIR_TTL_SECONDS` | 3600（1 小时）| 配对码有效期；过期后用设备端 `/api/device/invite` 刷新，避免新建设备 |
| `HOTLINE_WATCH_TOKEN` | empty (disabled) | Independent Bearer token for `/api/watch/check` |
| `HOTLINE_JOIN_WINDOW_SECONDS` / `HOTLINE_JOIN_MAX_FAILURES` | 600 / 5 | 单进程内的配对码失败限速 |
| `XFYUN_APP_ID` / `XFYUN_API_KEY` / `XFYUN_API_SECRET` | 空 | 讯飞语音服务凭证；未配置时不提供听写 |
| `XFYUN_IAT_STYLE` | classic | 听写协议，`classic` 或 `new` |

## 接口

| 方法 | 路径 | 谁用 | 作用 |
|---|---|---|---|
| POST | `/api/device/pair` | 家人装机时 | 换回设备令牌 + 配对码 |
| POST | `/api/device/invite` | 已配对手机 | 刷新指定角色的邀请码，不新建设备 |
| POST | `/api/device/profile` | 已配对手机 | 修改老人称呼，保留设备身份和守护圈 |
| POST | `/api/device/heartbeat` | 老人手机 | 报到（证明活着）+ 取回要显示的消息 |
| POST | `/api/device/ack` | 老人手机 | 确认消息已显示或已读 |
| POST | `/api/device/events` | 老人手机 | 上报 `peace` / `help` / `done` / `alert` |
| POST | `/api/device/transcribe` | 老人手机 | 上传 PCM 录音，返回听写文本 |
| GET | `/api/health` / `/api/speech/status` | 本地诊断 | 服务状态和语音是否配置 |
| GET | `/` `/family` | 圈子 | 加入页 / 情况页 |
| POST | `/join` | 圈子 | 用配对码加入（记住身份与角色）|
| POST | `/family/claim/{id}` | 圈子 | 接手一条求助（同时给老人手机回一句"我来处理"）|
| POST | `/family/message` | **仅家人** | 给老人留一句话（老人手机大字 + 语音）|
| POST | `/family/logout` | 圈子 | 撤销当前服务端会话并清除 Cookie |
| GET | `/api/devices/{id}/summary` | 当前设备的圈子 | 与网页共用角色过滤，非家人不返回背景或成员电话 |
| POST | `/api/watch/check` | 定时/测试 | 手动触发"失联"检查 |

设备端用 `Authorization: Bearer <token>`；圈子成员用会话 Cookie。

## 三条设计规矩

1. **角色决定能看到什么**（服务端过滤，不是前端隐藏）：家人看全部；社区看求助与异常；
   邻居只在需要人上门时看到求助。**"老人在做什么"这类上下文只给家人**——页面文字里可能有
   姓名、地址、验证码。
2. **只有家人能给老人留话**。那个渠道在老人手机上读起来是"熟悉的人在说话"，不能让名单外
   的人借用（社区成员的留言请求返回 403）。
3. **失联是服务端唯一的独占职责**：手机关机、没电、被杀，它自己说不出话；"一直没心跳"
   只有这里能发现。一次中断只提醒一次，且措辞是"可能只是没电/关机"，不是"出事了"。

邀请码绑定角色；同一手机号已有另一种角色时不能复用其成员身份，否则低权限邀请码会借到家人会话。

### 家人页面

页面按「手机联系 → 待接手求助 → 处理进展 → 最近记录」组织；家人可从分区导航直达留言，手机与桌面使用同一套响应式 HTML/CSS，不引入前端运行时。

求助接手不等于办好；留言提交不等于送达。手机确认展示后才显示「已到手机」，老人确认后才显示「已读」。尚未处理的求助单独查询，不会被最近记录的数量上限挤掉。页面与摘要 API 返回 `Cache-Control: no-store`，退出会删除当前会话，旧 Cookie 无法复用。

代码边界：`main.py` 保留设备、加入和语音入口；`family.py` 承担家人业务路由，`family_view.py` 统一权限，`web.py` 渲染页面，`static/family.css` 管理样式。专项回归位于 `tests/test_family.py`。

## 部署限制

- 运行依赖与开发依赖分开；语音连接直接依赖 `websockets`，不能假设基础 `uvicorn` 会自动安装它。
- 当前按单进程设计：配对码失败限速保存在进程内，watcher 随服务进程启动，不直接启用多 worker。
- 公网或局域网部署需 HTTPS、入口防护和凭证管理；`/api/device/pair` 目前没有安装者认证或配额，不应直接裸露到公网。
- 服务端支持退出撤销当前会话，但尚无管理员批量撤销和数据库会话过期检查；日志含事件、语音片段与通知号码，上线前需脱敏和生命周期治理。
- 测试数字和审查清单统一见 [验证基线](../docs/testing/README.md) 与 [项目审查](../docs/reviews/2026-10-09.md)。

## M1 的边界（故意不做的）

- **不发短信**：`notify.py` 现在只写日志。真实短信需要服务商、签名与模板审核（国内要几天），
  接口形状已经留好，M2 换实现即可
- **没有账号密码**：设备用令牌，家人用配对码换会话；没有找回密码、没有多设备管理
- **没有派单/值班**：社区的路由、认领超时升级属于 M3
- **不做远程控制**：只给状态和请求。远程协助/屏幕共享正是我们要防的诈骗手法
