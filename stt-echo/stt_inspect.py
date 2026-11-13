# -*- coding: utf-8 -*-
import os, wave, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
w = wave.open(os.path.join(HERE, "last_session.wav"))
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
for ch in range(4):
    y = x[ch::4]
    o = wave.open(os.path.join(HERE, "t_ch%d.wav" % ch), "wb")
    o.setnchannels(1); o.setsampwidth(2); o.setframerate(16000); o.writeframes(y.astype(np.int16).tobytes()); o.close()
    print("wrote ch", ch, len(y))
# variante : 2 canaux entrelaces (period 4 = stereo 32k ?)
y = x[::2]
o = wave.open(os.path.join(HERE, "t_st.wav"), "wb")
o.setnchannels(1); o.setsampwidth(2); o.setframerate(16000); o.writeframes(y.astype(np.int16).tobytes()); o.close()
print("done")
