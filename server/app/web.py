"""Server-rendered pages for the trusted circle.

A web page rather than an app on purpose: a family member, a grid worker or a neighbour gets a link
in a text message and is looking at the situation ten seconds later, on whatever phone they already
have. Nothing to install, nothing to approve.

Everything shown here is filtered by role. "Trusted" is not a single blob of access: a community
worker needs to know that help is wanted, not what the person was typing.
"""

from __future__ import annotations

import html
import time
from typing import Any

KIND_LABEL = {
    "peace": "报平安",
    "help": "求助",
    "done": "办好了",
    "alert": "异常",
    "message": "留言",
    "ack": "回应",
}

# What each role may see in the timeline.
VISIBLE_KINDS = {
    "family": {"peace", "help", "done", "alert", "message", "ack"},
    "community": {"help", "alert", "ack"},
    "neighbor": {"help"},
}

ROLE_LABEL = {"family": "家人", "community": "社区", "neighbor": "邻居"}

STYLE = """
body { font-family: -apple-system, "Noto Sans CJK SC", sans-serif; margin: 0; padding: 18px;
       background: #f6f7f8; color: #17202a; line-height: 1.6; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 26px 0 8px; }
.card { background: #fff; border-radius: 12px; padding: 14px 16px; margin: 10px 0;
        box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.muted { color: #5d6d7e; font-size: 14px; }
.warn { color: #b9770e; font-weight: 600; }
.bad { color: #c0392b; font-weight: 600; }
.ok { color: #1e8449; font-weight: 600; }
button, .button { font-size: 17px; padding: 10px 16px; border-radius: 10px; border: 0;
        background: #1a7f6b; color: #fff; font-weight: 600; }
input, select { font-size: 17px; padding: 10px; border-radius: 8px; border: 1px solid #ccd1d6;
        width: 100%; box-sizing: border-box; margin: 4px 0 12px; }
label { font-size: 15px; font-weight: 600; }
ul { padding-left: 18px; margin: 6px 0; }
.kind { display: inline-block; font-size: 13px; padding: 1px 8px; border-radius: 20px;
        background: #eaeef0; color: #34495e; margin-right: 6px; }
.claimed { background: #fdf3e3; }
.ctx { background: #f4f6f7; border-left: 3px solid #b3bec4; padding: 6px 10px; margin: 8px 0;
       font-size: 14px; color: #34495e; white-space: pre-wrap; }
"""


def escape(value: Any) -> str:
    return html.escape("" if value is None else str(value))


def human_age(seconds: float) -> str:
    seconds = max(0, int(seconds))
    if seconds < 90:
        return "刚刚"
    if seconds < 3600:
        return f"{seconds // 60} 分钟前"
    if seconds < 86400 * 2:
        return f"{seconds // 3600} 小时前"
    return f"{seconds // 86400} 天前"


def clock(when: float) -> str:
    return time.strftime("%m-%d %H:%M", time.localtime(when))


def page(title: str, body: str) -> str:
    return (
        "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        f"<title>{escape(title)}</title><style>{STYLE}</style></head><body>{body}</body></html>"
    )


def join_page(error: str = "", code: str = "") -> str:
    error_html = f"<div class='card bad'>{escape(error)}</div>" if error else ""
    body = f"""
<h1>银龄专线 · 加入可信的人</h1>
<p class="muted">配对码显示在老人手机的「设置 → 家人与社区」里。</p>
{error_html}
<form method="post" action="/join">
  <div class="card">
    <label>配对码</label>
    <input name="pair_code" value="{escape(code)}" maxlength="8" autocapitalize="characters" required>
    <label>你的称呼（老人看到的名字）</label>
    <input name="name" placeholder="例如：大女儿 / 张网格员" required>
    <label>手机号（用于有事时通知你）</label>
    <input name="phone" inputmode="tel" placeholder="选填，但建议填">
    <button type="submit">加入</button>
  </div>
</form>
<p class="muted">你的身份由发给你配对码的人决定：码是「家人」就是家人，是「社区」就只能看到求助与异常。
请只让真正可信的人看到这个码。</p>
"""
    return page("加入可信的人", body)


def dashboard(
    member: dict[str, Any],
    device: dict[str, Any],
    events: list[dict[str, Any]],
    circle: list[dict[str, Any]],
    silence_seconds: int,
    flash: str = "",
) -> str:
    now = time.time()
    role = member["role"]
    last_seen = device.get("last_seen_at")
    if last_seen is None:
        status = "<span class='muted'>还没有联系过（手机上的 App 还没配对成功）</span>"
    else:
        age = now - last_seen
        css = "bad" if age >= silence_seconds else ("warn" if age >= silence_seconds / 3 else "ok")
        status = f"<span class='{css}'>手机 {human_age(age)}联系过</span>"

    visible = VISIBLE_KINDS.get(role, set())
    shown = [event for event in events if event["kind"] in visible]
    open_help = [event for event in shown if event["kind"] in ("help", "alert") and event["status"] == "new"]
    claimed = [event for event in shown if event["kind"] in ("help", "alert") and event["status"] == "claimed"]

    def render_event(event: dict[str, Any]) -> str:
        label = KIND_LABEL.get(event["kind"], event["kind"])
        extra = ""
        if event["kind"] in ("help", "alert") and event["status"] == "claimed":
            claimer = next((m for m in circle if m["id"] == event["claimed_by"]), None)
            who = claimer["name"] if claimer else "有人"
            extra = f"<div class='muted'>👌 {escape(who)} 已经接手（{clock(event['claimed_at'] or 0)}）</div>"
        # Community and neighbours see that help is wanted, not what the person was doing.
        context = ""
        if event["context"] and role == "family":
            context = f"<div class='ctx'>{escape(event['context'])}</div>"
        body_html = f"<div>{escape(event['body'])}</div>" if event["body"] else ""
        receipt = ""
        if event["direction"] == "to_device" and event["kind"] in ("message", "ack"):
            if event["read_at"]:
                receipt = f"<div class='muted ok'>老人已看到 {clock(event['read_at'])}</div>"
            elif event["delivered_at"] or event["delivered"]:
                when = f" {clock(event['delivered_at'])}" if event["delivered_at"] else ""
                receipt = f"<div class='muted'>已到手机{when}</div>"
            else:
                receipt = "<div class='muted'>等待老人手机收取</div>"
        return (
            f"<div class='card {'claimed' if event['status'] == 'claimed' else ''}'>"
            f"<span class='kind'>{escape(label)}</span>"
            f"<span class='muted'>{clock(event['created_at'])}</span>"
            f"<div><b>{escape(event['title'])}</b></div>"
            f"{body_html}{context}{receipt}{extra}</div>"
        )

    help_html = "".join(
        f"<div class='card'><span class='kind'>求助</span>"
        f"<span class='muted'>{clock(event['created_at'])}</span>"
        f"<div><b>{escape(event['title'])}</b></div>"
        f"<div>{escape(event['body'])}</div>"
        + (f"<div class='ctx'>{escape(event['context'])}</div>" if event["context"] and role == "family" else "")
        + f"<form method='post' action='/family/claim/{event['id']}'>"
        f"<button type='submit'>我来处理</button></form></div>"
        for event in open_help
    ) or "<div class='card muted'>现在没有需要处理的求助。</div>"

    message_form = ""
    if role == "family":
        message_form = """
<h2>给老人留一句话</h2>
<form method="post" action="/family/message">
  <div class="card">
    <input name="text" placeholder="例如：明天下午我来看你" required>
    <button type="submit">发到老人手机上</button>
    <p class="muted">会显示成大字，并用语音念出来。</p>
  </div>
</form>
"""

    members_html = "".join(
        f"<li>{escape(m['name'])}（{escape(ROLE_LABEL.get(m['role'], m['role']))}）</li>" for m in circle
    )

    flash_html = f"<div class='card ok'>{escape(flash)}</div>" if flash else ""

    body = f"""
<h1>{escape(device['elder_name'] or '老人')}</h1>
<div class="muted">{status} · 我是 {escape(member['name'])}（{escape(ROLE_LABEL.get(role, role))}）</div>
{flash_html}

<h2>需要处理的求助</h2>
{help_html}

<h2>最近发生的事</h2>
{''.join(render_event(event) for event in shown[:30]) or "<div class='card muted'>还没有记录。</div>"}

{message_form}

<h2>可信的人</h2>
<div class="card"><ul>{members_html}</ul>
<p class="muted">只有名单里的人能收到通知、能为老人处理事情。名单之外的人说什么都不算。</p></div>

<p class="muted">这一页只显示状态和求助，不显示老人屏幕上的内容。</p>
"""
    return page(f"{device['elder_name'] or '老人'} · 银龄专线", body)
