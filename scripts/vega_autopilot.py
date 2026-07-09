import os
#!/usr/bin/env python3
"""
Vega Rig Autopilot — 60-minute autonomous debug & tune cycle.

Monitors rig 518837, diagnoses GPU/OpenCL, tunes OC, reports final state.
Run: python scripts/vega_autopilot.py
"""
import json, time, sys, urllib.request, urllib.error, base64, re
from datetime import datetime, timezone

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837
GROUP = 1765707
BASH_CMD_ID = 7

# ── helpers ──────────────────────────────────────────────────────────────────

def ts():
    return datetime.now().strftime("%H:%M:%S")

def api(method, path, body=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": ct})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        body_err = e.read().decode(errors="replace")
        print(f"  [API-ERR] {method} {path} → {e.code}: {body_err[:300]}")
        return None
    except Exception as e:
        print(f"  [NET-ERR] {method} {path} → {e}")
        return None

def get_rig():
    return api("GET", f"/rigs/{RIG}")

def get_console():
    return api("GET", f"/rigs/{RIG}/console")

def reload_rig():
    return api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})

def reboot_rig():
    return api("PATCH", "/rigs/execute-reboot", {"rigIds": [RIG]})

def set_oc(**kw):
    return api("PUT", f"/rigs/{RIG}", kw)

def update_miner_options(opts):
    return api("PUT", f"/rig-groups/{GROUP}", {"minerOptions": opts})

def run_bash(script):
    return api("PATCH", "/rigs/execute-command",
               {"rigIds": [RIG], "commandId": BASH_CMD_ID, "commandOptions": script})

def decode_console(data):
    """Decode console text (may be base64 or plain)."""
    if not data:
        return ""
    txt = data.get("console", "") or ""
    # SMOS sometimes base64-encodes
    try:
        decoded = base64.b64decode(txt).decode(errors="replace")
        if any(c in decoded for c in ["\n", "GPU", "miner", "error", "hash"]):
            return decoded
    except Exception:
        pass
    return txt

def extract_hashrate(console_text):
    """Try to pull hashrate from miner console output."""
    # Patterns: "hashrate=123.4", "H/s: 123", "accepted speed 123"
    patterns = [
        r"hashrate[=:\s]+([0-9.]+)",
        r"([0-9.]+)\s*[kKmMgG]?[hH]/s",
        r"speed[=:\s]+([0-9.]+)",
        r"hash_rate[=:\s]+([0-9.]+)",
    ]
    for p in patterns:
        m = re.findall(p, console_text, re.IGNORECASE)
        if m:
            return m[-1]  # last occurrence = most recent
    return None

# ── OC profiles for Vega (efficiency-tuned) ─────────────────────────────────
# Phase 1: ultra-safe start, Phase 2: balanced, Phase 3: optimized
OC_PROFILES = [
    {"name": "Phase1-UltraSafe",  "ocPowerLimit": "1",  "ocCore": "1050", "ocMemory": "800", "ocVddc": "900", "ocMvdd": "900", "ocMvddci": "800"},
    {"name": "Phase2-Balanced",   "ocPowerLimit": "1",  "ocCore": "1100", "ocMemory": "900", "ocVddc": "920", "ocMvdd": "920", "ocMvddci": "810"},
    {"name": "Phase3-Optimized",  "ocPowerLimit": "2",  "ocCore": "1150", "ocMemory": "945", "ocVddc": "940", "ocMvdd": "940", "ocMvddci": "820"},
    {"name": "Phase4-TuneUp",     "ocPowerLimit": "3",  "ocCore": "1200", "ocMemory": "945", "ocVddc": "950", "ocMvdd": "950", "ocMvddci": "830"},
]

# ── main autopilot loop ─────────────────────────────────────────────────────

def main():
    print(f"{'='*60}")
    print(f"  ZION Vega Autopilot — started {ts()}")
    print(f"  Rig {RIG} | Group {GROUP}")
    print(f"{'='*60}\n")

    # ── Step 0: Initial status ───────────────────────────────────────────
    rig = get_rig()
    if not rig:
        print("[FATAL] Cannot reach rig API"); sys.exit(1)

    print(f"[{ts()}] Rig online={rig.get('isOnline')}, osSeries={rig.get('osSeries')}, "
          f"gpuCount={rig.get('gpuCount')}, gpuCountMax={rig.get('gpuCountMax')}")
    print(f"  OC: PL={rig.get('ocPowerLimit')} Core={rig.get('ocCore')} Mem={rig.get('ocMemory')} "
          f"VDDC={rig.get('ocVddc')} MVDD={rig.get('ocMvdd')} MVDDci={rig.get('ocMvddci')}")

    # ── Step 1: Check console after recent reload ────────────────────────
    print(f"\n[{ts()}] Waiting 30s for reload to settle...")
    time.sleep(30)

    console_data = get_console()
    console_text = decode_console(console_data)
    print(f"[{ts()}] Console (last 500 chars):")
    print(console_text[-500:] if len(console_text) > 500 else console_text)

    gpu_mining = False
    has_opencl = False
    gpu_error = False

    if "gpu_init backend=" in console_text.lower() or "opencl" in console_text.lower():
        has_opencl = True
    if "gpu_init_fallback" in console_text.lower() or "no gpu" in console_text.lower():
        gpu_error = True
    if "hashrate" in console_text.lower() or "accepted" in console_text.lower():
        gpu_mining = True
    hr = extract_hashrate(console_text)

    print(f"\n[{ts()}] Analysis: opencl_detected={has_opencl}, gpu_error={gpu_error}, "
          f"mining={gpu_mining}, hashrate={hr}")

    # ── Step 2: GPU diagnostics via bash ─────────────────────────────────
    print(f"\n[{ts()}] Running GPU diagnostics via bash...")
    diag_script = (
        "echo '=== lspci GPU ==='; lspci | grep -i vga; "
        "echo '=== amdgpu driver ==='; lspci -k -s 03:00.0 2>/dev/null || lspci -k | grep -A3 VGA; "
        "echo '=== /dev/dri ==='; ls -la /dev/dri/ 2>/dev/null || echo 'NO /dev/dri'; "
        "echo '=== dmesg amdgpu ==='; dmesg | grep -i amdgpu | tail -10; "
        "echo '=== clinfo short ==='; clinfo --list 2>/dev/null || echo 'clinfo not found'; "
        "echo '=== OpenCL libs ==='; ldconfig -p 2>/dev/null | grep -i opencl || find /usr -name 'libOpenCL*' 2>/dev/null || echo 'no libOpenCL'; "
        "echo '=== miner process ==='; ps aux | grep -i miner | grep -v grep; "
        "echo '=== GPU temp/power ==='; cat /sys/class/drm/card*/device/hwmon/hwmon*/temp1_input 2>/dev/null; "
        "cat /sys/class/drm/card*/device/hwmon/hwmon*/power1_average 2>/dev/null; "
        "echo '=== DONE ==='"
    )
    bash_result = run_bash(diag_script)
    print(f"  Bash command sent: {bash_result}")

    # Wait for bash to execute and check console
    print(f"[{ts()}] Waiting 45s for bash diagnostics to appear in console...")
    time.sleep(45)

    console_data = get_console()
    console_text = decode_console(console_data)

    # Look for diagnostic output
    diag_start = console_text.find("=== lspci GPU ===")
    if diag_start >= 0:
        diag_text = console_text[diag_start:]
        print(f"\n[{ts()}] === DIAGNOSTICS OUTPUT ===")
        print(diag_text[:2000])
    else:
        print(f"\n[{ts()}] Diagnostics not yet in console. Full console tail:")
        print(console_text[-1000:] if len(console_text) > 1000 else console_text)

    # Re-analyze
    has_dri = "/dev/dri" in console_text and "NO /dev/dri" not in console_text
    has_amdgpu_driver = "amdgpu" in console_text.lower() and "kernel driver" in console_text.lower()
    has_opencl_lib = "libOpenCL" in console_text or "opencl" in console_text.lower()

    print(f"\n[{ts()}] Diag: /dev/dri={has_dri}, amdgpu_driver={has_amdgpu_driver}, opencl_lib={has_opencl_lib}")

    # ── Step 3: Fix OpenCL if needed ─────────────────────────────────────
    if not has_opencl_lib or gpu_error:
        print(f"\n[{ts()}] OpenCL may be missing or GPU init failed. Attempting fixes...")

        # Try setting LD_LIBRARY_PATH and forcing OpenCL init
        fix_script = (
            "echo '=== Attempting OpenCL fix ==='; "
            "find / -name 'libOpenCL*' -o -name 'amdocl*' 2>/dev/null | head -20; "
            "echo '---'; "
            "find / -name 'libamdocl*' 2>/dev/null | head -10; "
            "echo '=== ROCm check ==='; "
            "ls /opt/rocm*/lib/ 2>/dev/null || ls /opt/amdgpu*/lib/ 2>/dev/null || echo 'no ROCm/amdgpu-pro'; "
            "echo '=== Mesa OpenCL ==='; "
            "dpkg -l 2>/dev/null | grep -i opencl || rpm -qa 2>/dev/null | grep -i opencl || echo 'no pkg mgr'; "
            "echo '=== FIX DONE ==='"
        )
        run_bash(fix_script)
        print(f"[{ts()}] OpenCL library search sent. Waiting 40s...")
        time.sleep(40)

        console_data = get_console()
        console_text = decode_console(console_data)
        fix_start = console_text.find("=== Attempting OpenCL fix ===")
        if fix_start >= 0:
            print(console_text[fix_start:fix_start+1500])
        else:
            print(f"  Fix output not yet visible. Console tail:")
            print(console_text[-800:])

    # ── Step 4: OC tuning loop ───────────────────────────────────────────
    print(f"\n[{ts()}] === OC TUNING PHASE ===")

    best_profile = None
    best_hashrate = 0.0
    current_oc_idx = 0

    for idx, profile in enumerate(OC_PROFILES):
        name = profile.pop("name")
        print(f"\n[{ts()}] Applying OC profile: {name}")
        print(f"  Settings: {profile}")

        set_oc(**profile)
        reload_rig()

        # Wait for OC to apply and miner to stabilize
        wait_secs = 90 if idx == 0 else 60
        print(f"  Waiting {wait_secs}s for stabilization...")
        time.sleep(wait_secs)

        # Check if rig is still alive
        rig = get_rig()
        if not rig or not rig.get("isOnline"):
            print(f"  [WARN] Rig offline after {name}! Reverting to previous profile...")
            if idx > 0:
                prev = OC_PROFILES[idx - 1].copy()
                prev.pop("name", None)
                set_oc(**prev)
                reboot_rig()
                print(f"  Rebooting with previous OC. Waiting 120s...")
                time.sleep(120)
            break

        # Check hashrate
        console_data = get_console()
        console_text = decode_console(console_data)
        hr = extract_hashrate(console_text)
        hr_val = float(hr) if hr else 0.0

        gpu_ok = "gpu_init backend=" in console_text.lower() or "opencl" in console_text.lower()
        is_mining = "hashrate" in console_text.lower() or "accepted" in console_text.lower() or "solution" in console_text.lower()

        rig = get_rig()
        print(f"  Result: online={rig.get('isOnline')}, gpu_mining={gpu_ok}, "
              f"mining_activity={is_mining}, hashrate={hr}")
        print(f"  GPU temp/power from SMOS: temp={rig.get('gpuTemp','?')}, power={rig.get('gpuPower','?')}")

        if hr_val > best_hashrate:
            best_hashrate = hr_val
            best_profile = name
            current_oc_idx = idx

        # If GPU still not mining, no point tuning further
        if not is_mining and not gpu_ok:
            print(f"  GPU not mining. Staying on this profile for more diagnosis.")
            break

    # ── Step 5: Final verification ───────────────────────────────────────
    print(f"\n[{ts()}] === FINAL VERIFICATION ===")
    time.sleep(30)

    rig = get_rig()
    console_data = get_console()
    console_text = decode_console(console_data)
    hr = extract_hashrate(console_text)

    print(f"\n{'='*60}")
    print(f"  AUTOPILOT FINAL REPORT — {ts()}")
    print(f"{'='*60}")
    print(f"  Rig:        {RIG}")
    print(f"  Online:     {rig.get('isOnline')}")
    print(f"  osSeries:   {rig.get('osSeries')}")
    print(f"  GPU count:  {rig.get('gpuCount')}/{rig.get('gpuCountMax')}")
    print(f"  OC applied: PL={rig.get('ocPowerLimit')} Core={rig.get('ocCore')} "
          f"Mem={rig.get('ocMemory')} VDDC={rig.get('ocVddc')} "
          f"MVDD={rig.get('ocMvdd')} MVDDci={rig.get('ocMvddci')}")
    print(f"  Best profile: {best_profile} @ hashrate={best_hashrate}")
    print(f"  Current hashrate: {hr}")
    print(f"  Mining active: {'hashrate' in console_text.lower() or 'accepted' in console_text.lower()}")

    # Check for GPU mining specifically
    if "gpu_init backend=" in console_text.lower():
        print(f"  GPU backend: ACTIVE")
    elif "gpu_init_fallback" in console_text.lower():
        print(f"  GPU backend: FALLBACK TO CPU")
    else:
        print(f"  GPU backend: UNKNOWN (check console)")

    print(f"\n  Console tail (last 300 chars):")
    print(f"  {console_text[-300:]}")
    print(f"\n{'='*60}")
    print(f"  Autopilot completed at {ts()}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
