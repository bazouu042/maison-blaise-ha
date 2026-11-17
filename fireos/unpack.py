import zipfile, os, sys, time, subprocess
d = "C:/saiyaku-athena/fireos"
log = open(d + "/unpack.log", "w")
def L(*a):
    print(*a); print(*a, file=log, flush=True)
try:
    L("START", time.strftime("%H:%M:%S"))
    z = zipfile.ZipFile(d + "/athena-7080.bin")
    names = z.namelist()
    L("ZIP_ENTRIES", len(names))
    keep = [n for n in names if n.endswith(("system.new.dat.br","system.transfer.list","vendor.new.dat.br","vendor.transfer.list"))]
    L("KEEP", keep)
    for n in keep:
        z.extract(n, d)
        L("EXTRACTED", n, os.path.getsize(os.path.join(d, n)))
    import brotli
    for p in ("system.new.dat.br", "vendor.new.dat.br"):
        L("BROTLI_START", p, time.strftime("%H:%M:%S"))
        with open(os.path.join(d, p), "rb") as f:
            data = f.read()
        out = brotli.decompress(data)
        op = os.path.join(d, p[:-3])
        with open(op, "wb") as f:
            f.write(out)
        L("BROTLI_DONE", p, len(out))
        del data, out
    for part in ("system", "vendor"):
        L("SDAT_START", part, time.strftime("%H:%M:%S"))
        r = subprocess.run([sys.executable, d + "/sdat2img.py",
            os.path.join(d, part + ".transfer.list"),
            os.path.join(d, part + ".new.dat"),
            os.path.join(d, part + ".img")], capture_output=True, text=True)
        L("SDAT", part, "rc", r.returncode)
        if r.returncode != 0:
            L(r.stdout[-2000:]); L(r.stderr[-2000:])
        else:
            L("IMG_DONE", part, os.path.getsize(os.path.join(d, part + ".img")))
    L("ALL_DONE", time.strftime("%H:%M:%S"))
except Exception as e:
    L("ERROR", repr(e))
