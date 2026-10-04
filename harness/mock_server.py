#!/usr/bin/env python3
"""Mock OpenAI-compatible endpoint for the tool-calling loop.

Strictly validates the message sequence the way a real provider does. Any structural
violation comes back as HTTP 400 with a diagnostic, so an invalid transcript cannot pass.
"""
import json
import os, sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from collections import Counter

VALID_ROLES = {"system", "user", "assistant", "tool"}
problems = []
seen = {}
sizes = []

def validate(messages):
    errs = []
    if not messages or messages[0].get("role") != "system":
        errs.append("first message must be system")
    calls = {}
    for i, m in enumerate(messages):
        role = m.get("role")
        if role not in VALID_ROLES:
            errs.append(f"msg[{i}] bad role {role!r}")
        if role == "assistant":
            for tc in m.get("tool_calls") or []:
                cid = tc.get("id")
                if not cid:
                    errs.append(f"msg[{i}] assistant tool_call without id")
                calls[cid] = i
                fn = tc.get("function") or {}
                if not fn.get("name"):
                    errs.append(f"msg[{i}] tool_call without function name")
                try:
                    json.loads(fn.get("arguments") or "{}")
                except Exception:
                    errs.append(f"msg[{i}] tool_call arguments not valid JSON")
        if role == "tool":
            cid = m.get("tool_call_id")
            if cid not in calls:
                errs.append(f"msg[{i}] tool result references unknown tool_call_id {cid!r}")
            elif calls[cid] >= i:
                errs.append(f"msg[{i}] tool result precedes its assistant call")
        if role in ("system",) and i != 0:
            errs.append(f"msg[{i}] late system message")
    for cid, idx in calls.items():
        if not any(m.get("role") == "tool" and m.get("tool_call_id") == cid for m in messages):
            errs.append(f"tool_call {cid} (msg[{idx}]) has no tool result")
    return errs

def call(cid, name, **args):
    # The loop requires every screen-touching action to declare what it expects to happen (mechanism
    # A). This mock emulates a *compliant* model, so the scripted scenarios below stay about what they
    # are about; the dedicated scenario in Harness.kt omits the declaration to pin the refusal.
    if name in {"tap_text", "click", "long_press", "input_text", "scroll", "swipe",
                "tap_xy", "type_text", "paste_text"} and "expectedEffect" not in args:
        args["expectedEffect"] = "页面按预期发生变化"
    return {"id": cid, "type": "function",
            "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)}}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_sse(self, msg, usage=None):
        """The same reply as an event stream, fragmented the way a real provider fragments it.

        Content arrives two characters at a time and tool-call arguments three at a time, so the
        client has to accumulate across frames. A client that reassembles only the first fragment, or
        that keys calls by position instead of by index, fails here instead of on a real phone.
        """
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        def frame(delta, finish=None):
            obj = {"choices": [{"delta": delta, "index": 0, "finish_reason": finish}]}
            self.wfile.write(("data: " + json.dumps(obj, ensure_ascii=False) + "\n\n").encode())
            self.wfile.flush()

        content = msg.get("content") or ""
        for i in range(0, len(content), 2):
            frame({"content": content[i:i + 2]})
        for index, tc in enumerate(msg.get("tool_calls") or []):
            fn = tc.get("function") or {}
            frame({"tool_calls": [{"index": index, "id": tc.get("id"), "type": "function",
                                   "function": {"name": fn.get("name")}}]})
            args = fn.get("arguments") or "{}"
            for i in range(0, len(args), 3):
                frame({"tool_calls": [{"index": index, "function": {"arguments": args[i:i + 3]}}]})
        frame({}, finish="tool_calls" if msg.get("tool_calls") else "stop")
        if usage is not None:
            self.wfile.write(("data: " + json.dumps({"choices": [], "usage": usage}) + "\n\n").encode())
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()

    def do_POST(self):
        mode = self.headers.get("X-Mode", "normal")
        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length) or b"{}")
        messages = payload.get("messages") or []
        tools = payload.get("tools") or []
        errs = validate(messages)
        print(f"[server] mode={mode} msgs={len(messages)} tools={len(tools)} "
              f"roles={[m.get('role') for m in messages]}", flush=True)
        for e in errs:
            print(f"[server] STRUCTURE ERROR: {e}", flush=True)
        if errs:
            problems.append(errs)
            self.send_json(400, {"error": {"message": "; ".join(errs)}})
            return
        if not sizes:
            try:
                os.makedirs("/tmp/mockai", exist_ok=True)
                open("/tmp/mockai/payload.json","w").write(json.dumps(payload, ensure_ascii=False))
            except OSError:
                pass  # a diagnostic dump must never take the check run down with it
            sys_len = len(json.dumps(messages[0], ensure_ascii=False))
            tools_len = len(json.dumps(tools, ensure_ascii=False))
            body_len = len(json.dumps(payload, ensure_ascii=False))
            sys_txt = messages[0].get("content", "")
            print(f"[server] PAYLOAD total={body_len}B system={sys_len}B tools={tools_len}B msgs={len(messages)}", flush=True)
            print(f"[server] SYSTEM chars={len(sys_txt)} head={sys_txt[:90]!r}", flush=True)
            sizes.append(1)

        # The client asks for a stream; answering as one is how the streaming path gets exercised by
        # real scenarios rather than by a scenario that exists only to test streaming. The "claim"
        # mode deliberately answers in one piece instead, so the buffered fallback — the path a
        # proxy that swallows the stream leaves us with — stays in the regression suite too. Without
        # that split, enabling streaming would silently retire the fallback from all coverage.
        streaming = bool(payload.get("stream")) and mode != "claim"

        def reply(msg, usage=None):
            if streaming:
                self.send_sse(msg, usage)
            else:
                out = {"choices": [{"message": msg}]}
                if usage is not None:
                    out["usage"] = usage
                self.send_json(200, out)

        turns = sum(1 for m in messages if m.get("role") == "assistant")
        # Fail only the first attempt so the client's retry can be observed succeeding.
        seen[mode] = seen.get(mode, 0) + 1
        if mode == "retry" and seen[mode] == 1:
            print(f"[server] returning 503 for attempt {seen[mode]}", flush=True)
            self.send_json(503, {"error": {"message": "temporary"}})
            return

        if mode == "stall":
            # A provider that accepts the request and then goes quiet. Cancelling this is the case a
            # blocking read cannot handle on its own: the socket stays open and the client keeps
            # waiting (and paying) unless something closes the connection for it.
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            self.wfile.write(("data: " + json.dumps(
                {"choices": [{"delta": {"content": "我先"}, "index": 0, "finish_reason": None}]}) + "\n\n").encode())
            self.wfile.flush()
            time.sleep(60)
            return

        if mode == "claim":
            # A run that only looked at the screen, then claimed the work was done — the shape of
            # the real false success this check exists for.
            if turns == 0:
                msg = {"role": "assistant", "content": "我先看一下页面。",
                       "tool_calls": [call("c1", "scroll", target="0.5", argument="up")]}
            else:
                msg = {"role": "assistant",
                       "content": "已帮您把消息发出去了：聊天里已经有一条您发出的「我到家了」，"
                                  "时间是 00:01，发送成功。"}
            reply(msg, {"prompt_tokens": 10, "completion_tokens": 5})
            return

        if turns == 0:
            msg = {"role": "assistant", "content": "我先看一下页面。",
                   "tool_calls": [call("c1", "scroll", target="0.5", argument="up")]}
        elif turns == 1:
            msg = {"role": "assistant", "content": "同一次请求里做两件事。",
                   "tool_calls": [call("c2", "tap_text", argument="下一步"),
                                  call("c3", "scroll", target="0.5", argument="down")]}
        else:
            msg = {"role": "assistant", "content": "办好了，页面已经到第二步。"}
        reply(msg, {"prompt_tokens": 10, "completion_tokens": 5})

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8731
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"[server] listening on {port}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
