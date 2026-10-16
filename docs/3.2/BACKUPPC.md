# BACKUPPC.md — AI node setup (Vega 8G + RX 5600 XT 6G / 32G RAM)

> Kompletní návod pro přeměnu backup-node PC na primární Hiran inference node.
> Backend: **llama.cpp Vulkan** (gfx900 Vega + gfx1010 Navi — ROCm 6+ obojí
> dropnul/ignoruje; RADV podporuje obě). Cíl: 2 llama-servery + reverse tunel
> na Edge :8002. Mining koexistence = pravidlo „max 1 těžký GPU proc na kartu".

## 0. Předpoklady

```bash
# ověř karty + amdgpu driver
lspci | grep -E 'VGA|3D'          # Vega … + Navi 10 [RX 5600 XT]
lsmod | grep amdgpu
# Vulkan driver (RADV) — Ubuntu/Debian:
sudo apt install mesa-vulkan-drivers vulkan-tools
vulkaninfo --summary | grep -B2 deviceName   # musí vypsat OBĚ karty
```

Pokud `vulkaninfo` vidí jen jednu kartu → `sudo usermod -aG render,video $USER`, relogin.

## 1. llama.cpp Vulkan build

```bash
sudo apt install build-essential cmake git libvulkan-dev glslc || \
  sudo apt install glslang-tools   # glslc fallback pro starší distra
git clone https://github.com/ggml-org/llama.cpp ~/llama.cpp && cd ~/llama.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build -j"$(nproc)" --target llama-server llama-cli llama-quantize
./build/bin/llama-server --list-devices   # ggml_vulkan: index → karta
```

Pozor na **pořadí zařízení** — `--list-devices` vypíše `Vulkan0`, `Vulkan1`;
která je Vega ověř přes `vulkaninfo` (vendorID 0x1002, deviceID Vega=0x687f,
5600XT=0x731f). Leveluj env `GGML_VULKAN_DEVICE=<index>`.

## 2. Modely → `/opt/hiran/models/`

```bash
sudo mkdir -p /opt/hiran/models && sudo chown $USER /opt/hiran/models
cd /opt/hiran/models
# A) router/fast na 5600XT — Qwen3-4B Q5_K_M (~2.9G):
wget -O qwen3-4b-q5_k_m.gguf \
  "https://huggingface.co/bartowski/Qwen_Qwen3-4B-GGUF/resolve/main/Qwen_Qwen3-4B-Q5_K_M.gguf"
# B) core na Vegu — zatím base Qwen3-8B Q5_K_M (~5.7G); po v2.3-mini pull
#    nahradit souborem z artifacts (viz §5):
wget -O hiran-core-q5_k_m.gguf \
  "https://huggingface.co/bartowski/Qwen_Qwen3-8B-GGUF/resolve/main/Qwen_Qwen3-8B-Q5_K_M.gguf"
```

VRAM budget: Vega 8G − 5.7G model − ~0.5G ctx @ 32k → OK. 5600XT 6G − 2.9G →
OK i při ~8k ctx. **Když na kartě běží miner, server nestartuj** (viz §6).

## 3. Dva servery — systemd

`/etc/systemd/system/hiran-core.service` (Vega):

```ini
[Unit]
Description=Hiran core llama-server (Vega, :8080)
After=network.target
[Service]
Environment=GGML_VULKAN_DEVICE=0        # <- index Vegy z --list-devices!
ExecStart=%h/llama.cpp/build/bin/llama-server \
  -m /opt/hiran/models/hiran-core-q5_k_m.gguf \
  --alias hiran-core --port 8080 --host 127.0.0.1 \
  -ngl 99 -c 32768 --flash-attn -b 2048
Restart=on-failure
RestartSec=5
MemoryMax=10G
[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/hiran-fast.service` (5600XT):

```ini
[Unit]
Description=Hiran fast llama-server (5600XT, :8081)
After=network.target
[Service]
Environment=GGML_VULKAN_DEVICE=1        # <- index 5600XT
ExecStart=%h/llama.cpp/build/bin/llama-server \
  -m /opt/hiran/models/qwen3-4b-q5_k_m.gguf \
  --alias hiran-fast --port 8081 --host 127.0.0.1 \
  -ngl 99 -c 8192 --flash-attn -b 1024
Restart=on-failure
RestartSec=5
MemoryMax=8G
[Install]
WantedBy=multi-user.target
```

`%h` = home usera pod kterým unit běží (pokud system unit → absolutní cestu).
Pokud `%h` nefunguje v system unitu: `User=tvujuser` + absolutní `/home/tvujuser/llama.cpp/...`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hiran-core hiran-fast
journalctl -u hiran-core -f    # čekej na "server is listening" + VRAM alloc
```

## 4. Reverse tunel → Edge :8002

Edge už má `hirantunnel` usera (nologin) a :8002 je jeho port. Z backup PC:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/hirantunnel -N ''
# pub key přidej na Edge do /home/hirantunnel/.ssh/authorized_keys:
ssh root@62.171.141.136 'mkdir -p /home/hirantunnel/.ssh && echo "<PUBKEY>" >> /home/hirantunnel/.ssh/authorized_keys'
```

`/etc/systemd/system/hiran-tunnel.service`:

```ini
[Unit]
Description=Hiran reverse tunnel → edge :8002
After=network-online.target
Wants=network-online.target
[Service]
ExecStart=/usr/bin/ssh -N -T \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes \
  -i %h/.ssh/hirantunnel \
  -R 127.0.0.1:8002:127.0.0.1:8080 hirantunnel@62.171.141.136
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
```

→ `hiran-core` (:8080) se na Edge objeví jako `127.0.0.1:8002/v1` s aliasem
`hiran-core` (+ llama-server umí i `--alias zion-l3` pro front-end compat).
Fast model tunelovat jen pokud Edge potřebuje — jinak zůstává lokální pro
dataset-gen a intent classify.

## 5. v2.3-mini artifact → nasazení

Až doběhne vast.ai run (pipeline `Hiran/2.3/rebuild/v23mini/`):

```bash
# na stroji kde je repo (artifacts po `vast_v23mini.sh pull`):
scp Hiran/2.3/rebuild/v23mini/artifacts/hiran-v2.3mini-Q5_K_M.gguf \
    backuppc:/opt/hiran/models/hiran-core-q5_k_m.gguf   # přepíše base
# nebo přímo z instance:
scp -P <ssh_port> -i ~/.ssh/id_ed25519 \
    root@ssh6.vast.ai:/workspace/v23mini/out/hiran-v2.3mini-Q5_K_M.gguf \
    /opt/hiran/models/hiran-core-q5_k_m.gguf
sudo systemctl restart hiran-core
```

## 6. Mining koexistence

- `nvidia-smi` neexistuje — VRAM check: `radeontop -d -` nebo
  `cat /sys/class/drm/card*/device/mem_info_vram_used`.
- **Pravidlo:** eq192 (≈2.8G) / QPoW miner nesmí na kartu kde běží llama-server.
  Vega: buď miner NEBO hiran-core. 5600XT: hiran-fast má prioritu.
- OOM při startu → sniž `-c` (32768→8192) nebo `-ngl` (99→30).

## 7. Verifikace

```bash
curl 127.0.0.1:8080/v1/models        # hiran-core
curl 127.0.0.1:8081/v1/models        # hiran-fast
curl 127.0.0.1:8080/v1/chat/completions -H 'content-type: application/json' -d '{
  "model":"hiran-core","messages":[{"role":"user","content":"Co je Zion?"}],"max_tokens":64}'
ssh root@62.171.141.136 'curl -s 127.0.0.1:8002/v1/models'   # E2E přes tunel
```

Edge env pak: `LLM_BASE_URL=http://127.0.0.1:8002/v1`, model `hiran-core`
(alias `zion-l3` zachovat pro front-end compat). Detail: `HiranInterface.md`.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `--list-devices` vidí 1 kartu | user není v `render`/`video` group; RADV chybí |
| SIGILL při startu | CPU bez AVX (u Ryzena nehrozí — pozor na SMOS G4560) |
| load trvá minuty, tok/s nízké | model jede z RAM ne VRAM → check `GGML_VULKAN_DEVICE` + `-ngl 99` |
| tunel ESTAB ale :8002 dead | `ExitOnForwardFailure` + `Restart=always` řeší; check authorized_keys |
| swap roste | `MemoryMax` limity v unitách drží; 32G RAM stačí oběma |
