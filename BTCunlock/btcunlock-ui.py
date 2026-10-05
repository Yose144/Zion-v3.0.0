#!/usr/bin/env python3
"""BTCunlock keyscan live dashboard — stdlib-only web UI (v2).

Reads the scanner's checkpoint + log and serves a comprehensive status
page: puzzle info, live rate/history, coverage odds, milestones, GPU
telemetry, a persistent "hits vault" (found keys are appended to a
mode-600 JSON file so they survive log rotation), the puzzle catalog,
a copy-ready resume command, and the raw log tail.

    ./btcunlock-ui.py [--port 8777] [--host 0.0.0.0] \
        [--log ~/btcunlock-p71.log] [--ckpt ~/btcunlock-p71.ckpt] \
        [--vault ~/btcunlock-hits.json]

The page polls /api/status every 2 s. No dependencies, read-only.
"""

import datetime
import json
import os
import re
import subprocess
import sys
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.expanduser("~/btcunlock-p71.log")
CKPT = os.path.expanduser("~/btcunlock-p71.ckpt")
VAULT = os.path.expanduser("~/btcunlock-hits.json")
PUZZLE_TABLE_RS = os.path.join(HERE, "src", "puzzle_table.rs")

PROGRESS_RE = re.compile(
    r"0x([0-9a-f]+)\s+\((-?[\d.]+)%\)\s+—\s+([\d.]+\s*[kMGT]?k?/s)\s+—\s+(\d+)\s+hits\s+—\s+eta\s+(.+)$"
)
RANGE_RE = re.compile(r"\[0x([0-9a-f]+) \.\. 0x([0-9a-f]+)\)")
LABEL_RE = re.compile(r"keyscan \(([^)]+)\):")
RATE_RE = re.compile(r"([\d.]+)\s*([kMGT])k?/s")
GPU_LINE_RE = re.compile(r"^gpu: (.+)$")
TARGET_LINE_RE = re.compile(r"^\s+target #\d+:\s*(\S+)")
PUZZLE_ROW_RE = re.compile(r'\(\s*(\d+),\s*"([1-9A-HJ-NP-Za-km-z]{25,35})",\s*(true|false)\s*\)')

RATE_HIST = deque(maxlen=1800)  # (ts, Mk/s) — ~1 h at 2 s cadence

# ---------------------------------------------------------------- helpers


def last_lines(path, n=18, window=65536):
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - window))
            tail = f.read().decode("utf-8", "replace")
        return tail.strip().splitlines()[-n:]
    except OSError:
        return []


def head_lines(path, n=40):
    out = []
    try:
        with open(path, "r", errors="replace") as f:
            for _ in range(n):
                line = f.readline()
                if not line:
                    break
                out.append(line.rstrip("\n"))
    except OSError:
        pass
    return out


def read_window(path, window=262144):
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - window))
            return f.read().decode("utf-8", "replace")
    except OSError:
        return ""


def parse_rate(s):
    m = RATE_RE.search(s)
    if not m:
        return None
    mult = {"k": 1e-3, "M": 1.0, "G": 1e3, "T": 1e6}.get(m.group(2), 1.0)
    return float(m.group(1)) * mult


def gpu_info():
    try:
        out = subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=utilization.gpu,temperature.gpu,power.draw,"
                "memory.used,memory.total,name",
                "--format=csv,noheader,nounits",
            ],
            timeout=3,
            text=True,
        ).strip()
        util, temp, watts, mem, total, name = [
            x.strip() for x in out.splitlines()[0].split(",", 5)
        ]
        return {
            "util": int(float(util)),
            "temp": int(float(temp)),
            "watts": int(float(watts)),
            "mem": int(float(mem)),
            "mem_total": int(float(total)),
            "name": name.strip(),
        }
    except Exception:
        return None


def proc_info():
    """pid, etimes, ni, cmdline of the running btcunlock keyscan/puzzle proc."""
    try:
        for pid_s in subprocess.check_output(
            ["pgrep", "-x", "btcunlock"], text=True, timeout=3
        ).split():
            try:
                cmd = (
                    open(f"/proc/{pid_s}/cmdline", "rb")
                    .read()
                    .decode()
                    .split("\0")
                )
            except OSError:
                continue
            joined = " ".join(a for a in cmd if a)
            if "puzzle" in joined or "keyscan" in joined:
                stat = subprocess.check_output(
                    ["ps", "-o", "etimes=,ni=", "-p", pid_s], text=True, timeout=3
                ).split()
                return int(pid_s), int(stat[0]), int(stat[1]), joined
    except Exception:
        pass
    return None, None, None, None


def fmt_uptime(s):
    if s is None:
        return "—"
    d, s = divmod(s, 86400)
    h, s = divmod(s, 3600)
    m, s = divmod(s, 60)
    if d:
        return f"{d}d {h}h {m}m"
    if h:
        return f"{h}h {m}m"
    return f"{m}m {s}s"


def fmt_secs(secs):
    """Human interval for milestone ETAs."""
    if not (0 < secs < float("inf")):
        return "∞"
    if secs > 3.0e11:
        return ">10k years"
    if secs > 31_536_000:
        return f"{secs/31_536_000:.1f} years"
    if secs > 86400:
        return f"{secs/86400:.1f} days"
    if secs > 3600:
        return f"{secs/3600:.1f} h"
    if secs > 60:
        return f"{secs/60:.0f} min"
    return f"{secs:.0f} s"


def eta_date(secs):
    """Wall-clock ETA for milestones under ~3 years."""
    if secs > 3 * 365 * 86400:
        return ""
    return (datetime.datetime.now() + datetime.timedelta(seconds=secs)).strftime(
        "%Y-%m-%d %H:%M"
    )


# --------------------------------------------------------- puzzle catalog


def load_puzzles():
    """Parse src/puzzle_table.rs — (id, address, solved) tuples."""
    out = {}
    try:
        src = open(PUZZLE_TABLE_RS).read()
    except OSError:
        return out
    for m in PUZZLE_ROW_RE.finditer(src):
        out[int(m.group(1))] = {"addr": m.group(2), "solved": m.group(3) == "true"}
    return out


PUZZLES = load_puzzles()


# ------------------------------------------------------------ hits vault


def load_vault():
    try:
        with open(VAULT) as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


def save_vault(records):
    """Atomic write, mode 600 — this file is where found keys live."""
    tmp = VAULT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(records, f, indent=2)
        f.write("\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, VAULT)


def scan_log_hits(text):
    """Extract HIT blocks from log text → structured records."""
    recs = []
    pending_target = None
    cur = None
    for ln in text.splitlines():
        m = re.search(r"hit for target #\d+\s+(\S+)", ln)
        if m:
            pending_target = m.group(1)
        m = re.search(r"^HIT\s+key=0x([0-9a-f]+)", ln)
        if m:
            cur = {"key": "0x" + m.group(1), "target": pending_target}
            continue
        if cur is not None:
            m = re.search(r"key hex:\s*([0-9a-f]+)", ln)
            if m:
                cur["key_hex"] = m.group(1)
                continue
            m = re.search(r"WIF:\s*(\S+)", ln)
            if m:
                cur["wif"] = m.group(1)
                continue
            m = re.search(r"address:\s*(\S+)", ln)
            if m:
                cur["address"] = m.group(1)
                cur["ts"] = int(time.time())
                recs.append(cur)
                cur = None
    return recs


def hits_dir():
    """Scanner-side backup dir — <ckpt_dir>/btcunlock-hits/ (mode 600)."""
    return os.path.join(os.path.dirname(os.path.abspath(CKPT)), "btcunlock-hits")


def load_jsonl_hits():
    """Hits the SCANNER itself persisted — the primary source of truth.
    One JSON object per line in hits.jsonl."""
    recs = []
    path = os.path.join(hits_dir(), "hits.jsonl")
    try:
        with open(path, "r", errors="replace") as f:
            for ln in f:
                ln = ln.strip()
                if not ln:
                    continue
                try:
                    r = json.loads(ln)
                    r.setdefault("ts", r.get("ts"))
                    recs.append(r)
                except ValueError:
                    continue
    except OSError:
        pass
    return recs, path


# ---------------------------------------------------------------- status


def status():
    s = {"ok": True, "ts": int(time.time())}
    ck = {}
    try:
        ck = json.loads(open(CKPT).read())
    except Exception:
        pass

    lines = last_lines(LOG)
    head = head_lines(LOG)
    window = read_window(LOG)  # hit scan window (last 256 KB)

    # --- static scan facts (header region) ---
    label = gpu_name = None
    targets_hdr = []
    start = end = None
    for ln in head + list(reversed(lines)):
        if label is None:
            m = LABEL_RE.search(ln)
            if m:
                label = m.group(1)
        if start is None:
            m = RANGE_RE.search(ln)
            if m:
                start, end = int(m.group(1), 16), int(m.group(2), 16)
        if gpu_name is None:
            m = GPU_LINE_RE.search(ln.strip())
            if m and "key_scan" not in m.group(1):
                gpu_name = m.group(1).strip()
        m = TARGET_LINE_RE.search(ln)
        if m:
            targets_hdr.append(m.group(1))
    s["label"] = label
    s["gpu_name"] = gpu_name
    s["targets_hdr"] = targets_hdr

    # puzzle number → catalog entry
    pnum = None
    if label:
        m = re.search(r"puzzle #(\d+)", label)
        if m:
            pnum = int(m.group(1))
    if pnum and pnum in PUZZLES:
        s["puzzle"] = {
            "n": pnum,
            "address": PUZZLES[pnum]["addr"],
            "solved": PUZZLES[pnum]["solved"],
        }
    elif pnum:
        s["puzzle"] = {"n": pnum, "address": None, "solved": None}
    s["catalog"] = {
        "total": len(PUZZLES),
        "open": sum(1 for p in PUZZLES.values() if not p["solved"]),
        "open_list": [
            {"n": n, "addr": p["addr"]}
            for n, p in sorted(PUZZLES.items())
            if not p["solved"]
        ][:80],
    }

    # --- live progress ---
    rate = eta = None
    for ln in list(reversed(lines)):
        m = PROGRESS_RE.search(ln.strip())
        if m:
            rate = parse_rate(m.group(3))
            eta = m.group(5).strip()
            break
    if rate is not None:
        RATE_HIST.append((time.time(), rate))
    hist = [r for _, r in RATE_HIST]
    s["rate_mks"] = rate
    s["rate_min"] = min(hist) if hist else None
    s["rate_max"] = max(hist) if hist else None
    s["rate_avg"] = sum(hist) / len(hist) if hist else None
    s["rate_hist"] = hist[-360:]
    s["eta"] = eta or "—"

    pid, etimes, nice, cmdline = proc_info()
    s["alive"] = pid is not None
    s["pid"] = pid
    s["nice"] = nice
    s["uptime"] = fmt_uptime(etimes)
    s["uptime_s"] = etimes
    s["cmdline"] = cmdline

    next_key = int(ck.get("next_key", "0"), 16) if ck else 0
    size = (end - start) if (start and end) else 0
    offset = max(0, next_key - (start or 0))
    tested = ck.get("tested", 0)
    hits = ck.get("hits", 0)
    s["next_key"] = f"{next_key:064x}"
    s["offset"] = hex(offset)
    s["start"] = f"{start:x}" if start else None
    s["end"] = f"{end:x}" if end else None
    s["size"] = f"{size:x}" if size else None
    s["tested"] = tested
    s["hits"] = hits
    s["progress"] = 100.0 * offset / size if size else 0.0
    s["coverage_ppm"] = 1e6 * offset / size if size else 0.0
    s["odds"] = f"{size/max(offset,1):,.0f}" if offset and size else "—"
    s["per_day"] = (rate or 0) * 1e6 * 86400
    s["gpu"] = gpu_info()
    s["ckpt_age_s"] = (
        int(time.time() - os.path.getmtime(CKPT)) if os.path.exists(CKPT) else None
    )
    s["log_tail"] = lines

    # --- milestones (fraction of range → keys → ETA at current rate) ---
    s["milestones"] = []
    if size and rate and rate > 0:
        for pct in [1e-9, 1e-7, 1e-5, 1e-3, 0.01, 0.1, 1.0, 10.0, 50.0, 100.0]:
            need = size * pct / 100.0
            remain = max(0.0, need - offset)
            secs = remain / (rate * 1e6)
            s["milestones"].append(
                {
                    "pct": pct,
                    "keys": f"{need:.3e}",
                    "secs": secs,
                    "in": fmt_secs(secs),
                    "date": eta_date(secs),
                    "done": offset >= need,
                }
            )

    # --- hits vault: merge scanner-persisted hits + log-derived hits ---
    # the scanner's own hits.jsonl (written at hit time, mode 600) is the
    # primary source; log parsing is a fallback for older runs
    vault = load_vault()
    seen = {(r.get("key_hex"), r.get("address")) for r in vault}
    disk_hits, jsonl_path = load_jsonl_hits()
    new = [r for r in disk_hits + scan_log_hits(window)
           if (r.get("key_hex"), r.get("address")) not in seen]
    if new:
        vault.extend(new)
        try:
            save_vault(vault)
        except OSError:
            pass
    s["hits_dir"] = hits_dir()
    s["hits_jsonl"] = jsonl_path if os.path.exists(jsonl_path) else None
    s["hits_files"] = (
        len([f for f in os.listdir(hits_dir()) if f.startswith("hit-")])
        if os.path.isdir(hits_dir())
        else 0
    )
    # WIF is deliberately INCLUDED in the vault file (mode 600) — it is
    # the whole point of a recovery run — but masked out of the web
    # payload so a shoulder-surfer on the LAN page can't grab it. The
    # localhost-only /api/vault_wif endpoint reveals it on demand.
    for r in vault:
        r.pop("wif", None)
    s["vault"] = vault
    s["vault_path"] = VAULT
    return s


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            if self.path.startswith("/api/status"):
                self._send(200, "application/json", json.dumps(status()).encode())
            elif self.path.startswith("/api/vault_wif"):
                # reveal WIFs only to localhost clients
                if self.client_address[0] not in ("127.0.0.1", "::1"):
                    self._send(403, "application/json", b'{"error":"localhost only"}')
                    return
                self._send(200, "application/json", json.dumps(load_vault()).encode())
            else:
                self._send(200, "text/html; charset=utf-8", PAGE.encode())
        except Exception as e:  # a dashboard must never 500 the page loop
            try:
                self._send(200, "application/json", json.dumps({"ok": False, "err": str(e)}).encode())
            except Exception:
                pass


PAGE = """<!doctype html>
<html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>BTCunlock — keyscan live</title>
<style>
:root{--bg:#0a0e14;--fg:#c7d0dd;--dim:#5b6a7d;--acc:#37e08b;--warn:#f5b83d;--bad:#ff5d5d;--card:#111823;--edge:#1e2a3a;--gold:#e8c766}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--fg);font:14px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:18px;max-width:1150px;margin:0 auto}
h1{font-size:17px;letter-spacing:.5px;margin-bottom:2px}
.sub{color:var(--dim);font-size:12px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:10px;margin-bottom:10px}
.card{background:var(--card);border:1px solid var(--edge);border-radius:10px;padding:12px 14px;margin-bottom:10px}
.card .k{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px}
.card .v{font-size:22px;word-break:break-all}
.card .v small{font-size:12px;color:var(--dim)}
.mono{font-family:inherit;font-size:13px}
#hit{border-radius:10px;padding:18px;text-align:center;font-size:15px;margin-bottom:10px;background:var(--card);border:1px solid var(--edge)}
#hit.no{color:var(--dim)}
#hit.yes{background:#07281a;border-color:var(--acc);color:var(--acc);font-size:20px;font-weight:700;animation:pulse 1s infinite alternate}
@keyframes pulse{to{box-shadow:0 0 22px #37e08b66}}
.bar{height:14px;background:#0d141f;border:1px solid var(--edge);border-radius:7px;overflow:hidden;margin-top:6px}
.bar>div{height:100%;background:linear-gradient(90deg,#1f7a52,var(--acc));width:0%}
canvas{width:100%;height:100px;background:#0d141f;border:1px solid var(--edge);border-radius:8px}
pre{background:#0d141f;border:1px solid var(--edge);border-radius:8px;padding:10px;overflow:auto;font-size:12px;max-height:300px;line-height:1.5}
pre .h{color:var(--acc);font-weight:700}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--bad);margin-right:6px}
.dot.on{background:var(--acc);animation:pulse 1s infinite alternate}
.badge{display:inline-block;padding:1px 8px;border-radius:9px;font-size:11px;border:1px solid var(--edge)}
.badge.open{color:var(--gold);border-color:var(--gold)}
.badge.solved{color:var(--acc);border-color:var(--acc)}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{padding:4px 8px;text-align:left;border-bottom:1px solid #16202e}
th{color:var(--dim);font-weight:400;text-transform:uppercase;font-size:10px;letter-spacing:.6px}
tr.hl td{color:var(--gold)}
tr.done td{color:var(--dim);text-decoration:line-through}
.hdr{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px}
a{color:var(--acc)} button{cursor:pointer;background:#16202e;color:var(--fg);border:1px solid var(--edge);border-radius:6px;padding:2px 10px;font:inherit;font-size:11px}
button:hover{background:#1e2a3a}
details summary{cursor:pointer;color:var(--dim);padding:4px 0}
.copy{float:right}
.dim{color:var(--dim)}
.addr{font-size:15px;letter-spacing:.5px;color:var(--gold)}
</style></head><body>
<div class=hdr><h1>₿ BTCunlock — keyscan live</h1><span class=sub id=upd>—</span></div>
<div class=sub id=tagline>sequential coverage — a lottery ticket, not a plan</div>

<div class=card id=pcard><div class=k>target</div>
 <div><span id=plabel>—</span> <span id=pbadge class=badge>—</span></div>
 <div class=addr id=paddr>—</div>
 <div class=sub id=prange style="margin:6px 0 0">—</div>
</div>

<div id=hit class=no>SCANNING — no hit yet</div>
<div class=grid>
 <div class=card><div class=k>scanner</div><div class=v><span class=dot id=dot></span><span id=alive>—</span></div><div class=sub id=pid style="margin-top:4px">—</div></div>
 <div class=card><div class=k>throughput</div><div class=v id=rate>—</div><div class=sub id=ratestats style="margin-top:4px">—</div></div>
 <div class=card><div class=k>keys tested</div><div class=v id=tested>—</div><div class=sub id=perday style="margin-top:4px">—</div></div>
 <div class=card><div class=k>coverage of range</div><div class=v id=cov>—</div><div class=sub id=odds style="margin-top:4px">—</div></div>
 <div class=card><div class=k>gpu</div><div class=v id=gpu>—</div><div class=sub id=gpuname style="margin-top:4px">—</div></div>
 <div class=card><div class=k>uptime</div><div class=v id=up>—</div><div class=sub id=ckpt style="margin-top:4px">—</div></div>
</div>

<div class=card><div class=k>position in range</div>
 <div class=v style="font-size:15px" id=pos>—</div>
 <div class=bar><div id=barfill></div></div>
 <div class=sub id=barlbl style="margin:6px 0 0">—</div>
</div>

<div class=card><div class=k>throughput history (M keys/s)</div><canvas id=cv width=1100 height=100></canvas></div>

<div class=card><div class=k>milestones — time to reach X% of the range at current rate</div>
<table id=ms><tr><th>coverage</th><th>keys</th><th>time from now</th><th>date</th></tr></table></div>

<div class=card><div class=k>hits vault <button class=copy onclick="navigator.clipboard.writeText(location.origin+'/api/vault_wif')">vault api (localhost)</button></div>
<div class=sub id=vaultpath>—</div>
<table id=vault><tr><th>when</th><th>key</th><th>address</th><th>target</th></tr>
<tr><td colspan=4 class=dim id=vaultempty>empty — found keys land here and in the vault file (mode 600)</td></tr></table></div>

<div class=card><div class=k>resume command</div><pre id=cmd class=mono>—</pre></div>

<div class=card><details><summary id=cat>puzzle catalog</summary>
<table id=pt><tr><th>#</th><th>address</th><th>status</th></tr></table></details></div>

<div class=card><div class=k>log tail</div><pre id=log>…</pre></div>

<script>
function fmt(n){return Intl.NumberFormat('en-US').format(Math.round(n))}
function big(h){return h?('0x'+BigInt(h).toString(16)):'—'}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function hilite(line){return /^HIT|hit for target/.test(line)?'<span class=h>'+esc(line)+'</span>':esc(line)}
async function tick(){
 try{
  const s=await(await fetch('/api/status')).json();
  if(s.ok===false){document.getElementById('upd').textContent='ui error: '+s.err;return}
  document.getElementById('upd').textContent='updated '+new Date().toLocaleTimeString()+' · pid '+(s.pid??'—');
  document.getElementById('dot').className='dot '+(s.alive?'on':'');
  document.getElementById('alive').textContent=s.alive?('running'+(s.nice!=null?' · nice '+s.nice:'')):'STOPPED';
  document.getElementById('pid').textContent=(s.cmdline||'').split(' ').slice(0,6).join(' ')+'…';
  // puzzle card
  if(s.puzzle){document.getElementById('plabel').textContent='puzzle #'+s.puzzle.n+' · '+(s.puzzle.n)+'-bit key';
    const b=document.getElementById('pbadge');
    if(s.puzzle.solved===true){b.className='badge solved';b.textContent='solved — self-test'}
    else if(s.puzzle.solved===false){b.className='badge open';b.textContent='OPEN'}
    else{b.className='badge';b.textContent='unknown'}
    document.getElementById('paddr').textContent=s.puzzle.address||'(address not in catalog)'}
  else{document.getElementById('plabel').textContent=s.label||'keyscan';
    document.getElementById('paddr').textContent=(s.targets_hdr||[]).join(', ')}
  document.getElementById('prange').textContent='range ['+big(s.start)+' , '+big(s.end)+') · size '+(s.size?('0x'+BigInt(s.size).toString(16)):'—');
  document.getElementById('rate').innerHTML=(s.rate_mks!=null?s.rate_mks.toFixed(2):'—')+' <small>MK/s</small>';
  document.getElementById('ratestats').textContent=s.rate_avg!=null?('min '+(s.rate_min||0).toFixed(1)+' · avg '+s.rate_avg.toFixed(1)+' · max '+(s.rate_max||0).toFixed(1)):'';
  document.getElementById('tested').textContent=fmt(s.tested);
  document.getElementById('perday').textContent='~'+(s.per_day/1e12).toFixed(2)+'e12 keys/day';
  document.getElementById('cov').innerHTML=s.coverage_ppm.toExponential(2)+' <small>ppm</small>';
  document.getElementById('odds').textContent='progress '+s.progress.toExponential(2)+' % · 1 in '+s.odds;
  document.getElementById('gpu').innerHTML=s.gpu?`${s.gpu.util}% <small>· ${s.gpu.temp}°C · ${s.gpu.watts}W · ${s.gpu.mem}/${s.gpu.mem_total}MB</small>`:'—';
  document.getElementById('gpuname').textContent=s.gpu?s.gpu.name:'';
  document.getElementById('up').textContent=s.uptime;
  document.getElementById('ckpt').textContent='checkpoint '+(s.ckpt_age_s!=null?s.ckpt_age_s+'s ago':'—');
  document.getElementById('pos').textContent='key 0x'+s.next_key+'  (+'+big(s.offset)+' into range)';
  const pct=Math.max(s.progress,0);
  document.getElementById('barfill').style.width=Math.min(Math.max(pct*100,0.4),100)+'%';
  document.getElementById('barlbl').textContent=`covered ${s.progress.toExponential(4)} % · eta full range ${s.eta}`;
  const h=document.getElementById('hit');
  if(s.hits>0){h.className='yes';h.textContent='★ HIT — '+s.hits+' match(es) — see vault ★'}
  else{h.className='no';h.textContent='SCANNING — no hit yet'}
  draw(s.rate_hist||[]);
  // milestones
  const ms=document.getElementById('ms');ms.innerHTML='<tr><th>coverage</th><th>keys</th><th>time from now</th><th>date</th></tr>';
  (s.milestones||[]).forEach(m=>{const tr=document.createElement('tr');if(m.done)tr.className='done';
   tr.innerHTML=`<td>${m.pct} %</td><td>${m.keys}</td><td>${m.done?'✓':m.in}</td><td>${m.date||''}</td>`;ms.appendChild(tr)});
  // vault
  document.getElementById('vaultpath').textContent='file: '+s.vault_path+' (600) · scanner dir: '+s.hits_dir+' ('+(s.hits_files||0)+' hit file'+(s.hits_files===1?'':'s')+(s.hits_jsonl?' + hits.jsonl':'')+')';
  const vt=document.getElementById('vault');vt.innerHTML='<tr><th>when</th><th>key</th><th>address</th><th>target</th></tr>';
  if(!(s.vault||[]).length){vt.innerHTML+='<tr><td colspan=4 class=dim>empty — found keys land here and in the vault file</td></tr>'}
  (s.vault||[]).forEach(r=>{const tr=document.createElement('tr');
   tr.innerHTML=`<td>${r.time||(r.ts?new Date(r.ts*1000).toLocaleString():'—')}</td><td class=mono>${r.key||''}</td><td class=mono>${r.address||''}</td><td class=mono>${r.target||''}</td>`;vt.appendChild(tr)});
  document.getElementById('cmd').textContent=s.alive?('# restart same scan:\\ncd ~/2.9.6-main/BTCunlock\\nsetsid nohup '+s.cmdline.replace(' --gpu',' --gpu --resume')+' &'):'—';
  // catalog
  const cat=document.getElementById('cat');cat.textContent=`puzzle catalog — ${s.catalog.open} open / ${s.catalog.total} total (open shown)`;
  const pt=document.getElementById('pt');pt.innerHTML='<tr><th>#</th><th>address</th><th>status</th></tr>';
  (s.catalog.open_list||[]).forEach(p=>{const tr=document.createElement('tr');if(s.puzzle&&p.n===s.puzzle.n)tr.className='hl';
   tr.innerHTML=`<td>#${p.n}</td><td class=mono>${p.addr}</td><td>open</td>`;pt.appendChild(tr)});
  document.getElementById('log').innerHTML=(s.log_tail||[]).map(hilite).join('\\n');
 }catch(e){document.getElementById('upd').textContent='ui: '+e}
}
function draw(hist){
 const c=document.getElementById('cv'),x=c.getContext('2d');
 const W=c.width,H=c.height;x.clearRect(0,0,W,H);
 if(hist.length<2)return;
 const mx=Math.max(...hist)*1.15,mn=Math.min(...hist)*0.85;
 x.strokeStyle='#37e08b';x.lineWidth=1.5;x.beginPath();
 hist.forEach((v,i)=>{const px=i/(hist.length-1)*W,py=H-((v-mn)/(mx-mn||1))*(H-10)-5;i?x.lineTo(px,py):x.moveTo(px,py)});
 x.stroke();
 x.fillStyle='#5b6a7d';x.font='11px ui-monospace';
 x.fillText(mx.toFixed(1),4,12);x.fillText(mn.toFixed(1),4,H-4);
}
tick();setInterval(tick,2000);
</script></body></html>"""


if __name__ == "__main__":
    host = "0.0.0.0"
    port = 8777
    args = sys.argv[1:]
    for i, a in enumerate(args):
        if a == "--port" and i + 1 < len(args):
            port = int(args[i + 1])
        if a == "--host" and i + 1 < len(args):
            host = args[i + 1]
        if a == "--log" and i + 1 < len(args):
            LOG = os.path.expanduser(args[i + 1])
        if a == "--ckpt" and i + 1 < len(args):
            CKPT = os.path.expanduser(args[i + 1])
        if a == "--vault" and i + 1 < len(args):
            VAULT = os.path.expanduser(args[i + 1])
    n = sum(1 for p in PUZZLES.values() if not p["solved"])
    print(f"keyscan UI → http://{host}:{port}")
    print(f"  log={LOG}  ckpt={CKPT}  vault={VAULT}")
    print(f"  puzzle catalog: {len(PUZZLES)} entries ({n} open)")
    ThreadingHTTPServer((host, port), H).serve_forever()
