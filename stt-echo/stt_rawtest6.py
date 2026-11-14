import wave, array, sys, math
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
W = 'C:/saiyaku-athena/stt/last_session.wav'
OUT = 'C:/saiyaku-athena/stt/'
wf = wave.open(W, 'rb')
x = array.array('h'); x.frombytes(wf.readframes(wf.getnframes()))
def save(name, data, rate):
    o = wave.open(OUT + name, 'wb')
    o.setnchannels(1); o.setsampwidth(2); o.setframerate(rate)
    o.writeframes(data.tobytes()); o.close()
    print('saved', name, rate, len(data))
def resamp(x, rin, rout=16000):
    r = rout/float(rin); m = int(len(x)*r); y = array.array('h', bytes(2*m))
    for j in range(m):
        p = j/r; i = int(p); f = p-i
        v = x[i] if i+1 >= len(x) else x[i] + (x[i+1]-x[i])*f
        y[j] = max(-32768, min(32767, int(v)))
    return y
save('v3_lent3x_16k.wav', resamp(x, 16000.0/3), 16000)
save('v4_moitie_24k.wav', x[::2], 24000)
save('v5_normal_48vers16.wav', resamp(x, 48000), 16000)
save('v6_rapide3x_16k.wav', resamp(x, 48000.0*3), 16000)
print('DONE6b')
