import wave, array, sys, math, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
W = 'C:/saiyaku-athena/stt/last_session.wav'
MODEL = 'C:/saiyaku-athena/stt/models/vosk-model-small-fr-0.22'
wf = wave.open(W, 'rb')
x = array.array('h'); x.frombytes(wf.readframes(wf.getnframes()))
n = len(x); FS = 48000.0
def resamp(x, rin, rout=16000):
    r = rout/float(rin); m = int(len(x)*r); y = array.array('h', bytes(2*m))
    for j in range(m):
        p = j/r; i = int(p); f = p-i
        v = x[i] if i+1 >= len(x) else x[i] + (x[i+1]-x[i])*f
        y[j] = max(-32768, min(32767, int(v)))
    return y
def lowpass(x, fs, fc):
    a = 1 - math.exp(-2*math.pi*fc/fs)
    y = array.array('h', bytes(2*len(x))); acc = 0.0
    for i in range(len(x)):
        acc += a*(x[i]-acc)
        y[i] = max(-32768, min(32767, int(acc)))
    return y
def notch(x, fs, f0, bw):
    # soustrait la composante f0 par estimation d'amplitude/phase par blocs
    BL = 4800; out = array.array('h', bytes(2*len(x)))
    for s in range(0, len(x), BL):
        seg = x[s:s+BL]
        c = 2*math.cos(2*math.pi*f0/fs)
        q0 = q1 = q2 = 0.0
        for v in seg:
            q0 = v + c*q1 - q2; q2 = q1; q1 = q0
        # amplitude ~ sqrt(q1^2+q2^2-c q1 q2)
        amp = math.sqrt(max(0, q1*q1 + q2*q2 - c*q1*q2))/max(1,len(seg))
        ph = math.atan2(q2*math.sin(2*math.pi*f0/fs), q1 + q2*math.cos(2*math.pi*f0/fs))
        for i in range(len(seg)):
            comp = amp*math.cos(2*math.pi*f0*(s+i)/fs + ph)*len(seg)/2
            out[s+i] = max(-32768, min(32767, int(seg[i]-comp)))
    return out
def vosk(y, tag):
    from vosk import Model, KaldiRecognizer
    rec = KaldiRecognizer(Model(MODEL), 16000)
    b = y.tobytes()
    for i in range(0, len(b), 3200): rec.AcceptWaveform(b[i:i+3200])
    r = json.loads(rec.FinalResult())
    print(tag, '->', repr(r.get('text','')))
variants = [
    ('as96k', resamp(x, 96000)),
    ('as96kLP3k', resamp(lowpass(x, FS, 3000), 96000)),
    ('notch4k+LP3.5+dec3', resamp(lowpass(notch(x, FS, 4000, 100), FS, 3500), 16000)),
    ('as48kLP2.8k', resamp(lowpass(x, FS, 2800), 48000)),
]
for tag, y in variants:
    try: vosk(y, tag)
    except Exception as e: print(tag, 'ERR', e)
# autocorr de half0 en 24k
h0 = x[::2]
def corr(x, k):
    s = 0.0; e = 0.0
    for i in range(k, len(x)):
        s += x[i]*x[i-k]; e += x[i]*x[i]
    return s/e if e else 0
print('half0@24k corr:', ' '.join('p%d=%.3f' % (k, corr(h0, k)) for k in (1,2,3,4,6,8,12)))
print('DONE4')
