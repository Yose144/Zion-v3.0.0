#!/usr/bin/env python3
"""Verify the server ZIP has the correct glibc 2.31 compatible binary."""
import requests, zipfile, io, tempfile, os, re

# Download current file from server
r = requests.get("https://zionterranova.com/downloads/zion-miner-v3.0.0.zip", timeout=30)
print(f"Downloaded: {len(r.content)} bytes")

z = zipfile.ZipFile(io.BytesIO(r.content))
for info in z.infolist():
    print(f"  {info.filename} size={info.file_size}")

# Extract and check for GLIBC strings  
tmpdir = tempfile.mkdtemp()
z.extractall(tmpdir)
binary_path = os.path.join(tmpdir, "zion-miner-v3.0.0", "miner")
with open(binary_path, "rb") as f:
    data = f.read()

# Check max GLIBC version
glibc_versions = re.findall(b"GLIBC_2\\.(\\d+)", data)
versions = sorted(set(int(v) for v in glibc_versions))
print(f"GLIBC versions needed: {['2.' + str(v) for v in versions]}")
print(f"Max GLIBC: 2.{max(versions)}")
if max(versions) <= 31:
    print("STATUS: COMPATIBLE with glibc 2.31 (SMOS i066d)")
else:
    print(f"STATUS: INCOMPATIBLE - needs glibc 2.{max(versions)}")
