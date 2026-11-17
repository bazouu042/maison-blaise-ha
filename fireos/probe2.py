import ext4
f = open("C:/saiyaku-athena/fireos/vendor.img", "rb")
vol = ext4.Volume(f)
root = vol.root
d = root.opendir()
print("opendir:", type(d).__name__)
print("D_METHODS:", [x for x in dir(d) if not x.startswith("_")])
try:
    items = list(d)
    print("list count:", len(items))
    print("first:", items[:3])
except Exception as ex:
    print("iter err:", repr(ex))
