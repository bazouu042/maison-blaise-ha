# -*- coding: utf-8 -*-
import wave, numpy as np
w = wave.open(r"C:\saiyaku-athena\stt\last_session.wav")
n = w.getnframes()
x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
sr = w.getframerate()
print("duree_s", round(len(x)/sr, 2), "rate", sr, "ch", w.getnchannels())
print("rms_global", round(float(np.sqrt((x**2).mean())), 5))
print("peak", round(float(np.abs(x).max()), 5))
# RMS par tranche de 0.5 s
for i in range(0, len(x), sr//2):
    seg = x[i:i+sr//2]
    if len(seg) < 100: break
    print("t=%.1fs rms=%.5f peak=%.4f zeros=%.2f" % (i/sr, float(np.sqrt((seg**2).mean())), float(np.abs(seg).max()), float((seg==0).mean())))
# frequence dominante sur la tranche la plus energique
best, bi = 0, 0
for i in range(0, len(x)-4096, 4096):
    e = float((x[i:i+4096]**2).sum())
    if e > best: best, bi = e, i
seg = x[bi:bi+4096] * np.hanning(4096)
S = np.abs(np.fft.rfft(seg)); f = np.fft.rfftfreq(4096, 1/sr)
print("dom_freq_hz", int(f[S.argmax()]), "at_t", round(bi/sr,1))
# sign flips = gibberish probable
sign_changes = float((np.diff(np.sign(x[x!=0])) != 0).mean()) if (x!=0).sum() > 10 else 0
print("sign_flip_ratio", round(sign_changes, 3))
