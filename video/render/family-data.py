import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "server"))
from app.web import dashboard

now = time.time()
member = {"id": 1, "role": "family", "name": "女儿 · 示例"}
device = {"elder_name": "刘阿姨", "last_seen_at": now - 12}
circle = [member, {"id": 2, "role": "community", "name": "社区联系人"}, {"id": 3, "role": "neighbor", "name": "可信邻居"}]
help_event = {
    "id": 1, "direction": "from_device", "kind": "help", "status": "new",
    "title": "想核对上次复诊医生", "body": "本人说：不记得了，问问女儿。",
    "context": "正在预约普通内科复诊。医生尚未选择，任务已经停下，等本人确认后才继续。",
    "created_at": now - 60,
}
message = {
    "id": 2, "direction": "to_device", "kind": "message", "status": "new",
    "title": "家人留言", "body": "上次看的是陈医生。您再核对一下就诊记录。",
    "context": "", "created_at": now,
}
pages = {}
pages["overview"] = dashboard(member, device, [help_event], circle, 3600, requests=[help_event])
claimed = {**help_event, "status": "claimed", "claimed_by": 1, "claimed_at": now}
pages["compose"] = dashboard(member, device, [claimed], circle, 3600, requests=[claimed])
for status in ("submitted", "delivered", "read"):
    event = {**message}
    if status in ("delivered", "read"):
        event["delivered_at"] = now + 1
    if status == "read":
        event["read_at"] = now + 2
    pages[status] = dashboard(member, device, [event, claimed], circle, 3600, requests=[claimed])
print(json.dumps(pages, ensure_ascii=False))
