# -*- coding: utf-8 -*-
import os
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, "local_stt_patch.js")
c = open(p, encoding="utf-8").read()
old = "try { s.ctx = new AC(); } catch (e) { fail(s, 'AudioContext : ' + e.message); return; }"
new = ("try { s.ctx = new AC({ sampleRate: 16000 }); } catch (e) { "
       "try { s.ctx = new AC(); } catch (e2) { fail(s, 'AudioContext : ' + e2.message); return; } }")
n = c.count(old)
if n != 1:
    print("FAIL occurrences:", n); raise SystemExit(1)
open(p, "w", encoding="utf-8").write(c.replace(old, new))
print("PATCH16K_OK")
