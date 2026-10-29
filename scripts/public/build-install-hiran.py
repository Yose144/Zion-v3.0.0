#!/usr/bin/env python3
"""Pack scripts/public/hiran-cli into one self-contained install-hiran.sh."""
import base64
import io
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "scripts" / "public" / "hiran-cli"
NAMES = (
    "__main__.py",
    "config.py",
    "api.py",
    "session.py",
    "tools.py",
    "splash.py",
    "repl.py",
    "genesis_art.txt",
)
DESTS = (
    ROOT / "scripts" / "public" / "install-hiran.sh",
    ROOT / "apps" / "MarketPlace" / "public" / "install-hiran.sh",
    ROOT / "apps" / "website-v2.9" / "public" / "install-hiran.sh",
)

TEMPLATE = """#!/usr/bin/env bash
# Zion Hiran CLI — one-line install (macOS / Linux, Python 3).
#   curl -fsSL https://market.zionterranova.com/install-hiran.sh | bash
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

DEST="${HOME}/.local/bin"
SHARE="${HOME}/.local/share/zion-hiran"
mkdir -p "$DEST"
rm -rf "$SHARE"
mkdir -p "$SHARE"

b64decode() {
  if printf '' | base64 -d >/dev/null 2>&1; then
    base64 -d
  else
    base64 -D
  fi
}

b64decode << 'B64' | tar -xzf - -C "$SHARE"
__PAYLOAD__
B64

cat > "${DEST}/zion-hiran" << 'EOF'
#!/usr/bin/env bash
exec python3 "${HOME}/.local/share/zion-hiran/__main__.py" "$@"
EOF
chmod 755 "${DEST}/zion-hiran" "$SHARE"/*.py

SHELL_RC="${HOME}/.bashrc"
if [[ "${SHELL:-}" == *zsh ]]; then
  SHELL_RC="${HOME}/.zshrc"
fi
if [[ -f "$SHELL_RC" ]] && ! grep -q '.local/bin' "$SHELL_RC"; then
  printf '\\nexport PATH="$HOME/.local/bin:$PATH"\\n' >> "$SHELL_RC"
fi
export PATH="${DEST}:$PATH"

echo
echo "  Zion Hiran CLI installed → ${DEST}/zion-hiran"
echo "  Start:  zion-hiran"
echo "  (open a new terminal if the command is not found yet)"
echo
"""


def main():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name in NAMES:
            tar.add(PKG / name, arcname=name)
    payload = base64.b64encode(buf.getvalue()).decode("ascii")
    wrapped = "\n".join(payload[i : i + 76] for i in range(0, len(payload), 76))
    script = TEMPLATE.replace("__PAYLOAD__", wrapped)
    # The template escapes backslashes so the shipped script contains real \\n sequences
    # only where bash printf needs them. TEMPLATE above uses doubled backslashes in the
    # printf line; replace() does not interpret them.
    for dest in DESTS:
        dest.write_text(script, encoding="utf-8")
        dest.chmod(0o755)
        print("wrote", dest, "bytes", dest.stat().st_size)


if __name__ == "__main__":
    main()
