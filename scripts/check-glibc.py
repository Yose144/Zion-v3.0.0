#!/usr/bin/env python3
import re, sys, zipfile, os

path = sys.argv[1]
if path.endswith(".zip"):
    z = zipfile.ZipFile(path)
    for n in z.namelist():
        if "miner" in n and not n.endswith("/"):
            data = z.read(n)
            vs = sorted({int(x) for x in re.findall(rb"GLIBC_2\.(\d+)", data)})
            print(f"{n}: max_glibc=2.{max(vs) if vs else '?'} size={len(data)}")
else:
    data = open(path, "rb").read()
    vs = sorted({int(x) for x in re.findall(rb"GLIBC_2\.(\d+)", data)})
    print(f"max_glibc=2.{max(vs) if vs else '?'}")
