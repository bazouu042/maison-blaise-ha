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
    for i, (entry, ft) in enumerate(dirnode.opendir()):
        name = clean_name(entry)
        etype = getattr(ft, "name", str(ft))
        full = rel + "/" + name
        try:
            ino = dirnode.inode_at(name)
        except Exception as ex:
            L("ERRINO", full, repr(ex)); continue
        if etype in ("DIR",):
            if recurse or name in ("audio_param", "audio-algorithms"):
                L("DIR ", full)
                try:
                    walk(ino, full, True)
                except Exception as ex:
                    L("ERRDIR", full, repr(ex))
            continue
        if etype in ("REGULAR", "REG_FILE"):
            if pat.search(name):
                try:
                    save(full, read_file(ino))
                except Exception as ex:
                    L("ERR", full, repr(ex))
            continue
        L("OTHER", full, etype)

etc = None
for form in ("etc",):
    try:
        etc = root.inode_at(form)
        L("etc via", repr(form), type(etc).__name__)
        break
    except Exception as ex:
        L("inode_at", repr(form), "err:", repr(ex))
if etc is None:
    try:
        etc = root.inode_at(["etc"]); L("etc via list ok")
    except Exception as ex:
        L("list err", repr(ex))
if etc is not None:
    walk(etc, "etc", False)
L("ALL_DONE")
