# -*- coding: utf-8 -*-
import wave, numpy as np
p = r"C:\saiyaku-athena\stt\last_session.wav"
w = wave.open(p)
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
y = x[::3]
o = wave.open(r"C:\saiyaku-athena\stt\last_session_x3.wav", "wb")
o.setnchannels(1); o.setsampwidth(2); o.setframerate(16000); o.writeframes(y.astype(np.int16).tobytes()); o.close()
print("wrote_x3", len(y))
