#!/usr/bin/env python3
"""Fix Cargo.toml - remove mangled entry and add correct one."""
path = "/root/zion-2.9.6/V3/L1/miner/Cargo.toml"
lines = open(path).readlines()
# Remove mangled opencl-diag entries
while lines and ("opencl-diag" in lines[-1] or lines[-1].strip() == "" or lines[-1].strip() == "[[bin]]"):
    lines.pop()
lines.append("\n")
lines.append("[[bin]]\n")
lines.append('name = "opencl-diag"\n')
lines.append('path = "src/opencl_diag.rs"\n')
open(path, "w").writelines(lines)
print("FIXED - last 5 lines:")
for l in lines[-5:]:
    print(l, end="")
