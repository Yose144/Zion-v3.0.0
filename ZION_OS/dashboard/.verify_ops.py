"""Assert that /api/ops/overview returned a usable payload (deploy check)."""
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ops-verify.json"
try:
    with open(path, encoding="utf-8") as fh:
        d = json.load(fh)
except Exception as exc:
    print(f"[dashboard] overview → BAD payload: {exc}")
    raise SystemExit(1)

f = d.get("fleet") or {}
p = d.get("pool") or {}
coins = ", ".join(
    f"{c.get('name')} {c.get('value')} {c.get('unit')}" for c in f.get("coins") or []
)
print(
    "[dashboard] overview → rigs=%s running=%s $/h=%s [%s] | pool %s/%s workers, "
    "accept %s%%, blocks %s | source=%s stale=%s"
    % (
        f.get("rigs"),
        f.get("running"),
        f.get("dph_h"),
        coins,
        p.get("active_miners"),
        p.get("miners"),
        p.get("accept_pct"),
        p.get("blocks_found"),
        d.get("source"),
        d.get("stale"),
    )
)

problems = []
if d.get("source", {}).get("fleet") not in ("file", "serve", "file-stale"):
    problems.append("fleet source is not file/serve")
if f.get("rigs") is None:
    problems.append("no fleet.rigs")
if not p:
    problems.append("pool section empty")
if problems:
    print("[dashboard] WARN " + "; ".join(problems))
    raise SystemExit(1)
