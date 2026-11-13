# -*- coding: utf-8 -*-
p = r"C:\saiyaku-athena\stt\stt_server.py"
c = open(p, encoding="utf-8").read()

a = '        st["bytes"] += len(data)'
a2 = a + '\n        st.setdefault("chunks", []).append(data)'
r = '        st["sess"], st["bytes"], st["last"] = eng.new_session(), 0, ""'
r2 = r + '\n        st["chunks"] = []'
e = '                    log.info("[WS %s] %.1fs audio -> %r (%d ms)", peer, audio_s, text, ms)'
e2 = ('                    try:\n'
      '                        import wave\n'
      '                        ch = b"".join(st.get("chunks", []))\n'
      '                        wf = wave.open(str(HERE / "last_session.wav"), "wb")\n'
      '                        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)\n'
      '                        wf.writeframes(ch); wf.close()\n'
      '                    except Exception as ex:\n'
      '                        log.warning("dump KO %s", ex)\n') + e

for old, new, name in [(a, a2, "feed"), (r, r2, "reset"), (e, e2, "end")]:
    n = c.count(old)
    if n != 1:
        print("FAIL", name, "occurrences:", n); raise SystemExit(1)
    c = c.replace(old, new)

open(p, "w", encoding="utf-8").write(c)
print("PATCH_OK")
