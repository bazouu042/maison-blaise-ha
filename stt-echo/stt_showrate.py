# -*- coding: utf-8 -*-
import os
HERE = os.path.dirname(os.path.abspath(__file__))
# 1) patch local_stt_patch.js : afficher le sampleRate via onMessage
p = os.path.join(HERE, "local_stt_patch.js")
c = open(p, encoding="utf-8").read()
old = "dbg('sampleRate natif', ctx.sampleRate);"
new = "dbg('sampleRate natif', ctx.sampleRate); try { CFG.onMessage('sampleRate natif : ' + ctx.sampleRate); } catch (e) {}"
if c.count(old) != 1:
    print("FAIL js occurrences:", c.count(old)); raise SystemExit(1)
open(p, "w", encoding="utf-8").write(c.replace(old, new))
print("JS_OK")
# 2) patch stt_server.py : cache-buster sur patch.js
p2 = os.path.join(HERE, "stt_server.py")
c2 = open(p2, encoding="utf-8").read()
old2 = '<script src="patch.js"></script>'
new2 = '<script src="patch.js?v=3"></script>'
if c2.count(old2) != 1:
    print("FAIL html occurrences:", c2.count(old2)); raise SystemExit(1)
open(p2, "w", encoding="utf-8").write(c2.replace(old2, new2))
print("HTML_OK")
