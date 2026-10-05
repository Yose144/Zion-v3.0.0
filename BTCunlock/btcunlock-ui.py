#!/usr/bin/env python3
"""BTCunlock keyscan live dashboard — stdlib-only web UI.

Reads the scanner's checkpoint + log and serves a small status page:

    ./btcunlock-ui.py [--port 8777] [--host 0.0.0.0] \
        [--log ~/btcunlock-p71.log] [--ckpt ~/btcunlock-p71.ckpt]

The page polls /api/status every 2 s. No dependencies, no writes —
read-only window into the running scan.
"""

import json
import os
import re
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOG = os.path.expanduser("~/btcunlock-p71.log")
CKPT = os.path.expanduser("~/btcunlock-p71.ckpt")

PROGRESS_RE = re.compile(
    r"0x([0-9a-f]+)\s+\((-?[\d.]+)%\)\s+—\s+([\d.]+\s*[kMGT]?k?/s)\s+—\s+(\d+)\s+hits\s+—\s+eta\s+(.+)$"
)
RANGE_RE = re.compile(r"\[0x([0-9a-f]+) \.\. 0x([0-9a-f]+)\)")
RATE_RE = re.compile(r"([\d.]+)\s*([kMGT])k?/s")

PAGE = """<!doctype html>
<html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>BTCunlock — puzzle #71</title>
<style>
:root{--bg:#0a0e14;--fg:#c7d0dd;--dim:#5b6a7d;--acc:#37e08b;--warn:#f5b83d;--bad:#ff5d5d;--card:#111823;--edge:#1e2a3a}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--fg);font:14px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:18px;max-width:1100px;margin:0 auto}
h1{font-size:17px;letter-spacing:.5px;color:var(--fg);margin-bottom:2px}
.sub{color:var(--dim);font-size:12px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-bottom:10px}
.card{background:var(--card);border:1px solid var(--edge);border-radius:10px;padding:12px 14px}
.card .k{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.8px}
.card .v{font-size:22px;margin-top:4px;word-break:break-all}
.card .v small{font-size:12px;color:var(--dim)}
#hit{border:1px solid var(--edge);border-radius:10px;padding:18px;text-align:center;font-size:15px;margin:10px 0;background:var(--card)}
#hit.no{color:var(--dim)}
#hit.yes{background:#07281a;border-color:var(--acc);color:var(--acc);font-size:20px;font-weight:700;animation:pulse 1s infinite alternate}
@keyframes pulse{to{box-shadow:0 0 22px #37e08b66}}
.bar{height:14px;background:#0d141f;border:1px solid var(--edge);border-radius:7px;overflow:hidden;margin-top:6px}
.bar>div{height:100%;background:linear-gradient(90deg,#1f7a52,var(--acc));width:0%}
canvas{width:100%;height:90px;background:#0d141f;border:1px solid var(--edge);border-radius:8px}
pre{background:#0d141f;border:1px solid var(--edge);border-radius:8px;padding:10px;overflow:auto;font-size:12px;max-height:280px}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--bad);margin-right:6px}
.dot.on{background:var(--acc);animation:pulse 1s infinite alternate}
a{color:var(--acc)}
.hdr{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px}
</style></head><body>
<div class=hdr><h1>₿ BTCunlock — keyscan live</h1><span class=sub id=upd>—</span></div>
<div class=sub id=rangeline>puzzle #71 · range [2<sup>70</sup>, 2<sup>71</sup>) · sequential coverage is a lottery ticket, not a plan</div>
<div id=hit class=no>SCANNING — no hit yet</div>
<div class=grid>
 <div class=card><div class=k>scanner</div><div class=v><span class=dot id=dot></span><span id=alive>—</span></div></div>
 <div class=card><div class=k>throughput</div><div class=v id=rate>—</div></div>
 <div class=card><div class=k>keys tested</div><div class=v id=tested>—</div></div>
 <div class=card><div class=k>coverage of range</div><div class=v id=cov>—</div></div>
 <div class=card><div class=k>gpu</div><div class=v id=gpu>—</div></div>
 <div class=card><div class=k>uptime</div><div class=v id=up>—</div></div>
</div>
<div class=card style=margin-bottom:10px>
 <div class=k>position in range</div>
 <div class=v style="font-size:15px" id=pos>—</div>
 <div class=bar><div id=barfill></div></div>
 <div class=sub id=barlbl style="margin:6px 0 0">—</div>
</div>
<div class=card style=margin-bottom:10px><div class=k>throughput history (M keys/s)</div><canvas id=cv width=1000 height=90></canvas></div>
<div class=card><div class=k>log tail</div><pre id=log>…</pre></div>
<script>
const hist=[];
function fmt(n){return Intl.NumberFormat('en-US').format(Math.round(n))}
function bighex(h){return '0x'+BigInt(h).toString(16)}
async function tick(){
 try{
  const s=await(await fetch('/api/status')).json();
  document.getElementById('upd').textContent='updated '+new Date().toLocaleTimeString()+' · pid '+(s.pid??'—');
  document.getElementById('dot').className='dot '+(s.alive?'on':'');
  document.getElementById('alive').textContent=s.alive?('running'+(s.nice!=null?' · nice '+s.nice:'')):'STOPPED';
  document.getElementById('rate').innerHTML=(s.rate_mks!=null?s.rate_mks.toFixed(2):'—')+' <small>MK/s</small>';
  document.getElementById('tested').textContent=fmt(s.tested);
  document.getElementById('cov').innerHTML=s.coverage_ppm.toExponential(2)+' <small>ppm</small><br><small>1 in '+s.odds+'</small>';
  document.getElementById('gpu').innerHTML=s.gpu?`${s.gpu.util}% <small>· ${s.gpu.temp}°C · ${s.gpu.watts}W · ${s.gpu.mem}MB</small>`:'—';
  document.getElementById('up').textContent=s.uptime;
  document.getElementById('pos').textContent='key 0x'+s.next_key+'  (+'+bighex(s.offset)+' into range)';
  const pct=Math.max(s.progress*100,0);
  document.getElementById('barfill').style.width=Math.min(Math.max(pct,0.35),100)+'%';
  document.getElementById('barlbl').textContent=`covered ${s.progress.toExponential(4)} % of range · eta full range ${s.eta} · ~${(s.per_day/1e12).toFixed(2)}e12 keys/day`;
  const h=document.getElementById('hit');
  if(s.hits>0){h.className='yes';h.textContent='★ HIT — '+s.hits+' match(es) — see log below ★'}
  else{h.className='no';h.textContent='SCANNING — no hit yet'}
  if(s.rate_mks!=null){hist.push(s.rate_mks);if(hist.length>240)hist.shift();draw()}
  document.getElementById('log').textContent=s.log_tail.join('\\n');
 }catch(e){document.getElementById('upd').textContent='ui: '+e}
}
function draw(){
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


def last_lines(path, n=18):
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 8192))
            tail = f.read().decode("utf-8", "replace")
        return tail.strip().splitlines()[-n:]
    except OSError:
        return []


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
                "--query-gpu=utilization.gpu,temperature.gpu,power.draw,memory.used",
                "--format=csv,noheader,nounits",
            ],
            timeout=3,
            text=True,
        ).strip()
        util, temp, watts, mem = [x.strip() for x in out.splitlines()[0].split(",")]
        return {"util": int(float(util)), "temp": int(float(temp)),
                "watts": int(float(watts)), "mem": int(float(mem))}
    except Exception:
        return None


def proc_info():
    """pid, etimes, ni of the running btcunlock keyscan/puzzle process."""
    try:
        for pid_s in subprocess.check_output(
            ["pgrep", "-x", "btcunlock"], text=True, timeout=3
        ).split():
            try:
                cmd = open(f"/proc/{pid_s}/cmdline", "rb").read().decode()
            except OSError:
                continue
            if "puzzle" in cmd or "keyscan" in cmd:
                stat = subprocess.check_output(
                    ["ps", "-o", "etimes=,ni=", "-p", pid_s], text=True, timeout=3
                ).split()
                return int(pid_s), int(stat[0]), int(stat[1])
    except Exception:
        pass
    return None, None, None


def head_lines(path, n=40):
    try:
        with open(path, "r", errors="replace") as f:
            out = []
            for _ in range(n):
                line = f.readline()
                if not line:
                    break
                out.append(line.rstrip("\n"))
            return out
    except OSError:
        return []


def fmt_uptime(s):
    if s is None:
        return "—"
    d, s = divmod(s, 86400)
    h, s = divmod(s, 3600)
    m, s = divmod(s, 60)
    return f"{d}d {h}h" if d else (f"{h}h {m}m" if h else f"{m}m {s}s")


def status():
    ck = {}
    try:
        ck = json.loads(open(CKPT).read())
    except Exception:
        pass
    lines = last_lines(LOG)
    start = end = None
    rate = eta = None
    # range header is written once at scan start — it scrolls out of the
    # tail, so look at the head of the log as a fallback
    for ln in list(reversed(lines)) + head_lines(LOG):
        m = RANGE_RE.search(ln)
        if m:
            start, end = int(m.group(1), 16), int(m.group(2), 16)
            break
    for ln in list(reversed(lines)):
        m = PROGRESS_RE.search(ln.strip())
        if m:
            rate = parse_rate(m.group(3))
            eta = m.group(5).strip()
            break
    pid, etimes, nice = proc_info()
    next_key = int(ck.get("next_key", "0"), 16) if ck else 0
    size = (end - start) if (start and end) else 1
    offset = max(0, next_key - (start or 0))
    tested = ck.get("tested", 0)
    hits = ck.get("hits", 0)
    progress = 100.0 * offset / size if size else 0.0
    cov_ppm = 1e6 * offset / size if size else 0.0
    odds = f"{size/max(offset,1):,.0f}" if offset else "—"
    return {
        "alive": pid is not None,
        "pid": pid,
        "nice": nice,
        "uptime": fmt_uptime(etimes),
        "next_key": f"{next_key:064x}",
        "offset": hex(offset),
        "start": f"{start:x}" if start else None,
        "end": f"{end:x}" if end else None,
        "tested": tested,
        "hits": hits,
        "rate_mks": rate,
        "eta": eta or "—",
        "progress": progress,
        "coverage_ppm": cov_ppm,
        "odds": odds,
        "per_day": (rate or 0) * 1e6 * 86400,
        "gpu": gpu_info(),
        "log_tail": lines,
        "ckpt_age_s": int(time.time() - os.path.getmtime(CKPT))
        if os.path.exists(CKPT)
        else None,
    }


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/api/status"):
            body = json.dumps(status()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
        else:
            body = PAGE.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


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
    print(f"keyscan UI → http://{host}:{port}  (log={LOG} ckpt={CKPT})")
    ThreadingHTTPServer((host, port), H).serve_forever()
