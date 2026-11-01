#!/usr/bin/env python3
"""apply-env-keys.py — přepíše vybrané KEY=VALUE v env souboru.

Hodnoty se čtou ze STDIN (nikdy z argumentů), takže se neobjeví v `ps`.
Použití: printf 'KEY=value\n' | apply-env-keys.py /etc/zion/env/x.env
Zálohu dělá volající (cp -a předem).
"""
import sys

path = sys.argv[1]
incoming = {}
for line in sys.stdin:
    line = line.rstrip("\n")
    if "=" not in line or line.startswith("#"):
        continue
    k, _, v = line.partition("=")
    incoming[k.strip()] = v

if not incoming:
    print("žádné klíče na stdin")
    sys.exit(1)

lines = open(path, encoding="utf-8").read().splitlines(keepends=True)
seen = set()
out = []
for line in lines:
    stripped = line.rstrip("\n")
    if "=" in stripped and not stripped.lstrip().startswith("#"):
        k = stripped.split("=", 1)[0].strip()
        if k in incoming:
            nl = "\n" if line.endswith("\n") else ""
            out.append(f"{k}={incoming[k]}{nl}")
            seen.add(k)
            continue
    out.append(line)

missing = set(incoming) - seen
open(path, "w", encoding="utf-8").write("".join(out))
print(f"zapsáno {len(seen)} klíčů do {path}");
if missing:
    print("CHYBÍ v souboru (nepřidávám): " + ", ".join(sorted(missing)))
