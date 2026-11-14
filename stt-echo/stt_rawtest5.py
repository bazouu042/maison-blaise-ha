import wave, array, sys, math, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
W = 'C:/saiyaku-athena/stt/last_session.wav'
MODEL = 'C:/saiyaku-athena/stt/models/vosk-model-small-fr-0.22'
wf = wave.open(W, 'rb')
x = array.array('h'); x.frombytes(wf.readframes(wf.getnframes()))
def lowpass(x, fs, fc):
    a = 1 - math.exp(-2*math.pi*fc/fs)
    y = array.array('h', bytes(2*len(x))); acc = 0.0
    for i in range(len(x)):
        acc += a*(x[i]-acc)
        y[i] = max(-32768, min(32767, int(acc)))
    return y
def resamp(x, rin, rout=16000):
    r = rout/float(rin); m = int(len(x)*r); y = array.array('h', bytes(2*m))
    for j in range(m):
        p = j/r; i = int(p); f = p-i
        v = x[i] if i+1 >= len(x) else x[i] + (x[i+1]-x[i])*f
        y[j] = max(-32768, min(32767, int(v)))
    return y
lp = lowpass(x, 48000, 7500)
variants = [
    ('dec3-ch0@16k', x[::3]),
    ('dec3-ch1@16k', x[1::3]),
    ('dec3-ch2@16k', x[2::3]),
    ('dec3-ch0LP@16k', lp[::3]),
    ('dec3-ch1LP@16k', lp[1::3]),
    ('dec3-ch2LP@16k', lp[2::3]),
    ('dec3-ch0@14k', resamp(x[::3], 14000)),
    ('dec3-ch0@17k', resamp(x[::3], 17000)),
]
from vosk import Model, KaldiRecognizer
model = Model(MODEL)
for tag, y in variants:
    try:
        rec = KaldiRecognizer(model, 16000)
        b = y.tobytes()
        for i in range(0, len(b), 3200): rec.AcceptWaveform(b[i:i+3200])
        r = json.loads(rec.FinalResult())
        print(tag, '->', repr(r.get('text','')))
    except Exception as e:
        print(tag, 'ERR', e)
print('DONE5')
