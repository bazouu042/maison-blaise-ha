import ext4, sys

img = "C:/saiyaku-athena/fireos/vendor.img"
f = open(img, "rb")
vol = ext4.Volume(f)
root = vol.root
print("root:", type(root).__name__)
print("open_dir?", hasattr(root, "open_dir"), "| iterdir?", hasattr(root, "iterdir"), "| entries?", hasattr(root, "entries"))

d = root.open_dir() if hasattr(root, "open_dir") else root
print("dir:", type(d).__name__)

entries = None
if hasattr(d, "iterdir"):
    try:
        entries = list(d.iterdir())
    except Exception as ex:
        print("iterdir err", ex)
if entries is None and hasattr(d, "entries"):
    entries = list(d.entries)
print("entries:", len(entries) if entries else None)
for e in (entries or [])[:50]:
    name = e.name if hasattr(e, "name") else str(e)
    ino = getattr(e, "inode", None)
    print("E:", name, "| inode:", type(ino).__name__ if ino is not None else "-")
