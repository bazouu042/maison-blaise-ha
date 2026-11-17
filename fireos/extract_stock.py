import ext4, os, re

img = "C:/saiyaku-athena/fireos/vendor.img"
outroot = "C:/saiyaku-athena/fireos/stock_vendor"
log = open("C:/saiyaku-athena/fireos/extract.log", "w")
def L(*a):
    print(*a); print(*a, file=log, flush=True)

vol = ext4.Volume(open(img, "rb"))
root = vol.root

def child(dirnode, name):
    for entry, ft in dirnode.opendir():
        if getattr(entry, "name", None) == name:
            return entry, ft
    return None, None

def read_file(ino):
    fh = ino.open()
    try:
        return fh.read()
    except Exception:
        return fh.readall()

def save(relpath, data):
    p = os.path.join(outroot, relpath)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "wb") as f:
        f.write(data)
    L("SAVED", relpath, len(data))

def walk(dirnode, rel, patterns, recurse):
    for entry, ft in dirnode.opendir():
        name = getattr(entry, "name", "?")
        etype = getattr(ft, "name", str(ft))
        ino = getattr(entry, "inode", None)
        full = rel + "/" + name
        if etype == "DIR":
            if recurse or name in ("audio_param", "audio-algorithms"):
                L("DIR ", full)
                walk(ino, full, patterns, True)
        elif etype == "REGULAR":
            if any(re.search(p, name) for p in patterns):
                try:
                    save(full, read_file(ino))
                except Exception as ex:
                    L("ERR", full, repr(ex))
        else:
            L("OTHER", full, etype)

pat = ["audio", "mixer", "asp", "codec", "volume", "mic", "afe", "eq", "tflite", "priors", "coefs", "beam", "vad", "uspd", "mbcl", "speech", "record"]
L("=== /etc listing ===")
etc, _ = child(root, "etc")
L("etc type:", type(etc).__name__)
for entry, ft in etc.opendir():
    L("  ", getattr(entry, "name", "?"), getattr(ft, "name", str(ft)))
L("=== extracting ===")
walk(etc, "etc", pat, False)
L("ALL_DONE")
