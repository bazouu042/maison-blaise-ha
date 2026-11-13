# -*- coding: utf-8 -*-
import os, wave, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
w = wave.open(os.path.join(HERE, "last_session.wav"))
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
seg = x[16000:16040]
print("echantillons:", list(map(int, seg)))
loud = x[2*16000:2*16000+40]
print("loud:", list(map(int, loud)))
for p in (2,3,4,6):
    a = x[16000:20000].astype(float)
    b = np.roll(a, -p)
    print("corr_p%d" % p, round(float(np.corrcoef(a[:-p], b[:-p])[0,1]), 3))
h = np.histogram(np.abs(x), bins=[0,100,1000,5000,10000,20000,32768])[0]
print("histo", list(map(int,h)))
