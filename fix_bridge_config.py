import sys

files = [
    "/root/zion-2.9.6-main/V3/L2/bridge/config/bridge-mainnet.toml",
    "/root/zion-2.9.6-main/V3/config/bridge-mainnet.toml",
]

for path in files:
    try:
        with open(path, "r") as f:
            content = f.read()
        old = content
        content = content.replace("5000000000000000000000000", "100000000000000000000000000")
        if content != old:
            with open(path, "w") as f:
                f.write(content)
            print(f"FIXED: {path}")
        else:
            print(f"NO CHANGE (already fixed or 5M not found): {path}")
    except FileNotFoundError:
        print(f"NOT FOUND: {path}")

print("--- VERIFY ---")
for path in files:
    try:
        with open(path, "r") as f:
            for line in f:
                if "max_single" in line:
                    print(f"{path}: {line.strip()}")
    except FileNotFoundError:
        pass
