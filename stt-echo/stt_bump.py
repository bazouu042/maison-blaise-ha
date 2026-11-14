# -*- coding: utf-8 -*-
import os
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, "stt_server.py")
c = open(p, encoding="utf-8").read()
old = '<script src="patch.js?v=3"></script>'
new = '<script src="patch.js?v=4"></script>'
n = c.count(old)
if n != 1:
    print("FAIL occurrences:", n); raise SystemExit(1)
open(p, "w", encoding="utf-8").write(c.replace(old, new))
print("BUMP_OK")
