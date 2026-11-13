# -*- coding: utf-8 -*-
import wave, numpy as np
p = r"C:\saiyuku-athena\stt\last_session.wav"
w = wave.open(p)
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
def save(name, y):
    o = wave.open(r"C:\saiyuku-athena\stt\\" + name, "wb")
    o.setnchannels(1); o.setsampwidth(2); o.setframerate(16000); o.writeframes(y.astype(np.int16).tobytes()); o.close()
save("t_x2.wav", x[::2])
save("t_x4.wav", x[::4])
save("t_x15.wav", x[::3][::5] if len(x) > 60 else x)
# ralenti x2 (doubler chaque echantillon)
save("t_half.wav", np.repeat(x, 2))
# byteswap (endianness)
save("t_swap.wav", x.byteswap())
print("OK")
