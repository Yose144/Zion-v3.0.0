#!/usr/bin/env python3
"""
ZION OS First-Boot Wizard
---------------------------
Bezi na rigu po prvnim bootu z flash.
Zapne web server na portu 80 — admin se pripoji z jineho zarizeni
a provede prvotni konfiguraci (wallet, pool, GPU, OC).

Pouziti:
    sudo python3 wizard.py

Endpoints:
    GET  /          — Wizard UI (HTML)
    GET  /api/gpu   — Seznam detekovanych GPU
    POST /api/setup — Ulozeni konfigurace a start mineru
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

# Pouzijeme jen stdlib — zadne zavislosti
from http.server import HTTPServer, BaseHTTPRequestHandler

WIZARD_PORT = 80
CONFIG_DIR = Path("/data/zion/config")
WALLET_DIR = Path("/data/zion/wallet")

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZION OS — First Boot Wizard</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
            color: #e0e0e0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: rgba(20, 20, 40, 0.9);
            border: 1px solid rgba(100, 200, 255, 0.2);
            border-radius: 16px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        h1 {
            color: #64c8ff;
            font-size: 28px;
            margin-bottom: 8px;
            text-align: center;
        }
        .subtitle {
            text-align: center;
            color: #888;
            margin-bottom: 30px;
        }
        .step {
            margin-bottom: 24px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #aaa;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        input, select {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(100, 200, 255, 0.3);
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.3);
            color: #fff;
            font-size: 16px;
            outline: none;
        }
        input:focus, select:focus {
            border-color: #64c8ff;
            box-shadow: 0 0 0 3px rgba(100, 200, 255, 0.1);
        }
        .btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #64c8ff 0%, #3282b8 100%);
            border: none;
            border-radius: 8px;
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(100, 200, 255, 0.3);
        }
        .gpu-list {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            padding: 12px;
            margin-top: 8px;
            font-family: monospace;
            font-size: 13px;
        }
        .hidden { display: none; }
        .success {
            text-align: center;
            padding: 40px;
        }
        .success h2 { color: #4ade80; margin-bottom: 16px; }
        .status { color: #888; font-size: 14px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ZION OS</h1>
        <p class="subtitle">First Boot Wizard — Nastaveni rigu</p>

        <form id="wizardForm">
            <div class="step">
                <label>Peněženka (payout address)</label>
                <input type="text" id="wallet" placeholder="zion1..." required>
                <small style="color:#888">Zadni svou ZION adresu pro payouty</small>
            </div>

            <div class="step">
                <label>Pool</label>
                <select id="pool">
                    <option value="77.42.71.94:8444">ZION Edge (Primary)</option>
                    <option value="100.76.16.108:8444">ZION Edge (Tailscale)</option>
                    <option value="custom">Vlastni pool...</option>
                </select>
                <input type="text" id="customPool" class="hidden" placeholder="host:port" style="margin-top:8px">
            </div>

            <div class="step">
                <label>Worker name</label>
                <input type="text" id="worker" value="zion-rig" required>
            </div>

            <div class="step">
                <label>GPU Backend</label>
                <select id="backend">
                    <option value="auto">Auto-detect</option>
                    <option value="opencl">OpenCL (AMD/Intel)</option>
                    <option value="cuda">CUDA (NVIDIA)</option>
                    <option value="cpu">CPU only</option>
                </select>
            </div>

            <div class="step">
                <label>Detekovane GPU</label>
                <div id="gpuList" class="gpu-list">Nacitam...</div>
            </div>

            <div class="step">
                <label>OC Profile</label>
                <select id="ocProfile">
                    <option value="conservative">Konzervativni (bezpecne)</option>
                    <option value="balanced" selected>Vybalancovane</option>
                    <option value="aggressive">Agresivni (max vykon)</option>
                </select>
            </div>

            <div class="step">
                <label>
                    <input type="checkbox" id="fleetEnabled" checked>
                    Pripojit k Fleet Dashboard
                </label>
            </div>

            <button type="submit" class="btn">Spustit mining</button>
        </form>

        <div id="success" class="success hidden">
            <h2>Rig je nastaven!</h2>
            <p>Miner se spousti... Check <code id="statusUrl"></code></p>
            <p class="status">Muzes uzavrit tuto stranku.</p>
        </div>
    </div>

    <script>
        // Nacti GPU seznam
        fetch('/api/gpu').then(r => r.json()).then(data => {
            const list = document.getElementById('gpuList');
            if (data.gpus && data.gpus.length > 0) {
                list.innerHTML = data.gpus.map(g =>
                    `GPU ${g.index}: ${g.name} (${g.vendor})`
                ).join('<br>');
            } else {
                list.innerHTML = 'Zadne GPU detekovano (zkontroluj drivery)';
            }
        }).catch(() => {
            document.getElementById('gpuList').innerHTML = 'Chyba detekce GPU';
        });

        // Custom pool toggle
        document.getElementById('pool').addEventListener('change', e => {
            document.getElementById('customPool').classList.toggle('hidden', e.target.value !== 'custom');
        });

        // Form submit
        document.getElementById('wizardForm').addEventListener('submit', async e => {
            e.preventDefault();
            const pool = document.getElementById('pool').value === 'custom'
                ? document.getElementById('customPool').value
                : document.getElementById('pool').value;

            const body = {
                wallet: document.getElementById('wallet').value,
                pool: pool,
                worker: document.getElementById('worker').value,
                backend: document.getElementById('backend').value,
                oc_profile: document.getElementById('ocProfile').value,
                fleet_enabled: document.getElementById('fleetEnabled').checked
            };

            try {
                const res = await fetch('/api/setup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.ok) {
                    document.getElementById('wizardForm').classList.add('hidden');
                    document.getElementById('success').classList.remove('hidden');
                    document.getElementById('statusUrl').textContent = window.location.host + '/api/status';
                } else {
                    alert('Chyba: ' + data.error);
                }
            } catch (err) {
                alert('Chyba odeslani: ' + err);
            }
        });
    </script>
</body>
</html>
"""


def detect_gpus() -> list[dict]:
    """Detekuje GPU pomoci lspci a parse vendor."""
    gpus = []
    try:
        output = subprocess.check_output(
            ["lspci", "-nn"], text=True, timeout=10
        )
        index = 0
        for line in output.splitlines():
            if "VGA" in line or "3D" in line:
                vendor = "unknown"
                if "AMD" in line or "ATI" in line:
                    vendor = "AMD"
                elif "NVIDIA" in line:
                    vendor = "NVIDIA"
                elif "Intel" in line:
                    vendor = "Intel"

                # Extract name
                name = line.split(": ", 1)[1] if ": " in line else "Unknown"
                gpus.append({
                    "index": index,
                    "name": name,
                    "vendor": vendor,
                    "raw": line,
                })
                index += 1
    except Exception as e:
        print(f"GPU detekce selhala: {e}", file=sys.stderr)

    return gpus


def generate_mnemonic() -> str:
    """Vygeneruje 24-word BIP39-like mnemonic (simplified)."""
    wordlist = [
        "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
        "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
        "acoustic", "acquire", "across", "act", "action", "actor", "actual", "adapt",
        # Zjednoduseno — v produkci pouzit realny BIP39 wordlist
    ]
    import random
    return " ".join(random.choices(wordlist, k=24))


class WizardHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Tiche logy
        pass

    def do_GET(self):
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_TEMPLATE.encode("utf-8"))
        elif self.path == "/api/gpu":
            gpus = detect_gpus()
            self._json_response({"gpus": gpus})
        elif self.path == "/api/status":
            self._json_response({
                "status": "wizard_mode",
                "message": "Rig ceka na prvotni konfiguraci"
            })
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/api/setup":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len)
            try:
                data = json.loads(body)
                self._handle_setup(data)
            except json.JSONDecodeError:
                self._json_response({"ok": False, "error": "Invalid JSON"}, 400)
        else:
            self.send_error(404)

    def _handle_setup(self, data: dict):
        wallet = data.get("wallet", "").strip()
        pool = data.get("pool", "77.42.71.94:8444").strip()
        worker = data.get("worker", "zion-rig").strip()
        backend = data.get("backend", "auto").strip()
        oc_profile = data.get("oc_profile", "balanced").strip()
        fleet_enabled = data.get("fleet_enabled", True)

        # Validace
        if not wallet or not re.match(r"^zion1[a-z0-9]{38,39}$", wallet):
            self._json_response({"ok": False, "error": "Neplatna ZION adresa"}, 400)
            return

        if not pool or ":" not in pool:
            self._json_response({"ok": False, "error": "Neplatny pool format (host:port)"}, 400)
            return

        # Ulozeni konfigurace
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        WALLET_DIR.mkdir(parents=True, exist_ok=True)

        agent_config = f"""# Vygenerovano First-Boot Wizardem
rig_id = "{worker}-{os.urandom(4).hex()}"
api_bind = "0.0.0.0:8767"
autonomous_mode = true
auto_start_miner = true
auto_update = "stable"

[telemetry]
enabled = {str(fleet_enabled).lower()}
endpoint = "https://fleet.zionterranova.com/api/telemetry"
interval_sec = 30

[miner]
binary_path = "/usr/bin/zion-miner"
default_pool = "{pool}"
default_wallet = "{wallet}"
default_worker = "{worker}"
default_gpu_backend = "{backend}"
extra_args = []

[watchdog]
enabled = true
rules_file = "/data/zion/config/watchdog.yaml"
check_interval_sec = 60

[fleet]
enabled = {str(fleet_enabled).lower()}
dashboard_url = "https://fleet.zionterranova.com"
api_key = ""
poll_interval_sec = 10
"""

        with open(CONFIG_DIR / "agent.toml", "w") as f:
            f.write(agent_config)

        # Ulozeni wallet info
        with open(WALLET_DIR / "payout.txt", "w") as f:
            f.write(f"Payout address: {wallet}\n")
            f.write(f"Configured: {__import__('datetime').datetime.now().isoformat()}\n")

        # Prejmenovani first-boot flagu (aby se wizard uz nespustil)
        fb_flag = CONFIG_DIR / "autonomous.json"
        if fb_flag.exists():
            fb_flag.rename(CONFIG_DIR / "first-boot-completed.json")

        # Spust agenta (systemd se postara pri dalsim bootu, ted manualne)
        try:
            subprocess.run(
                ["systemctl", "daemon-reload"],
                capture_output=True, timeout=10
            )
            subprocess.run(
                ["systemctl", "restart", "zion-agent"],
                capture_output=True, timeout=10
            )
        except Exception as e:
            print(f"Restart agenta selhal: {e}", file=sys.stderr)

        self._json_response({
            "ok": True,
            "message": "Rig nastaven. Miner se spousti.",
            "rig_id": worker,
            "pool": pool,
            "wallet": wallet,
        })

    def _json_response(self, data: dict, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))


def main():
    print(f"=== ZION OS First-Boot Wizard ===")
    print(f"Nasloucham na portu {WIZARD_PORT}")
    print(f"Otevri v prohlizeci: http://<rig-ip>/")
    print(f"Ctrl+C pro ukonceni\n")

    try:
        server = HTTPServer(("0.0.0.0", WIZARD_PORT), WizardHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nWizard ukoncen.")
    except PermissionError:
        print(f"Chyba: Port {WIZARD_PORT} vyzaduje root prava.")
        print(f"Zkus: sudo python3 {sys.argv[0]}")
        sys.exit(1)


if __name__ == "__main__":
    main()
