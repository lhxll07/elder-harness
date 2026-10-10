from __future__ import annotations

import html
import re
import time
from typing import Any

from .family_view import ROLE_LABEL, visible_circle, visible_events

KIND_LABEL = {
    "peace": "报平安", "help": "求助", "done": "办好了",
    "alert": "联系提醒", "message": "留言", "ack": "回应",
}


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
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f'<title>{escape(title)}</title><link rel="stylesheet" href="/static/family.css">'
        f'</head><body><main class="shell">{body}</main></body></html>'
    )


def join_page(error: str = "", code: str = "") -> str:
    error_html = f'<div class="notice danger" role="alert">{escape(error)}</div>' if error else ""
    return page("加入家人守护圈", f"""
<div class="join-layout">
  <section class="join-intro">
    <a class="brand" href="/">银龄智办 <span>家人端</span></a>
    <p class="eyebrow">可信的人，一起把事情接住</p>
    <h1>老人需要帮忙时，<br>这里有人回应。</h1>
    <p class="lead">查看联系状态、接手求助、给老人留一句话。不用安装新的应用，也不能远程控制老人手机。</p>
    <ol class="steps"><li>在老人手机打开「家人设置 → 家人与求助」</li><li>请装机家人选择你的身份，生成邀请码</li><li>输入邀请码，加入对应的守护圈</li></ol>
    <p class="muted">邀请码是临时凭证，只交给真正可信的人。</p>
  </section>
  <section class="panel join-form" aria-labelledby="join-title">
    <p class="eyebrow">首次加入</p><h2 id="join-title">连接老人和家人</h2>
    {error_html}
    <form method="post" action="/join">
      <label for="pair-code">邀请码</label>
      <input id="pair-code" name="pair_code" value="{escape(code)}" maxlength="8" minlength="8" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="老人手机上的 8 位邀请码" required>
      <label for="member-name">你的称呼</label>
      <input id="member-name" name="name" maxlength="24" autocomplete="name" placeholder="例如：大女儿、张网格员" required>
      <label for="member-phone">联系电话 <span class="muted">选填</span></label>
      <input id="member-phone" name="phone" type="tel" maxlength="20" autocomplete="tel" placeholder="便于可信的人联系你">
      <button class="button full" type="submit">加入守护圈</button>
    </form>
    <p class="muted">身份由邀请码决定，不能在这里选择或提高权限。当前服务端通知仅记录日志，不会自动发送真实短信。</p>
  </section>
</div>
"""
    )


def receipt(event: dict[str, Any]) -> str:
    if event["direction"] != "to_device" or event["kind"] not in ("message", "ack"):
        return ""
    if event.get("read_at"):
        return f'<p class="receipt good">老人已看到 · {clock(event["read_at"])}</p>'
    if event.get("delivered_at") or event.get("delivered"):
        when = f' · {clock(event["delivered_at"])}' if event.get("delivered_at") else ""
        return f'<p class="receipt">已到手机{when}，尚未确认已读</p>'
    return '<p class="receipt pending">等待老人手机收取</p>'


def event_card(event: dict[str, Any], members: dict[int, dict[str, Any]], actionable: bool = False) -> str:
    kind = KIND_LABEL.get(event["kind"], event["kind"])
    context = f'<details class="context"><summary>查看求助背景</summary><p>{escape(event["context"])}</p></details>' if event.get("context") else ""
    body = f'<p class="event-body">{escape(event["body"])}</p>' if event.get("body") else ""
    claim = ""
    action = ""
    if event["status"] == "claimed":
        member = members.get(event.get("claimed_by"), {})
        claim = f'<p class="receipt good">{escape(member.get("name", "有人"))} 已经接手 · {clock(event.get("claimed_at") or 0)}</p>'
    elif actionable:
        action = f'<form method="post" action="/family/claim/{int(event["id"])}"><button class="button" type="submit">我来处理</button></form>'
    return f"""
<article class="event-card">
  <div class="event-meta"><span class="badge">{escape(kind)}</span><time>{clock(event['created_at'])}</time></div>
  <h3>{escape(event['title'])}</h3>{body}{context}{claim}{receipt(event)}{action}
</article>
"""


def contact_status(device: dict[str, Any], silence_seconds: int) -> tuple[str, str, str]:
    last_seen = device.get("last_seen_at")
    if last_seen is None:
        return "pending", "还没有收到手机联系", "请确认老人手机已完成配对，并开启常驻服务。"
    age = max(0, time.time() - last_seen)
    if age >= silence_seconds:
        return "danger", f"手机 {human_age(age)}联系过", "手机可能没电、断网或应用被系统关闭。先打个电话确认，不代表老人发生危险。"
    tone = "pending" if age >= silence_seconds / 3 else "good"
    return tone, f"手机 {human_age(age)}联系过", "这里只反映设备联系情况，不是健康监测，也不表示老人已经读到留言。"


def dashboard(
    member: dict[str, Any],
    device: dict[str, Any],
    events: list[dict[str, Any]],
    circle: list[dict[str, Any]],
    silence_seconds: int,
    flash: str = "",
    requests: list[dict[str, Any]] | None = None,
) -> str:
    role = member["role"]
    shown = visible_events(events, role)
    visible_requests = visible_events(requests if requests is not None else events, role)
    contacts = visible_circle(circle, role)
    members = {contact["id"]: contact for contact in contacts}
    pending = [event for event in visible_requests if event["kind"] in ("help", "alert") and event["status"] == "new"]
    claimed = [event for event in visible_requests if event["kind"] in ("help", "alert") and event["status"] == "claimed"]
    tone, status, detail = contact_status(device, silence_seconds)
    pending_html = "".join(event_card(event, members, actionable=True) for event in pending) or '<div class="empty">现在没有需要处理的求助。<span>收到新求助后，会显示在这里。</span></div>'
    claimed_html = "".join(event_card(event, members) for event in claimed) or '<div class="empty">暂无正在处理的求助。</div>'
    history_html = "".join(event_card(event, members) for event in shown[:30]) or '<div class="empty">还没有记录。手机联系和求助记录会显示在这里。</div>'
    flash_html = f'<div class="notice" role="status">{escape(flash)}</div>' if flash else ""
    message_link = '<a href="#message">给老人留言</a>' if role == "family" else ""
    message_html = """
<section class="panel" id="message" aria-labelledby="message-title">
  <div class="section-heading"><div><p class="eyebrow">只有家人可用</p><h2 id="message-title">给老人留一句话</h2></div></div>
  <form method="post" action="/family/message">
    <label for="message-text">留言内容</label>
    <textarea id="message-text" name="text" maxlength="500" rows="4" placeholder="例如：明天下午我来看你，不用着急。" required></textarea>
    <p class="muted">提交后等待手机收取，再显示成大字并播报。只有老人确认后才标为已读。</p>
    <button class="button" type="submit">提交留言</button>
  </form>
</section>
""" if role == "family" else '<section class="panel"><h2>你的协作范围</h2><p class="muted">你可以查看并接手权限范围内的求助。留言仅对家人开放，老人办事的私密背景不会显示给你。</p></section>'
    contact_cards = []
    for contact in contacts:
        phone = contact.get("phone", "")
        phone_html = f'<a class="contact-phone" href="tel:{escape(phone)}">{escape(phone)}</a>' if phone and re.fullmatch(r"[+0-9 ()-]{3,24}", phone) else ""
        contact_cards.append(f'<li><div><strong>{escape(contact["name"])}</strong><span>{escape(ROLE_LABEL.get(contact["role"], ""))}</span></div>{phone_html}</li>')
    contact_html = "".join(contact_cards)
    return page(f"{device['elder_name'] or '老人'} · 家人守护圈", f"""
<header class="topbar"><a class="brand" href="/family">银龄智办 <span>家人端</span></a><div class="session"><span>{escape(member['name'])} · {escape(ROLE_LABEL.get(role, ''))}</span><form method="post" action="/family/logout"><button class="text-button" type="submit">退出</button></form></div></header>
<section class="hero"><div><p class="eyebrow">家人守护圈</p><h1>{escape(device['elder_name'] or '老人')}的近况</h1><p class="lead">先看是否需要回应，再看事情进展。</p></div><a class="button secondary" href="/family">刷新近况</a></section>
<nav class="page-nav" aria-label="家人端分区"><a href="#requests">待接手求助</a><a href="#follow-up">处理进展</a>{message_link}<a href="#activity">最近记录</a></nav>
{flash_html}
<section class="overview" aria-label="联系与求助概览"><article class="status-card {tone}"><p class="eyebrow">手机联系</p><h2>{status}</h2><p>{detail}</p></article><article class="stat-card"><span>待接手</span><strong>{len(pending)}</strong><a href="#requests">查看求助</a></article><article class="stat-card"><span>已接手，待跟进</span><strong>{len(claimed)}</strong><a href="#follow-up">查看进展</a></article></section>
<div class="dashboard-grid"><div class="primary-column">
  <section class="panel" id="requests" aria-labelledby="requests-title"><div class="section-heading"><div><p class="eyebrow">优先回应</p><h2 id="requests-title">需要处理的求助</h2></div><span class="badge">{len(pending)} 条待接手</span></div>{pending_html}</section>
  <section class="panel" id="follow-up"><h2>正在处理</h2><p class="muted">“接手”表示有人回应，不等于事情已经办好。</p>{claimed_html}</section>
  <section class="panel" id="activity"><h2>最近发生的事</h2><p class="muted">显示你有权查看的最近记录；留言送达与已读分开记录。</p>{history_html}</section>
</div><aside class="side-column">{message_html}<section class="panel"><h2>可信的人</h2><ul class="contacts">{contact_html}</ul><p class="muted">身份由老人手机上的邀请决定。当前通知只记日志，不能代替主动联系。</p></section></aside></div>
<footer>不提供远程控制。家人可查看求助背景，社区和邻居只能看到各自权限范围的记录。</footer>
"""
    )
