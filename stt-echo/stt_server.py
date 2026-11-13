#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Jarvis STT local - mini-serveur de transcription vocale (Vosk ou faster-whisper)
================================================================================

Endpoints (tous sous le prefixe /stt, pour pouvoir aussi passer par un tunnel) :

  WS   /stt              Streaming : frames BINAIRES = PCM s16le 16 kHz mono.
                         Messages texte JSON :
                           -> {"type":"start"}            (optionnel, remet a zero)
                           -> {"type":"audio_b64","data":"..."}  (PCM en base64, alternative au binaire)
                           -> {"type":"end"}              fin de phrase -> transcription finale
                           -> {"type":"cancel"}           abandon
                           -> {"type":"ping"}
                           <- {"type":"ready","engine":"vosk","sample_rate":16000,"partials":true}
                           <- {"type":"partial","text":"..."}      (Vosk uniquement)
                           <- {"type":"final","text":"...","ms":42,"audio_s":2.3}
                           <- {"type":"error","error":"..."}
  POST /stt/transcribe   Corps = PCM brut (audio/pcm, audio/l16, application/octet-stream),
                         WAV, webm/ogg/opus (ffmpeg requis dans le PATH),
                         ou JSON {"audio_b64":"...","mime":"audio/pcm"}  ->  {"text":"..."}
  GET  /stt/health       {"ok":true,...}
  GET  /stt/test         Page de test micro (a ouvrir sur l'Echo Show)
  GET  /stt/patch.js     Sert local_stt_patch.js (utilise par la page de test)

Auth optionnelle : --token XXX (ou variable STT_TOKEN) -> ?token=XXX ou en-tete X-STT-Token.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import hmac
import io
import json
import logging
import os
import shutil
import ssl
import subprocess
import sys
import threading
import time
import wave
from logging.handlers import RotatingFileHandler
from pathlib import Path

from aiohttp import WSMsgType, web

HERE = Path(__file__).resolve().parent
SR = 16000
MAX_UTTERANCE_S = 30
log = logging.getLogger("jarvis-stt")

WHISPER_JUNK = (
    "sous-titres realises par", "sous-titrage", "amara.org", "merci d'avoir regarde",
    "abonnez-vous", "sous titres", "radio-canada",
)


class VoskEngine:
    name = "vosk"
    streaming = True

    def __init__(self, model_dir: str):
        try:
            from vosk import KaldiRecognizer, Model, SetLogLevel
        except ImportError:
            raise SystemExit("Module 'vosk' absent :  pip install vosk")
        SetLogLevel(-1)
        p = Path(model_dir)
        if not p.is_dir():
            raise SystemExit(f"Modele Vosk introuvable : {p}\n"
                             "Telecharge https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip "
                             "et dezippe-le dans le dossier 'models'.")
        t = time.perf_counter()
        self._KR = KaldiRecognizer
        self.model = Model(str(p))
        log.info("Modele Vosk charge (%s) en %.1f s", p.name, time.perf_counter() - t)

    def new_session(self):
        return VoskSession(self._KR(self.model, SR))

    def transcribe(self, pcm: bytes) -> str:
        s = self.new_session()
        for i in range(0, len(pcm), 8000):
            s.feed(pcm[i:i + 8000])
        return s.finish()


class VoskSession:
    def __init__(self, rec):
        self.rec = rec
        self.done: list[str] = []

    def feed(self, pcm: bytes) -> str:
        if self.rec.AcceptWaveform(pcm):
            t = json.loads(self.rec.Result()).get("text", "").strip()
            if t:
                self.done.append(t)
            cur = ""
        else:
            cur = json.loads(self.rec.PartialResult()).get("partial", "").strip()
        return " ".join(self.done + ([cur] if cur else []))

    def finish(self) -> str:
        t = json.loads(self.rec.FinalResult()).get("text", "").strip()
        if t:
            self.done.append(t)
        return " ".join(self.done).strip()


class WhisperEngine:
    name = "whisper"
    streaming = False

    def __init__(self, model: str, device: str, compute_type: str, threads: int):
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            raise SystemExit("Module 'faster-whisper' absent :  pip install faster-whisper")
        t = time.perf_counter()
        self.model = WhisperModel(model, device=device, compute_type=compute_type, cpu_threads=threads)
        self.lock = threading.Lock()
        self.transcribe(b"\x00\x00" * SR)
        log.info("Modele faster-whisper '%s' (%s/%s) charge en %.1f s",
                 model, device, compute_type, time.perf_counter() - t)

    def new_session(self):
        return BufferSession(self)

    def transcribe(self, pcm: bytes) -> str:
        import numpy as np
        if len(pcm) < int(SR * 2 * 0.3):
            return ""
        audio = np.frombuffer(pcm[: len(pcm) // 2 * 2], dtype=np.int16).astype(np.float32) / 32768.0
        with self.lock:
            segments, _ = self.model.transcribe(
                audio, language="fr", beam_size=1, best_of=1, temperature=0.0,
                condition_on_previous_text=False, without_timestamps=True,
                vad_filter=True, vad_parameters={"min_silence_duration_ms": 500},
            )
            text = " ".join(s.text.strip() for s in segments).strip()
        low = text.lower()
        if any(j in low for j in WHISPER_JUNK):
            return ""
        return text


class BufferSession:
    def __init__(self, engine: WhisperEngine):
        self.e = engine
        self.buf = bytearray()

    def feed(self, pcm: bytes):
        self.buf.extend(pcm)
        return None

    def finish(self) -> str:
        return self.e.transcribe(bytes(self.buf))


def decode_to_pcm(body: bytes, ctype: str) -> bytes:
    ctype = (ctype or "").split(";")[0].strip().lower()
    if ctype in ("", "audio/pcm", "audio/l16", "application/octet-stream"):
        return body
    if ctype in ("audio/wav", "audio/x-wav", "audio/wave") and body[:4] == b"RIFF":
        with wave.open(io.BytesIO(body)) as w:
            if w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2:
                return w.readframes(w.getnframes())
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise ValueError(f"Format '{ctype}' : ffmpeg requis dans le PATH (ou envoie du PCM 16 kHz mono)")
    p = subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
         "-ac", "1", "-ar", str(SR), "-f", "s16le", "pipe:1"],
        input=body, capture_output=True, timeout=30,
    )
    if p.returncode != 0:
        raise ValueError("ffmpeg : " + p.stderr.decode(errors="ignore")[:300])
    return p.stdout


def origin_allowed(request: web.Request, origin: str) -> bool:
    allowed = request.app["origins"]
    if "*" in allowed or origin in allowed:
        return True
    return origin == f"{request.scheme}://{request.host}"


def auth_ok(request: web.Request) -> bool:
    token = request.app["token"]
    if not token:
        return True
    given = request.query.get("token") or request.headers.get("X-STT-Token") or ""
    return hmac.compare_digest(given, token)


@web.middleware
async def cors_mw(request: web.Request, handler):
    resp = web.Response(status=204) if request.method == "OPTIONS" else await handler(request)
    origin = request.headers.get("Origin")
    if origin and not resp.prepared and origin_allowed(request, origin):
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-STT-Token"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


async def h_health(request: web.Request):
    eng = request.app["engine"]
    return web.json_response({"ok": True, "engine": eng.name, "sample_rate": SR, "partials": eng.streaming})


async def h_transcribe(request: web.Request):
    if not auth_ok(request):
        return web.json_response({"error": "unauthorized"}, status=401)
    body = await request.read()
    ctype = request.content_type
    try:
        if ctype == "application/json":
            j = json.loads(body)
            body = base64.b64decode(j.get("audio_b64") or j.get("audio") or "")
            ctype = j.get("mime", "audio/pcm")
        pcm = await asyncio.to_thread(decode_to_pcm, body, ctype)
        t0 = time.perf_counter()
        text = await asyncio.to_thread(request.app["engine"].transcribe, pcm)
        ms = int((time.perf_counter() - t0) * 1000)
    except Exception as e:  # noqa: BLE001
        log.warning("transcribe: %s", e)
        return web.json_response({"error": str(e)}, status=400)
    log.info("[HTTP %s] %.1fs audio -> %r (%d ms)", request.remote, len(pcm) / (2 * SR), text, ms)
    return web.json_response({"text": text, "ms": ms, "audio_s": round(len(pcm) / (2 * SR), 2)})


async def h_ws(request: web.Request):
    origin = request.headers.get("Origin")
    if origin and not origin_allowed(request, origin):
        log.warning("WS refusee, origine %s", origin)
        raise web.HTTPForbidden(text="origin not allowed")
    if not auth_ok(request):
        raise web.HTTPUnauthorized(text="bad token")

    ws = web.WebSocketResponse(heartbeat=25, max_msg_size=8 * 1024 * 1024)
    await ws.prepare(request)
    eng = request.app["engine"]
    peer = request.remote
    st = {"sess": eng.new_session(), "bytes": 0, "last": ""}

    def reset():
        st["sess"], st["bytes"], st["last"] = eng.new_session(), 0, ""

    async def feed(data: bytes):
        if st["bytes"] > SR * 2 * MAX_UTTERANCE_S:
            return
        st["bytes"] += len(data)
        part = await asyncio.to_thread(st["sess"].feed, data)
        if part and part != st["last"]:
            st["last"] = part
            await ws.send_json({"type": "partial", "text": part})

    log.info("WS connectee : %s (origine %s)", peer, origin)
    await ws.send_json({"type": "ready", "engine": eng.name, "sample_rate": SR, "partials": eng.streaming})
    try:
        async for msg in ws:
            if msg.type == WSMsgType.BINARY:
                await feed(msg.data)
            elif msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except ValueError:
                    await ws.send_json({"type": "error", "error": "JSON invalide"})
                    continue
                kind = data.get("type")
                if kind == "audio_b64":
                    await feed(base64.b64decode(data.get("data", "")))
                elif kind == "end":
                    t0 = time.perf_counter()
                    try:
                        text = await asyncio.to_thread(st["sess"].finish)
                    except Exception as e:  # noqa: BLE001
                        log.exception("finish")
                        await ws.send_json({"type": "error", "error": str(e)})
                        reset()
                        continue
                    ms = int((time.perf_counter() - t0) * 1000)
                    audio_s = round(st["bytes"] / (2 * SR), 2)
                    log.info("[WS %s] %.1fs audio -> %r (%d ms)", peer, audio_s, text, ms)
                    await ws.send_json({"type": "final", "text": text, "ms": ms, "audio_s": audio_s})
                    reset()
                elif kind in ("start", "cancel", "reset"):
                    reset()
                elif kind == "ping":
                    await ws.send_json({"type": "pong"})
            elif msg.type == WSMsgType.ERROR:
                log.warning("WS erreur %s : %s", peer, ws.exception())
                break
    finally:
        log.info("WS fermee : %s", peer)
    return ws


async def h_test(request: web.Request):
    return web.Response(text=TEST_PAGE, content_type="text/html", headers={"Cache-Control": "no-store"})


async def h_patch_js(request: web.Request):
    f = HERE / "local_stt_patch.js"
    if not f.is_file():
        raise web.HTTPNotFound(text="local_stt_patch.js absent a cote de stt_server.py")
    return web.Response(text=f.read_text(encoding="utf-8"), content_type="application/javascript",
                        headers={"Cache-Control": "no-store"})


TEST_PAGE = r"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Test STT local</title>
<style>
body{font-family:sans-serif;background:#111;color:#eee;margin:0;padding:16px}
button{font-size:26px;padding:18px 36px;border-radius:40px;border:0;background:#2a7;color:#fff}
#lvl{height:14px;background:#333;border-radius:7px;overflow:hidden;margin:16px 0}
#bar{height:100%;width:0;background:#4c4}
#partial{color:#9ab;min-height:1.3em;font-size:20px}#final{font-size:26px;min-height:1.4em;margin:8px 0}
pre{white-space:pre-wrap;background:#222;padding:10px;border-radius:8px;font-size:13px}
</style></head><body>
<h2>Test STT local</h2>
<button id="go">Parler</button> &nbsp; etat : <b id="state">idle</b>
<div id="lvl"><div id="bar"></div></div>
<div id="partial"></div><div id="final"></div><pre id="log"></pre>
<script>
var L=document.getElementById('log');
function log(m){L.textContent=new Date().toLocaleTimeString()+'  '+m+'\n'+L.textContent;}
window.LOCAL_STT_CONFIG={
  URLS:[(location.protocol==='https:'?'wss://':'ws://')+location.host+'/stt'],
  TOKEN:new URLSearchParams(location.search).get('token')||'',
  onState:function(s){document.getElementById('state').textContent=s;log('etat : '+s);},
  onPartial:function(t){document.getElementById('partial').textContent=t;},
  onTranscript:function(t,info){document.getElementById('final').textContent='\u00AB '+t+' \u00BB';
    log('FINAL : '+t+'  '+JSON.stringify(info||{}));document.getElementById('state').textContent='idle';},
  onMessage:function(m,err){log((err?'ERREUR : ':'')+m);},
  onLevel:function(r){document.getElementById('bar').style.width=Math.min(100,r*400)+'%';},
  PRECONNECT:false, DEBUG:true
};
</script>
<script src="patch.js"></script>
<script>
log('UA : '+navigator.userAgent);
log('AudioWorklet : '+!!window.AudioWorkletNode+' | getUserMedia : '+!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)+' | webkitSpeechRecognition : '+!!window.webkitSpeechRecognition);
document.getElementById('go').onclick=function(){
  if(!window.LOCAL_STT){log('ERREUR : patch.js non charge');return;}
  window.LOCAL_STT.start();
};
</script></body></html>"""


def build_app(engine, origins, token) -> web.Application:
    app = web.Application(client_max_size=25 * 1024 * 1024, middlewares=[cors_mw])
    app["engine"], app["origins"], app["token"] = engine, origins, token
    app.router.add_get("/stt", h_ws)
    app.router.add_post("/stt/transcribe", h_transcribe)
    app.router.add_get("/stt/health", h_health)
    app.router.add_get("/health", h_health)
    app.router.add_get("/stt/test", h_test)
    app.router.add_get("/stt/patch.js", h_patch_js)
    return app


async def cert_reloader(ctx: ssl.SSLContext, cert: str, key: str):
    def mt():
        return os.path.getmtime(cert), os.path.getmtime(key)
    last = mt()
    while True:
        await asyncio.sleep(3600)
        try:
            m = mt()
            if m != last:
                ctx.load_cert_chain(cert, key)
                last = m
                log.info("Certificat TLS recharge")
        except Exception as e:  # noqa: BLE001
            log.warning("Rechargement certificat impossible : %s", e)


async def serve(args):
    if args.engine == "vosk":
        engine = VoskEngine(args.model or str(HERE / "models" / "vosk-model-small-fr-0.22"))
    else:
        engine = WhisperEngine(args.model or "small", args.device, args.compute_type, args.threads)

    origins = {o.strip() for o in args.origins.split(",") if o.strip()}
    app = build_app(engine, origins, args.token)
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()

    if args.cert and args.key:
        ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ctx.load_cert_chain(args.cert, args.key)
        await web.TCPSite(runner, args.host, args.port, ssl_context=ctx).start()
        asyncio.create_task(cert_reloader(ctx, args.cert, args.key))
        log.info("Ecoute TLS  : wss://%s:%d/stt  (https://.../stt/test)", args.host, args.port)
    else:
        await web.TCPSite(runner, args.host, args.port).start()
        log.warning("Ecoute SANS TLS : ws://%s:%d/stt  -> une page HTTPS ne pourra PAS s'y connecter "
                    "(contenu mixte). OK seulement pour les tests curl.", args.host, args.port)

    if args.plain_port:
        await web.TCPSite(runner, "127.0.0.1", args.plain_port).start()
        log.info("Ecoute locale (pour tunnel) : http://127.0.0.1:%d/stt", args.plain_port)

    log.info("Moteur : %s | origines autorisees : %s | jeton : %s",
             engine.name, ", ".join(sorted(origins)) or "-", "oui" if args.token else "non")
    await asyncio.Event().wait()


def setup_logging():
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    fh = RotatingFileHandler(HERE / "stt_server.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)
    if sys.stdout is not None:
        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(fmt)
        root.addHandler(sh)


def main():
    env = os.environ.get
    ap = argparse.ArgumentParser(description="Jarvis STT local")
    ap.add_argument("--host", default=env("STT_HOST", "0.0.0.0"))
    ap.add_argument("--port", type=int, default=int(env("STT_PORT", "2777")))
    ap.add_argument("--engine", choices=["vosk", "whisper"], default=env("STT_ENGINE", "vosk"))
    ap.add_argument("--model", default=env("STT_MODEL"),
                    help="vosk : dossier du modele ; whisper : tiny/base/small/medium/large-v3-turbo")
    ap.add_argument("--cert", default=env("STT_CERT"), help="certificat PEM (chaine complete)")
    ap.add_argument("--key", default=env("STT_KEY"), help="cle privee PEM")
    ap.add_argument("--plain-port", type=int, default=int(env("STT_PLAIN_PORT", "0")),
                    help="port HTTP en clair sur 127.0.0.1 (pour un tunnel cloudflared), 0 = desactive")
    ap.add_argument("--origins", default=env("STT_ORIGINS", "https://jarvis.bazouu-lab.fr"),
                    help="origines web autorisees, separees par des virgules ('*' = toutes)")
    ap.add_argument("--token", default=env("STT_TOKEN", ""))
    ap.add_argument("--device", default=env("STT_DEVICE", "cpu"), help="whisper : cpu (cuda = NVIDIA uniquement)")
    ap.add_argument("--compute-type", default=env("STT_COMPUTE", "int8"))
    ap.add_argument("--threads", type=int, default=max(4, (os.cpu_count() or 8) // 2))
    args = ap.parse_args()

    setup_logging()
    try:
        asyncio.run(serve(args))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
