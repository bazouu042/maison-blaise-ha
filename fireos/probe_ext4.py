import ext4
f = open("C:/saiyaku-athena/fireos/vendor.img", "rb")
vol = ext4.Volume(f)
root = vol.root
print("DIR_METHODS:", [x for x in dir(root) if not x.startswith("_")])
try:
    etc = root["etc"]
    print("etc:", type(etc).__name__)
    print("ETC_METHODS:", [x for x in dir(etc) if not x.startswith("_")])
except Exception as ex:
    print("getitem err:", repr(ex))
    try:
        etc = root.lookup("etc")
        print("lookup ok:", type(etc).__name__, [x for x in dir(etc) if not x.startswith("_")])
    except Exception as ex2:
        print("lookup err:", repr(ex2))
