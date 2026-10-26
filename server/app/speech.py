"""Speech to text, through iFlytek's real-time dictation (IAT).

Runs on the server rather than on the phone for two reasons: the iFlytek credentials never end up
inside an APK anyone can unpack, and the recogniser can be exercised from a terminal without a phone
in the loop (which is how this was verified: `espeak-ng` speaks a sentence, iFlytek transcribes it).

Two protocol styles exist and the account decides which one answers:

* ``classic`` — ``wss://iat-api.xfyun.cn/v2/iat`` with ``common``/``business``/``data`` frames. This
  is the one the credentials here are enabled for; the newer style answered ``10404 no category
  route found``.
* ``new`` — ``wss://iat.cn-huabei-1.xf-yun.com/v1`` with ``header``/``parameter``/``payload``.

Both are implemented because switching accounts should be one environment variable, not a rewrite.
Audio is raw little-endian PCM, 16 kHz, 16-bit, mono, in ~1024-byte frames: ``status`` 0 first,
1 middle, 2 last.
"""

from __future__ import annotations

import asyncio
import base64
import datetime
import hashlib
import hmac
import json
import logging
import os
import urllib.parse

log = logging.getLogger("hotline.speech")

SAMPLE_RATE = 16000
FRAME_BYTES = 1024
FRAME_SECONDS = 0.04

# iFlytek rejects a request whose clock is more than 300s off, so a wrong system clock shows up as a
# failed handshake rather than as bad audio.
MAX_AUDIO_SECONDS = 60

STYLE_CLASSIC = "classic"
STYLE_NEW = "new"


class SpeechError(RuntimeError):
    """Anything that stops a transcription, with a message a person could be shown."""


def credentials() -> tuple[str, str, str]:
    return (
        os.environ.get("XFYUN_APP_ID", ""),
        os.environ.get("XFYUN_API_KEY", ""),
        os.environ.get("XFYUN_API_SECRET", ""),
    )


def is_configured() -> bool:
    app_id, api_key, api_secret = credentials()
    return bool(app_id and api_key and api_secret)


def style() -> str:
    return os.environ.get("XFYUN_IAT_STYLE", STYLE_CLASSIC).strip().lower()


def _hosts() -> tuple[str, str, str]:
    if style() == STYLE_NEW:
        return "iat.cn-huabei-1.xf-yun.com", "/v1", STYLE_NEW
    return "iat-api.xfyun.cn", "/v2/iat", STYLE_CLASSIC


def _auth_url(host: str, path: str, api_key: str, api_secret: str) -> str:
    date = datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
    signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
    signature = base64.b64encode(
        hmac.new(api_secret.encode(), signature_origin.encode(), hashlib.sha256).digest(),
    ).decode()
    authorization_origin = (
        f'api_key="{api_key}",algorithm="hmac-sha256",headers="host date request-line",'
        f'signature="{signature}"'
    )
    authorization = base64.b64encode(authorization_origin.encode()).decode()
    query = urllib.parse.urlencode({"host": host, "date": date, "authorization": authorization})
    return f"wss://{host}{path}?{query}"


def frame_for(
    style_name: str,
    app_id: str,
    chunk: bytes,
    status: int,
    seq: int,
    keyterms: list[str] | None = None,
) -> str:
    """Builds one request frame. Pure function so it can be tested without a socket."""
    audio = base64.b64encode(chunk).decode()
    if style_name == STYLE_NEW:
        iat: dict[str, object] = {
            "domain": "iat",
            "language": "zh_cn",
            "accent": "mandarin",
            "eos": 3000,
            "result": {"encoding": "utf8", "compress": "raw", "format": "json"},
        }
        if keyterms:
            iat["context"] = json.dumps({"dhw": ",".join(keyterms[:50])}, ensure_ascii=False)
        return json.dumps({
            "header": {"app_id": app_id, "status": status},
            "parameter": {"iat": iat},
            "payload": {
                "audio": {
                    "encoding": "raw",
                    "sample_rate": SAMPLE_RATE,
                    "channels": 1,
                    "bit_depth": 16,
                    "seq": seq,
                    "status": status,
                    "audio": audio,
                },
            },
        })

    business: dict[str, object] = {
        "domain": "iat",
        "language": "zh_cn",
        "accent": "mandarin",
        "vad_eos": 3000,
        # Dynamic correction: results may be revised as more audio arrives, so the newest text wins.
        "dwa": "wpgs",
    }
    if keyterms:
        business["dhw"] = ",".join(keyterms[:50])
    return json.dumps({
        "common": {"app_id": app_id},
        "business": business,
        "data": {
            "status": status,
            "format": f"audio/L16;rate={SAMPLE_RATE}",
            "encoding": "raw",
            "audio": audio,
        },
    })


def text_of(style_name: str, message: dict) -> str | None:
    """Extracts recognised text from one response message, or None when it carries none."""
    if style_name == STYLE_NEW:
        header = message.get("header") or {}
        if header.get("code") not in (0, None):
            raise SpeechError(f"语音识别返回错误 {header.get('code')}：{header.get('message', '')}")
        payload = (message.get("payload") or {}).get("result") or {}
        raw = payload.get("text")
        if not raw:
            return None
        try:
            decoded = json.loads(base64.b64decode(raw))
        except Exception:
            return None
        return _join_words(decoded) or None

    code = message.get("code")
    if code not in (0, None):
        raise SpeechError(f"语音识别返回错误 {code}：{message.get('message', '')}")
    result = (message.get("data") or {}).get("result")
    if not result:
        return None
    return _join_words(result) or None


def _join_words(result: dict) -> str:
    return "".join(
        candidate.get("w", "")
        for segment in result.get("ws", [])
        for candidate in segment.get("cw", [])
    )


def finished(style_name: str, message: dict) -> bool:
    if style_name == STYLE_NEW:
        return (message.get("header") or {}).get("status") == 2
    return (message.get("data") or {}).get("status") == 2


async def transcribe(pcm: bytes, *, keyterms: list[str] | None = None) -> str:
    """Transcribes 16 kHz mono PCM. Returns the text, or raises [SpeechError]."""
    import websockets

    app_id, api_key, api_secret = credentials()
    if not (app_id and api_key and api_secret):
        raise SpeechError("服务端还没有配置语音识别")
    if not pcm:
        raise SpeechError("没有收到声音")
    if len(pcm) > SAMPLE_RATE * 2 * MAX_AUDIO_SECONDS:
        pcm = pcm[: SAMPLE_RATE * 2 * MAX_AUDIO_SECONDS]

    host, path, style_name = _hosts()
    final = ""
    try:
        async with websockets.connect(
            _auth_url(host, path, api_key, api_secret), max_size=None,
        ) as socket:
            offset = 0
            seq = 0
            first = True
            while offset < len(pcm):
                chunk = pcm[offset: offset + FRAME_BYTES]
                offset += len(chunk)
                status = 2 if offset >= len(pcm) else (0 if first else 1)
                await socket.send(frame_for(style_name, app_id, chunk, status, seq, keyterms))
                seq += 1
                first = False
                final = await _drain(socket, style_name, final, wait=0.001)
                await asyncio.sleep(FRAME_SECONDS)
            final = await _drain(socket, style_name, final, wait=5)
    except SpeechError:
        raise
    except Exception as error:  # a failed handshake, a dropped socket, a wrong clock
        log.warning("[speech] iFlytek connection failed=%s", type(error).__name__)
        raise SpeechError(f"连不上语音识别服务（{type(error).__name__}）") from error
    return final.strip()


async def _drain(socket, style_name: str, final: str, *, wait: float) -> str:
    """Reads whatever results are ready; keeps the newest text (dynamic correction revises earlier)."""
    while True:
        try:
            raw = await asyncio.wait_for(socket.recv(), timeout=wait)
        except asyncio.TimeoutError:
            return final
        except Exception:
            return final
        try:
            message = json.loads(raw)
        except Exception:
            continue
        text = text_of(style_name, message)
        if text:
            final = text
        if finished(style_name, message):
            return final
        wait = 0.001
