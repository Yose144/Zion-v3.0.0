#!/usr/bin/env python3
with open('/root/zion-bridge-data/bridge.toml', 'r') as f:
    c = f.read()
old = 'bridge_address = "zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5"'
new = 'bridge_address = "zion1s6y6h7k6l033f2n7e0y0r8t6a8h474t0x5398d0"'
c2 = c.replace(old, new)
with open('/root/zion-bridge-data/bridge.toml', 'w') as f:
    f.write(c2)
print("Done:", old[:35] if old not in c2 else "NOT REPLACED")
import re
m = re.search(r'bridge_address = "([^"]+)"', c2)
print("New bridge_address:", m.group(1) if m else "not found")
