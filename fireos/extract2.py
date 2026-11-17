import ext4, os, re

img = "C:/saiyaku-athena/fireos/vendor.img"
outroot = "C:/saiyaku-athena/fireos/stock_vendor"
log = open("C:/saiyaku-athena/fireos/extract.log", "w")
def L(*a):
    print(*a); print(*a, file=log, flush=True)

vol = ext4.Volume(open(img, "rb"))
root = vol.root
NAMERE = re.compile(rb"[A-Za-z0-9._+-]+")

def clean_name(entry):
    nb = entry.name_bytes
    m = NAMERE.match(nb)
    return m.group(0).decode() if m else nb.decode("latin1", "ignore")

def child(dirnode, want):
    for entry, ft in dirnode.opendir():
        if clean_name(entry) == want:
            return entry.inode, ft
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

pat = re.compile("audio|mixer|asp|codec|volume|mic|afe|eq|tflite|priors|coefs|beam|vad|uspd|mbcl|speech|record", re.I)

def walk(dirnode, rel, recurse):
    for entry, ft in dirnode.opendir():
        name = clean_name(entry)
        etype = getattr(ft, "name", str(ft))
        ino = entry.inode
        full = rel + "/" + name
        if etype == "DIR":
            if recurse or name in ("audio_param", "audio-algorithms"):
                L("DIR ", full)
                try:
                    walk(ino, full, True)
                except Exception as ex:
                    L("ERRDIR", full, repr(ex))
        elif etype == "REGULAR" or etype == "REG_FILE":
            if pat.search(name):
                try:
                    save(full, read_file(ino))
                except Exception as ex:
                    L("ERR", full, repr(ex))
        else:
            L("OTHER", full, etype)

etc, _ = child(root, "etc")
L("etc:", type(etc).__name__ if etc else "NOT FOUND")
if etc is not None:
    walk(etc, "etc", False)
L("ALL_DONE")
