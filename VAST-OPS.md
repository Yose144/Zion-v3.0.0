# Vast rigs — ops plán (jak se na fleet dostat a co dál)

> Stav 2026-11-01 12:45 CET: rig **58077390 RTX 3060 žije a těží** (GPU 100 %,
> 169 W; xmrig 3 852 H/s + quantus 105,9 MH/s). Veřejný dashboard
> https://zionterranova.com/vast-rigs/ zase ukazuje fleet — opraveno
> `VASTAI_BIN` v `vastctl-daemon.service` (daemon bezel bez ~/.local/bin v PATH
> → `vastai show instances` padal → `rigs: 0`).

## 1. Tři cesty na rig

| Cesta | Co umí | Jak |
|---|---|---|
| **Web dashboard** | read-only fleet status, GPU metriky, pool stats, inference worker ovládání (deploy/stop/tunnel), GPU market | https://zionterranova.com/vast-rigs/ — data z `status.json`, který daemon pushuje každých 60 s do `zion-new:/var/www/zion-maintenance/vast-rigs/` |
| **vastctl CLI** | plná správa: status, offers (GPU trh), rent, launch minerů, exec, logs, daemon, serve | `infra/tools/vast/vastctl.py <příkaz>` — běží na zionserver, používá `vastai` CLI + SSH |
| **SSH přímo** | shell na instanci | `ssh -p 27582 root@ssh6.vast.ai` (rig 58077390) nebo `vastctl exec 58077390 <cmd>` |

Lokální dashboard (market + launch): `vastctl serve` → http://127.0.0.1:8088
(user servis `vastctl-serve`; přes `vastctl-tunnel` dostupný i z EDGE na `/vast-ops/`).

## 2. Architektura fleet telemetry

```
vastai CLI ──┐
SSH probe ───┤ vastctl daemon (user systemd, zionserver)
xmrig API ───┘   ├─ status.json  → scp push → EDGE2 webroot → /vast-rigs/
                 └─ :8088 API    → reverse tunnel → EDGE → /vast-ops/api/*
```

Služby (user systemd na zionserver):
- `vastctl-daemon.service` — probe loop 60 s + push (fix `VASTAI_BIN` 2026-11-01)
- `vastctl-serve.service` — lokální dashboard :8088
- `vastctl-tunnel.service` + `vastctl-tunnel-edge2.service` — reverse tunely
- `vast-inference-tunnel.service` — inference port-forward (Vast :8000 → local :18000)
- na rigech: `zion-vast-agent.service` (heartbeat + task poller)

**Když dashboard ukazuje 0 rigů:** `journalctl --user -u vastctl-daemon` →
`status.json → errors.rigs`. Typicky PATH/`VASTAI_BIN` nebo expirované vast.ai API.

## 3. Stav rigu 58077390

- RTX 3060 12 GB, $0.0544/h (~$39/měs), ssh6.vast.ai:27582
- Mining: SRBMiner quantus 105,9 MH/s + xmrig rx/0 3 852 H/s — **zion-miner
  stále vypnutý** (restart: `vastctl launch zion --duty 28` — 👤)
- Hiran archiv: `/root/hiran-train/` (finální adaptéry run 1+2, .hf cache 5,4 GB)
- ✅ **disk 2,2 GB volných** (2026-11-01 vyčištěny všechny checkpointy — archiv
  na EDGE kompletní vč. run2-ep2; zbývají jen top-level final safetensors)
- Pipeline fix (`finetune_lora.py` messages+guard) je na rigu syncnutá
- ✅ Smoke run 2026-11-01: 60 párů nového FULL datasetu, eval_loss **3.17** —
  pipeline ověřena (žádná memorace); padl až save = tenkrát plný disk

## 4. Cesta k FULL trainingu (vazba na `HIRAN-FULL-TRAINING-PREP.md`)

Dataset v1 je hotový (`Hiran/2.3/dist/` — 7 106 train / 379 eval, replay 21 %).
Další kroky:

1. **Smoke run na stávajícím rigu** (~30 párů, ověření pipeline + nového
   datasetu) — RTX 3060 unese 8B QLoRA, seq 512, bs1/accum32
2. **Pronájem větší karty** přes `vastctl offers --gpu <GPU> --max-dph <$>`:
   - RTX 4090 24 GB (~$0.3/h) — QLoRA ≤13B, ověření v2 datasetu
   - A100 80 GB (~$1–2.5/h) — **QLoRA 70B** (doporučený tier pro FULL)
   - `vastctl rent <offer_id>` → auto-provision → `vastctl exec`
3. **Sync datasetu** na nový rig (dist jsonl ~16 MB) + base model z HF
   (nebo přes EDGE archiv `/opt/zion/hiran/base/`)
4. **Run + checkpointy každých 50 kroků** → rsync na EDGE (disk hlídat!)
5. **Validace**: held-out eval + base-vs-adapter smoke (protokol v
   `docs/3.2/REPORTS/hiran-smoke-prompts.json`) → teprve pak alias

## 5. 👤 Fronta rozhodnutí

- [ ] `zion-miner` restart na 58077390 (`vastctl launch zion --duty 28`)
- [x] Čištění disku rigu — ✅ 2,2 GB (2026-11-01)
- [ ] Volba base modelu pro FULL (Llama-3.3-70B gated × Qwen2.5-72B otevřený)
- [ ] Budget schválení pro A100 run (~odhad podle §2 PREP docu)
- [ ] Alias `hiran-maitreya`/`hiran-issobella` zůstávají mockupy do validace

Související: `HIRAN-FULL-TRAINING-PREP.md` (dataset+sizing), `docs/plans/VASTAI-MINING.md`
(mining detail), `docs/3.2/REPORTS/VAST-RIGS-DELIVERY-REPORT-2026-10-21.md` (UI/API),
`AIhiran.md` (stav adaptérů), `VAST-HIRAN-TRAINING-PLAN.md` (run 1 detail).
