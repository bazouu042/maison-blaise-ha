# -*- coding: utf-8 -*-
import os, wave, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
w = wave.open(os.path.join(HERE, "last_session.wav"))
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
def save(name, y):
    o = wave.open(os.path.join(HERE, name), "wb")
    o.setnchannels(1); o.setsampwidth(2); o.setframerate(16000); o.writeframes(y.astype(np.int16).tobytes()); o.close()
save("n_d2.wav", x[::2])
save("n_d2o.wav", x[1::2])
save("n_d4.wav", x[::4])
save("n_d4a.wav", x[1::4])
save("n_d4b.wav", x[2::4])
save("n_d4c.wav", x[3::4])
# moyenne des paires et des quads (si entrelace + somme = beamform)
save("n_avg2.wav", (x[0::2].astype(np.int32) + x[1::2].astype(np.int32)) // 2)
save("n_avg4.wav", (x[0::4].astype(np.int32) + x[1::4] + x[2::4] + x[3::4]) // 4)
print("OK")
