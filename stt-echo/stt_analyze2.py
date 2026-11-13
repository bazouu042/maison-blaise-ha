# -*- coding: utf-8 -*-
import os, wave, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
w = wave.open(os.path.join(HERE, "last_session.wav"))
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
print("duree_s", round(len(x)/16000, 2))
print("rms", round(float(np.sqrt((x.astype(np.float32)/32768)**2 .mean() if False else ((x.astype(np.float32)/32768)**2).mean())), 5))
for p in (2,3,4,6):
    a = x[16000:20000].astype(float) if len(x) > 20000 else x[:4000].astype(float)
    b = np.roll(a, -p)
    print("corr_p%d" % p, round(float(np.corrcoef(a[:-p], b[:-p])[0,1]), 3))
print("peak", int(np.abs(x).max()))
import numpy as np2
seg = x[16000:16040]
print("samples16000", list(map(int, seg)))
