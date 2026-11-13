# -*- coding: utf-8 -*-
import wave, numpy as np
w = wave.open(r"C:\saiyuku-athena\stt\last_session.wav")
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
# hypothese : audio reel 48k envoye comme 16k -> garder 1 echantillon sur 3
y = x[::3]
o = wave.open(r"C:\saiyuku-athena\stt\last_session_x3.wav", "wb")
o.setnchannels(1); o.setsampwidth(2); o.setframerate(16000); o.writeframes(y.astype(np.int16).tobytes()); o.close()
print("wrote_x3", len(y))
