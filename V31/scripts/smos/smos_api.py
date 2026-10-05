#!/usr/bin/env python3
"""sgminer/TRM-compatible stats API for SimpleMining.

SMOS enables miner-API polling for custom miners when the package name starts
with a supported miner name (e.g. teamredminer-*.zip).  The agent then queries
the sgminer-5.5 TCP JSON API on 127.0.0.1:4028 and, for dual mining, :4029.

This sidecar serves that API, reading live numbers from the JSON stats file
that zion-miner writes every log-interval (ZION_STATS_FILE).

Port mapping (TRM dual convention):
  4028 primary -> QTU QPoW stream (Vega 64, gpu-external)
  4029 dual    -> ZION deeksha stream (RX 5600 XT, zion)
"""

import json
import os
import socket
import socketserver
import threading
import time

STATS_FILE = os.environ.get("ZION_STATS_FILE", "/tmp/zion-miner-stats.json")
BIND = "127.0.0.1"
PORT_PRIMARY = 4028
PORT_DUAL = 4029
# Diagnostic heartbeat: report each API request to the Edge nginx access log
# so we can observe whether/when SMOS polls.  Throttled to 1/min.
EXFIL_URL = os.environ.get("ZION_API_EXFIL", "http://62.171.141.136/zion-miner/api-beat")
_last_exfil = 0.0
API_VERSION = "3.7"
MINER_NAME = "teamredminer"
MINER_VER = "0.10.5"


def read_stats():
    try:
        with open(STATS_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def stream(stats, name):
    return (stats.get("streams") or {}).get(name) or {}


def hps_to_mhs(v):
    try:
        return float(v) / 1e6
    except Exception:
        return 0.0


def status(msg="ok", ndevs=2):
    # cgminer-style status: devs reports "N GPU(s)", summary "Summary".
    if msg == "devs":
        msg = f"{ndevs} GPU(s)"
    elif msg == "summary":
        msg = "Summary"
    return [{"STATUS": "S", "When": int(time.time()), "Code": 0,
             "Msg": msg, "Description": f"{MINER_NAME} {MINER_VER}"}]


def dev_entry(idx, name, algo, mhs, acc, rej, active):
    return {
        "ID": idx, "GPU": idx, "Enabled": "Y" if active else "N",
        "Status": "Alive" if active else "Dead",
        "Name": name, "ASC": idx, "Device": idx,
        "Temperature": 0.0, "Fan Speed": -1, "Fan Percent": -1,
        "GPU Clock": -1, "Memory Clock": -1,
        "MHS av": round(mhs, 4), "MHS 5s": round(mhs, 4),
        "MHS 1m": round(mhs, 4), "MHS 5m": round(mhs, 4),
        "MHS 15m": round(mhs, 4),
        "Accepted": int(acc), "Rejected": int(rej),
        "Hardware Errors": 0, "Utility": 0.0,
        "Intensity": "", "Last Share Pool": 0,
        "Last Share Time": int(time.time()) if acc else 0,
        "Total MH": 0.0, "Diff1 Work": 0.0,
        "Difficulty Accepted": float(acc), "Difficulty Rejected": float(rej),
        "Last Valid Work": int(time.time()),
        "Algo": algo,
    }


def primary_payload(stats):
    """Primary payload: QTU QPoW.  DEVS index = SMOS PCI order:
    GPU0=RX 5600 XT (does not mine QTU -> 0), GPU1=RX Vega 64 (~50 MH/s)."""
    gpu = stream(stats, "gpu-external")
    zion = stream(stats, "zion")
    mhs = hps_to_mhs(gpu.get("hashrate_hps"))
    devs = [
        dev_entry(0, "RX 5600 XT", "qpow-poseidon2", 0.0, 0, 0, True),
        dev_entry(1, "RX Vega 64", "qpow-poseidon2", mhs,
                  gpu.get("accepted", 0), gpu.get("rejected", 0),
                  bool(gpu.get("active"))),
    ]
    acc = int(gpu.get("accepted") or 0)
    rej = int(gpu.get("rejected") or 0)
    summary = {
        "Elapsed": int(time.time() - START_TS),
        "MHS av": round(mhs, 4), "MHS 5s": round(mhs, 4),
        "MHS 1m": round(mhs, 4), "MHS 5m": round(mhs, 4),
        "MHS 15m": round(mhs, 4),
        "KHS av": round(mhs * 1000, 1),
        "Accepted": acc, "Rejected": rej,
        "Difficulty Accepted": float(acc), "Difficulty Rejected": float(rej),
        "Hardware Errors": 0, "Utility": 0.0, "Discarded": 0, "Stale": 0,
        "Total MH": 0.0, "Work Utility": 0.0,
        "Algo": "qpow-poseidon2",
    }
    return devs, summary


def dual_payload(stats):
    """Dual payload: ZION deeksha on the 5600 XT."""
    zion = stream(stats, "zion")
    mhs = hps_to_mhs(zion.get("hashrate_hps"))
    devs = [
        dev_entry(0, "RX 5600 XT", "ekam_deeksha", mhs,
                  zion.get("accepted", 0), zion.get("rejected", 0),
                  bool(zion.get("active"))),
        dev_entry(1, "RX Vega 64", "ekam_deeksha", 0.0, 0, 0, True),
    ]
    acc = int(zion.get("accepted") or 0)
    rej = int(zion.get("rejected") or 0)
    summary = {
        "Elapsed": int(time.time() - START_TS),
        "MHS av": round(mhs, 4), "MHS 5s": round(mhs, 4),
        "MHS 1m": round(mhs, 4), "MHS 5m": round(mhs, 4),
        "MHS 15m": round(mhs, 4),
        "KHS av": round(mhs * 1000, 1),
        "Accepted": acc, "Rejected": rej,
        "Difficulty Accepted": float(acc), "Difficulty Rejected": float(rej),
        "Hardware Errors": 0, "Utility": 0.0, "Discarded": 0, "Stale": 0,
        "Total MH": 0.0, "Work Utility": 0.0,
        "Algo": "ekam_deeksha",
    }
    return devs, summary


START_TS = time.time()


def sections_for(cmd, dual):
    """Build response sections: list of (section_name, kind, [(record_key,
    fields_dict)]).  A trailing "2" selects the dual-algo payload."""
    stats = read_stats()
    parts = [p.strip().lower() for p in (cmd or "summary").split("+")]
    parts = [p for p in parts if p]
    sections = []
    for c in parts:
        d2 = dual or c.endswith("2")
        base = c[:-1] if c.endswith("2") else c
        devs, summary = dual_payload(stats) if d2 else primary_payload(stats)
        if base.startswith("dev"):
            sections.append((c, "devs", [("DEVS", d) for d in devs]))
        elif base.startswith("sum"):
            sections.append((c, "summary", [("SUMMARY", summary)]))
        elif base.startswith("pool"):
            sections.append((c, "pools",
                             [("POOLS", p) for p in pools_payload(summary)]))
        elif base.startswith("ver"):
            sections.append((c, "version", [("VERSION", {
                "Miner": MINER_NAME, "CGMiner": MINER_VER,
                "API": API_VERSION})]))
        elif base.startswith("coin"):
            sections.append((c, "coin", [("COIN", {
                "Method": "qpow", "Current Block Time": 0.0,
                "Current Block Hash": "", "LP": False,
                "Network Difficulty": 0.0})]))
    if not sections:
        _, summary = dual_payload(stats) if dual else primary_payload(stats)
        sections = [("summary", "summary", [("SUMMARY", summary)])]
    return sections


def handle(cmd, dual):
    """JSON response.  cgminer joins multi-commands as nested sections keyed
    by the lowercase command name; flat keys are emitted too for parsers
    that ignore the nesting."""
    sections = sections_for(cmd, dual)
    nested = len(sections) > 1
    resp = {"id": 1, "STATUS": status("ok")}
    for name, kind, recs in sections:
        st = status(kind)
        sub = {"STATUS": st, "id": 1}
        for rn, fields in recs:
            sub.setdefault(rn, []).append(fields)
            if name.endswith("2") and rn in ("DEVS", "SUMMARY"):
                sub.setdefault(rn + "2", []).append(fields)
        if nested:
            resp[name] = sub
        else:
            resp["STATUS"] = st
        for rn, fields in recs:
            key = rn + "2" if name.endswith("2") and rn in ("DEVS", "SUMMARY") else rn
            resp.setdefault(key, []).append(fields)
            resp.setdefault(rn, []).append(fields)
    return resp


def _txt_val(v):
    s = str(v)
    return s.replace("|", " ").replace(",", " ")


def handle_text(cmd, dual):
    """cgminer plain-text response: records joined by '|', fields
    'key=value' comma-separated, each multi-command section prefixed with
    'CMD=name'.  STATUS records carry no record-name prefix."""
    sections = sections_for(cmd, dual)
    multi = len(sections) > 1
    out = []
    for name, kind, recs in sections:
        if multi:
            out.append(f"CMD={name}")
        for st in status(kind):
            out.append(",".join(f"{k}={_txt_val(v)}" for k, v in st.items()))
        for rn, fields in recs:
            out.append(rn + "=" + ",".join(
                f"{k}={_txt_val(v)}" for k, v in fields.items()))
    return "|".join(out) + "|"


def pools_payload(summary):
    return [{
            "POOL": 0, "URL": "zion-pool:8444", "Status": "Alive",
            "Priority": 0, "Quota": 1, "Long Poll": "N",
            "Getworks": 0, "Accepted": summary["Accepted"],
            "Rejected": summary["Rejected"], "Works": 0,
            "Discarded": 0, "Stale": 0, "Get Failures": 0,
            "Remote Failures": 0, "User": "vega-smos",
            "Last Share Time": int(time.time()),
            "Diff1 Shares": 0.0, "Proxy Type": "", "Proxy": "",
            "Difficulty Accepted": summary["Difficulty Accepted"],
            "Difficulty Rejected": summary["Difficulty Rejected"],
            "Difficulty Stale": 0.0, "Last Share Difficulty": 0.0,
            "Work Difficulty": 0.0, "Has Stratum": True,
            "Stratum Active": True, "Stratum URL": "zion-pool:8444",
            "Stratum Difficulty": 0.0, "Has Vmask": False,
            "Has GBT": False, "Best Share": 0.0,
            "Pool Rejected%": 0.0, "Pool Stale%": 0.0,
            "Bad Work": 0, "Current Block Height": 0,
            "Current Block Version": 0,
        }]


def exfil(tag):
    global _last_exfil
    now = time.time()
    if now - _last_exfil < 60:
        return
    _last_exfil = now
    try:
        import urllib.request
        safe = "".join(ch if ch.isalnum() or ch in "+-_" else "_" for ch in tag)[:80]
        def _beat():
            try:
                urllib.request.urlopen(f"{EXFIL_URL}-{safe}", timeout=8).read()
            except Exception:
                pass
        threading.Thread(target=_beat, daemon=True).start()
    except Exception:
        pass


class Handler(socketserver.BaseRequestHandler):
    dual = False

    def handle(self):
        try:
            self.request.settimeout(5)
            data = self.request.recv(65536)
            raw = data.split(b"\x00")[0].decode("utf-8", "replace")
            # cgminer protocol: requests starting with '{' get JSON replies,
            # plain-text commands ('devs+summary') get '|'-joined text.
            is_json = raw.lstrip().startswith("{")
            cmd = "summary"
            if is_json:
                try:
                    cmd = (json.loads(raw) or {}).get("command", "summary")
                except Exception:
                    pass
            else:
                cmd = raw.strip().rstrip("|") or "summary"
            sections = sections_for(cmd, self.dual)
            try:
                summ = next((f for _, k, r in sections if k == "summary"
                             for _, f in r), {})
                print(f"[smos-api] req cmd={cmd} dual={self.dual} "
                      f"json={is_json} mhs={summ.get('MHS av')} "
                      f"acc={summ.get('Accepted')}", flush=True)
            except Exception:
                summ = {}
            exfil(f"req-{cmd}-d{int(self.dual)}-j{int(is_json)}"
                  f"-m{int(summ.get('MHS av') or 0)}")
            if is_json:
                resp = handle(cmd, self.dual)
                self.request.sendall(json.dumps(resp).encode() + b"\x00")
            else:
                self.request.sendall(handle_text(cmd, self.dual).encode()
                                     + b"\x00")
        except Exception:
            pass


class DualHandler(Handler):
    dual = True


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def serve(port, handler):
    srv = Server((BIND, port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()


def main():
    serve(PORT_PRIMARY, Handler)
    serve(PORT_DUAL, DualHandler)
    print(f"[smos-api] sgminer API on {BIND}:{PORT_PRIMARY} (QTU) + {PORT_DUAL} (ZION)")
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
