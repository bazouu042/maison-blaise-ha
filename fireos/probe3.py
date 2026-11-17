import ext4
f = open("C:/saiyaku-athena/fireos/vendor.img", "rb")
vol = ext4.Volume(f)
root = vol.root
for entry, ft in root.opendir():
    e = entry
    attrs = [x for x in dir(e) if not x.startswith("_")]
    try:
        n = e.name
    except Exception:
        n = "?"
    try:
        n2 = e.name_str
    except Exception:
        n2 = "-"
    print("NAME:", repr(n), "|", getattr(ft, "name", ft), "| inode?", hasattr(e, "inode"), "| attrs:", attrs[:12])
