#!/usr/bin/env python3
"""vastctl — vast.ai multi-mining rig manager + web dashboard.

Stdlib only. Uses the `vastai` CLI for instance inventory and plain SSH
for probing rigs (nvidia-smi, miner processes, miner logs, xmrig API).

Usage:
    vastctl status                 # text table of all rigs
    vastctl serve [--port 8088]    # web dashboard (auto-refresh)
    vastctl deploy-xmrig <id>      # push config + install + launch XMRig
    vastctl exec <id> <cmd...>     # run a command on a rig
    vastctl logs <id>              # tail miner logs on a rig
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import shlex
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

VASTAI = os.environ.get("VASTAI_BIN", "vastai")
SSH_BASE = [
    "ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
    "-o", "BatchMode=yes", "-o", "LogLevel=ERROR",
]
DEFAULT_XMRIG_CONFIG = "xmrig-vast-cpu.json"
XMRIG_VERSION = "6.25.0"
XMRIG_TARBALL = f"https://github.com/xmrig/xmrig/releases/download/v{XMRIG_VERSION}/xmrig-{XMRIG_VERSION}-linux-static-x64.tar.gz"

# One SSH round-trip: GPU stats, miner processes, miner log tails, xmrig API.
PROBE_SCRIPT = r'''
echo "==GPU=="; nvidia-smi --query-gpu=utilization.gpu,power.draw,temperature.gpu,memory.used --format=csv,noheader 2>/dev/null
echo "==PROC=="; pgrep -af "SRBMiner|xmrig|zion-miner|ccminer" 2>/dev/null | grep -v pgrep
echo "==LOGS=="; for f in /root/srb-*.log /root/xmrig.log /root/miner*.log; do [ -f "$f" ] && echo "--$f--" && tail -45 "$f"; done
echo "==XMRIG_API=="; curl -s -m 3 http://127.0.0.1:16000/2/summary 2>/dev/null
echo "==END=="
'''

HR_RE = re.compile(
    r"Hashrate\s+([0-9.]+)\s+([KMGT]?H/s|h/s)\s+.*?(\d+)\s+(\d+)\s+(\d+)\s*$"
)
ALGO_RE = re.compile(r"--algorithm[ =](\S+)")
POOL_RE = re.compile(r"--pool[ =](\S+)")
WORKER_RE = re.compile(r"--worker[ =](\S+)")
LOG_HEAD_RE = re.compile(r"^--(.+?)--$")


def run(cmd, timeout=30):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"
    except FileNotFoundError as e:
        return 127, "", str(e)


def instances():
    rc, out, err = run([VASTAI, "show", "instances", "--raw"], timeout=30)
    if rc != 0:
        raise SystemExit(f"vastai show instances failed: {err.strip() or out.strip()}")
    return json.loads(out)


def ssh(inst, script, timeout=30):
    host, port = inst.get("ssh_host"), inst.get("ssh_port")
    if not host or not port:
        return 1, "", "no ssh endpoint"
    return run(SSH_BASE + ["-p", str(port), f"root@{host}", script], timeout=timeout)


def scp(inst, local, remote, timeout=60):
    host, port = inst.get("ssh_host"), inst.get("ssh_port")
    cmd = ["scp", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
           "-P", str(port), local, f"root@{host}:{remote}"]
    return run(cmd, timeout=timeout)


def parse_probe(inst, text):
    rig = {
        "id": inst["id"], "gpu_name": inst.get("gpu_name", "?"),
        "status": inst.get("actual_status", "?"),
        "dph": inst.get("dph_total", 0), "geo": inst.get("geolocation", "?"),
        "ssh": f"{inst.get('ssh_host')}:{inst.get('ssh_port')}",
        "gpu": {}, "miners": [], "xmrig_api": None, "error": None,
    }
    sec = None
    log_file = None
    hr_by_log = {}
    for line in text.splitlines():
        line = line.strip("\x1b").rstrip()
        clean = re.sub(r"\x1b\[[0-9;]*m", "", line).strip()
        if clean.startswith("==") and clean.endswith("=="):
            sec = clean.strip("=")
            continue
        if sec == "GPU" and "," in clean and not rig["gpu"]:
            parts = [p.strip() for p in clean.split(",")]
            if len(parts) >= 4:
                rig["gpu"] = {"util": parts[0], "power": parts[1],
                              "temp": parts[2], "mem": parts[3]}
        elif sec == "PROC" and clean:
            m = {"pid": clean.split()[0], "cmd": " ".join(clean.split()[1:]),
                 "algo": None, "pool": None, "worker": None}
            for rx, key in ((ALGO_RE, "algo"), (POOL_RE, "pool"), (WORKER_RE, "worker")):
                g = rx.search(clean)
                if g:
                    m[key] = g.group(1)
            if "xmrig" in clean.lower():
                m["algo"] = m["algo"] or "rx/0"
            rig["miners"].append(m)
        elif sec == "LOGS":
            g = LOG_HEAD_RE.match(clean)
            if g:
                log_file = g.group(1)
                continue
            h = HR_RE.search(clean)
            if h and log_file:
                hr_by_log[log_file] = {
                    "rate": float(h.group(1)), "unit": h.group(2),
                    "a": int(h.group(3)), "r": int(h.group(4)),
                }
        elif sec == "XMRIG_API" and clean.startswith("{"):
            try:
                api = json.loads(clean)
                hr = api.get("hashrate", {}).get("total", [])
                res = api.get("results", {})
                rig["xmrig_api"] = {
                    "hps_10s": hr[0] if len(hr) > 0 else 0,
                    "hps_15m": hr[2] if len(hr) > 2 else 0,
                    "shares_good": res.get("shares_good", 0),
                    "shares_total": res.get("shares_total", 0),
                    "algo": api.get("algo", "rx/0"),
                }
            except json.JSONDecodeError:
                pass
    # attach log hashrates to miners (best-effort: match algo token to log name)
    for m in rig["miners"]:
        for lf, hr in hr_by_log.items():
            if (m["algo"] and m["algo"].split("-")[0][:3] in lf) or \
               (m["algo"] == "pearlhash" and "prl" in lf) or \
               (m["algo"] == "quantus" and "qtu" in lf):
                m["hashrate"] = hr
                break
    return rig


def probe(inst):
    rc, out, err = ssh(inst, PROBE_SCRIPT, timeout=35)
    rig = parse_probe(inst, out)
    if rc != 0 and not out:
        rig["error"] = err.strip() or "ssh failed"
    return rig


def status_all(ids=None):
    insts = instances()
    if ids:
        insts = [i for i in insts if str(i["id"]) in ids]
    rigs = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(probe, i): i for i in insts}
        for f in as_completed(futs):
            rigs.append(f.result())
    return sorted(rigs, key=lambda r: r["id"])


def fmt_rate(hr):
    if not hr:
        return "—"
    return f"{hr['rate']:.2f} {hr['unit']} (A{hr['a']} R{hr['r']})"


def cmd_status(args):
    rigs = status_all(args.id)
    print(f"{'ID':<10} {'GPU':<11} {'$/h':<8} {'GPU%':<5} {'W':<7} {'miners':<7} detail")
    print("-" * 100)
    for r in rigs:
        g = r["gpu"]
        line = f"{r['id']:<10} {r['gpu_name'][:10]:<11} {r['dph']:<8.4f} " \
               f"{g.get('util','?'):<5} {g.get('power','?'):<7} {len(r['miners']):<7}"
        print(line + (r["error"] or ""))
        for m in r["miners"]:
            hr = m.get("hashrate")
            print(f"{'':>12}- {m['algo'] or '?':<10} {m.get('pool','?'):<28} "
                  f"{m.get('worker') or '?':<14} {fmt_rate(hr)}")
        if r["xmrig_api"]:
            xa = r["xmrig_api"]
            print(f"{'':>12}- {xa['algo']:<10} {'xmrig(api)':<28} {'cpu':<14} "
                  f"{xa['hps_15m']:.0f} H/s 15m (S{xa['shares_good']}/{xa['shares_total']})")
        if not r["miners"] and not r["error"]:
            print(f"{'':>12}(idle — no miners detected)")


def cmd_exec(args):
    inst = [i for i in instances() if str(i["id"]) == args.id]
    if not inst:
        raise SystemExit(f"instance {args.id} not found")
    cmd_args = [c for c in args.cmd if c != "--"]
    rc, out, err = ssh(inst[0], " ".join(cmd_args), timeout=120)
    sys.stdout.write(out)
    sys.stderr.write(err)
    return rc


def cmd_logs(args):
    inst = [i for i in instances() if str(i["id"]) == args.id]
    if not inst:
        raise SystemExit(f"instance {args.id} not found")
    rc, out, err = ssh(inst[0], 'for f in /root/srb-*.log /root/xmrig.log; do [ -f "$f" ] && echo "=== $f ===" && tail -20 "$f"; done', timeout=30)
    sys.stdout.write(out)
    sys.stderr.write(err)
    return rc


# ── daemon: autonomous fleet loop ─────────────────────────────────────────

_history = {}   # (rig_id, algo) -> [rate, ...]
_deploy_fail_at = {}  # rig_id -> epoch of last failed autodeploy


def snapshot(ids=None):
    rigs = status_all(ids)
    for r in rigs:
        for m in r["miners"]:
            hr = m.get("hashrate")
            if hr:
                key = (r["id"], m.get("algo") or "?")
                h = _history.setdefault(key, [])
                h.append(hr["rate"])
                del h[:-90]
                m["hist"] = list(h)
        if r["xmrig_api"]:
            key = (r["id"], r["xmrig_api"]["algo"])
            h = _history.setdefault(key, [])
            h.append(r["xmrig_api"]["hps_15m"])
            del h[:-90]
            r["xmrig_api"]["hist"] = list(h)
    return {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "total_dph": round(sum(r["dph"] for r in rigs), 4),
        "rigs": rigs,
    }


def _write_json_atomic(path, payload):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=1))
    tmp.rename(p)


def cmd_daemon(args):
    """Autonomous loop: probe → json-out (+push) → optional xmrig autodeploy."""
    print(f"[daemon] interval={args.interval}s out={args.json_out} push={args.push or '-'} autodeploy={args.autodeploy_xmrig}")
    while True:
        try:
            snap = snapshot()
            _write_json_atomic(args.json_out, snap)
            if args.push:
                host, _, rpath = args.push.partition(":")
                rc, _, err = run(["scp", "-o", "StrictHostKeyChecking=no",
                                  "-o", "ConnectTimeout=10", args.json_out,
                                  f"{host}:{rpath}"], timeout=30)
                if rc != 0:
                    print(f"[daemon] push failed: {err.strip()}")
            if args.autodeploy_xmrig:
                for r in snap["rigs"]:
                    if r["error"] or r["status"] != "running":
                        continue
                    has_xmrig = any("xmrig" in (m.get("cmd") or "") for m in r["miners"]) or r["xmrig_api"]
                    last = _deploy_fail_at.get(r["id"], 0)
                    if not has_xmrig and time.time() - last > 600:
                        print(f"[daemon] autodeploy xmrig → {r['id']}")
                        try:
                            ns = argparse.Namespace(id=str(r["id"]), config=args.config)
                            cmd_deploy_xmrig(ns)
                            _deploy_fail_at.pop(r["id"], None)
                        except SystemExit as e:
                            _deploy_fail_at[r["id"]] = time.time()
                            print(f"[daemon] deploy failed on {r['id']}: {e}")
            print(f"[daemon] {snap['ts']} rigs={len(snap['rigs'])} ${snap['total_dph']:.4f}/h")
        except Exception as e:
            print(f"[daemon] cycle error: {e}")
        time.sleep(args.interval)


def cmd_deploy_xmrig(args):
    cfg = Path(args.config)
    if not cfg.exists():
        raise SystemExit(f"config not found: {cfg}")
    inst = [i for i in instances() if str(i["id"]) == args.id]
    if not inst:
        raise SystemExit(f"instance {args.id} not found")
    inst = inst[0]
    rid = f"vast-{args.id}-cpu"
    print(f"[1/4] ensuring xmrig {XMRIG_VERSION} on {args.id}…")
    rc, out, err = ssh(inst, f'''
mkdir -p ~/miners && cd ~/miners &&
[ -f xmrig-{XMRIG_VERSION}/xmrig ] || (wget -q {XMRIG_TARBALL} && tar xzf xmrig-{XMRIG_VERSION}-linux-static-x64.tar.gz) &&
ls xmrig-{XMRIG_VERSION}/xmrig
''', timeout=120)
    if "xmrig" not in out:
        raise SystemExit(f"install failed: {err} {out}")
    print("[2/4] pushing config…")
    rc, out, err = scp(inst, str(cfg), f"~/miners/xmrig-{XMRIG_VERSION}/config.json")
    if rc != 0:
        raise SystemExit(f"scp failed: {err}")
    print(f"[3/4] setting rig-id={rid}, launching…")
    rc, out, err = ssh(inst, f'''
cd ~/miners/xmrig-{XMRIG_VERSION} &&
sed -i 's|"rig-id": "[^"]*"|"rig-id": "{rid}"|g; s|\\.vast-cpu/|.{rid}/|g' config.json &&
pkill -x xmrig 2>/dev/null; sleep 1
setsid nohup ./xmrig > /dev/null 2>&1 &
sleep 3 && pgrep -x xmrig && tail -5 /root/xmrig.log 2>/dev/null
''', timeout=60)
    print(out.strip() or "(no output)")
    print("[4/4] done — verify with: vastctl status")


def render_dashboard(rigs, ts):
    cards = []
    tot_cost = 0.0
    for r in rigs:
        tot_cost += r["dph"]
        rows = ""
        for m in r["miners"]:
            hr = m.get("hashrate")
            rows += (f"<tr><td>{html.escape(m['algo'] or '?')}</td>"
                     f"<td class=dim>{html.escape(m.get('pool') or '?')}</td>"
                     f"<td>{fmt_rate(hr)}</td></tr>")
        if r["xmrig_api"]:
            xa = r["xmrig_api"]
            rows += (f"<tr><td>{html.escape(xa['algo'])}</td><td class=dim>xmrig api</td>"
                     f"<td>{xa['hps_15m']:.0f} H/s 15m (S{xa['shares_good']}/{xa['shares_total']})</td></tr>")
        if not rows:
            rows = "<tr><td colspan=3 class=dim>idle</td></tr>"
        g = r["gpu"]
        err = f"<div class=err>{html.escape(r['error'])}</div>" if r["error"] else ""
        cards.append(f"""
<div class=card>
  <div class=hd><b>#{r['id']}</b> · {html.escape(r['gpu_name'])} ·
    <span class=dim>{html.escape(str(r['geo']))} · ${r['dph']:.4f}/h</span></div>
  <div class=sub>gpu {g.get('util','?')} · {g.get('power','?')} · {g.get('temp','?')} · vram {g.get('mem','?')} · <span class=dim>{r['ssh']}</span></div>
  {err}<table>{rows}</table>
  <form onsubmit="return run(this,{r['id']})"><input name=cmd placeholder="ssh cmd…"><button>run</button>
  <button formaction="/api/deploy-xmrig?id={r['id']}" formmethod=post type=button onclick="deploy({r['id']})">deploy xmrig</button></form>
</div>""")
    return f"""<!doctype html><meta charset=utf-8><title>vastctl</title><style>
body{{background:#0b0e14;color:#cfd8e3;font:14px/1.5 ui-monospace,monospace;margin:16px}}
h1{{font-size:18px}} .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px}}
.card{{background:#121723;border:1px solid #232c3d;border-radius:8px;padding:12px}}
.hd b{{color:#7ee787}} .sub,.dim{{color:#8b98a9}} .err{{color:#ff7b72}}
table{{width:100%;border-collapse:collapse;margin-top:8px}} td{{padding:2px 6px}}
input{{background:#0b0e14;border:1px solid #232c3d;color:#cfd8e3;padding:4px;width:70%}}
button{{background:#1f6feb;color:#fff;border:0;padding:4px 10px;border-radius:4px;cursor:pointer}}
.tot{{color:#8b98a9;margin:10px 0}}</style>
<h1>vastctl — vast.ai multi-mining</h1>
<div class=tot>{len(rigs)} rigs · ${tot_cost:.4f}/h = ${tot_cost*24:.2f}/day · refreshed {ts} · auto 30s</div>
<div class=grid>{''.join(cards)}</div>
<script>
setTimeout(()=>location.reload(),30000);
function run(f,id){{fetch('/api/exec?id='+id+'&cmd='+encodeURIComponent(f.cmd.value)).then(r=>r.text()).then(alert);return false}}
function deploy(id){{if(!confirm('deploy xmrig on '+id+'?'))return;fetch('/api/deploy-xmrig?id='+id,{{method:'POST'}}).then(r=>r.text()).then(alert)}}
</script>"""


class Handler(BaseHTTPRequestHandler):
    cfg_path = DEFAULT_XMRIG_CONFIG

    def log_message(self, *a):
        pass

    def _send(self, body, code=200, ctype="text/html; charset=utf-8"):
        b = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/api/status":
            self._send(json.dumps(status_all()), ctype="application/json")
        elif u.path == "/api/exec":
            iid, cmd = q.get("id", [""])[0], q.get("cmd", [""])[0]
            inst = [i for i in instances() if str(i["id"]) == iid]
            if not inst or not cmd:
                self._send("bad request", 400, "text/plain")
                return
            rc, out, err = ssh(inst[0], cmd, timeout=60)
            self._send((out + err).strip() or f"(exit {rc})", ctype="text/plain")
        else:
            rigs = status_all()
            self._send(render_dashboard(rigs, time.strftime("%H:%M:%S")))

    def do_POST(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/api/deploy-xmrig":
            iid = q.get("id", [""])[0]
            try:
                ns = argparse.Namespace(id=iid, config=self.cfg_path)
                import io, contextlib
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                    cmd_deploy_xmrig(ns)
                self._send(buf.getvalue(), ctype="text/plain")
            except SystemExit as e:
                self._send(f"failed: {e}", 500, "text/plain")
            except Exception as e:
                self._send(f"failed: {e}", 500, "text/plain")
        else:
            self._send("not found", 404, "text/plain")


def cmd_serve(args):
    Handler.cfg_path = args.config
    srv = ThreadingHTTPServer((args.bind, args.port), Handler)
    print(f"vastctl dashboard → http://{args.bind}:{args.port}  (ctrl-c to stop)")
    srv.serve_forever()


def main():
    ap = argparse.ArgumentParser(prog="vastctl", description=__doc__)
    ap.add_argument("--config", default=DEFAULT_XMRIG_CONFIG,
                    help="xmrig config json for deploy-xmrig/serve")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("status")
    p.add_argument("id", nargs="*")
    p = sub.add_parser("serve")
    p.add_argument("--port", type=int, default=8088)
    p.add_argument("--bind", default="127.0.0.1")
    p = sub.add_parser("deploy-xmrig")
    p.add_argument("id")
    p = sub.add_parser("exec")
    p.add_argument("id")
    p.add_argument("cmd", nargs=argparse.REMAINDER)
    p = sub.add_parser("logs")
    p.add_argument("id")
    args = ap.parse_args()
    if args.cmd == "status":
        return cmd_status(args)
    if args.cmd == "serve":
        return cmd_serve(args)
    if args.cmd == "deploy-xmrig":
        return cmd_deploy_xmrig(args)
    if args.cmd == "exec":
        return cmd_exec(args)
    if args.cmd == "logs":
        return cmd_logs(args)


if __name__ == "__main__":
    sys.exit(main() or 0)
