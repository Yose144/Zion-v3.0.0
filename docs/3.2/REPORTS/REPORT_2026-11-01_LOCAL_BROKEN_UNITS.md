# REPORT — rozbité lokální služby na zionserver (2026-11-01)

> Jen diagnóza, nic nebylo měněno (kromě dřívějšího fixu backup node — viz §0).
> Zdroj: `systemctl --user`, `journalctl`, `ss`, `nvidia-smi`, RPC/P2P sondy.

## 0. Vyřešené dnes (pro kontext)

- **Local Backup Node** (`zion-backup-node.service`): nesyncoval od ~12:33 UTC —
  zombie TCP spojení na seed `8337` zablokovalo `sync_loop` (žádné outbound
  timeouty v `p2p.rs`). **Fix nasazen:** restart + timeout patch
  (`connect 10s / write 30s / read 60s`), commit `1dfa90312`. Node teď na tipu
  sítě (105198+), `known 3 / active 3`, beacon chodí na oba dashboardy (200).

---

## 1. EDGE SSH odmítá všechna spojení — 3 tunely mrtvé

| Unit | Stav | Restartů |
|---|---|---|
| `zion-ssh-tunnel.service` | activating auto-restart | 23+ |
| `vastctl-tunnel.service` | activating auto-restart | 637+ |
| `zion-hiran-tunnel.service` | activating auto-restart | 637+ |

**Symptom:** všechny končí `ssh: connect to host 62.171.141.136 port 2222:
Connection refused` (exit 255). Port 22 stejně refused.

**Časová osa:** ráno po bootu (07:48) tunely **běžely** (v 09:39 logují živé
channel-forward chyby). První `Connection refused` na :2222 = **12:36 UTC**
(13:36 CET), trvá dodnes — těsně po výpadku syncu backup node (~12:33 UTC).

**Diagnóza:** EDGE box **žije** — `80`, `443`, `8443`, P2P `8335–8337` OPEN a
odpovídají (seed GetStatus OK). Odmítá **jen SSH** (22 i 2222) → sshd na EDGE
mrtvý/nenabindovaný, nebo firewall/fail2ban REJECT pro naši IP (restart smyčka
~10 s banu nepomáhá — 637+ pokusů). Z lokální strany nerozlišitelné;
**vyžaduje akci na EDGE** (jiný přístup/konzole): zkontrolovat `sshd`,
`fail2ban-client status`, případně unban.

**Dopad:**
- Lokální dashboard monitoruje Edge služby přes `-L` forwardy
  (`127.0.0.1:9445/9446/9447` v31 nody, `:8443`, `:8080` pool, `:9100`,
  `:845x`, `:8003`) → **vše Edge-side svítí jako down**, i když na EDGE
  pravděpodobně běží.
- `zion-hiran-tunnel` (`-R 8002/8006`) → Edge ztratil reverse cestu na lokální
  hiran inference → `app.zionterranova.com/api/ai-chat` jede jen přes EDGE2
  CPU fallback.
- `vastctl-tunnel` (`-R 8088`) → vastctl ops z Edge nedostupný.

## 2. `zion-hiran-cuda.service` — crash-loop OOM od bootu

**Stav:** activating auto-restart, restart counter **2500+** (~každých 12 s od
07:48). `llama-server` exit 1 po ~2 s.

**Root cause (z `~/zion-hiran/logs/llm-8071-cuda.log`):**
`cudaMalloc failed: out of memory` — model chce **4246 MiB** na device 0,
ale GTX 1070 Ti (8192 MiB) má volné jen ~2 GB: drží ji
`zion-coder-cuda` (qwen2.5-coder-7b, `-ngl 999`, **4838 MiB**, pid 4829)
+ `zion-hiran-llm` (74 MiB). Dva LLM servery se o kartu perou po bootu —
dnes vyhrál coder, hiran-cuda odstartoval později a nevešel se.

**Dopad:** L3 inference na CUDA portu `:8071` down; běží jen `zion-hiran-llm`
(:8002, Vulkan/CPU model) + LM Studio cesta přes `hiran_proxy` :1235.
Plus zbytečný crash-loop (CPU/disk churn každých 12 s).

**Možnosti (k rozhodnutí 👤):** snížit `-ngl` (30→méně) nebo `-c 12288`→méně,
vzájemně se vyloučit (dependency ordering), nebo hiran-cuda vypnout, dokud
coder běží.

## 3. `mnt-data.mount` + `zion-backup.service` — žádné backupy od ~30. 10.

**Stav:** `mnt-data.mount` **failed** (systemd-fstab-generator), failing od
**30. 10.**; `zion-backup.service` failed (exit 209/STDOUT) — `zion-backup.timer`
střílí denně 03:30, další pokus **po 2. 11. 03:30 zase selže**.

**Root cause:** `mount: /mnt/data: wrong fs type, bad superblock on /dev/sdb2`
— NTFS partition (`UUID=0868B18B68B17850`, `ntfs3`) existuje, ale odmítá
připojení → typicky **dirty NTFS** (Windows Fast Startup / hibernation flag),
případně poškozený superblock → `chkdsk` ve Windows nebo `ntfsfix -d /dev/sdb2`.
Backup unit pak umře už na `StandardOutput=append:/mnt/data/...`
(mountpoint prázdný) — skript se ani nespustí.

**Dopad:** komplexní backup → `/mnt/data` **neběžel minimálně od 30. 10.**
(poslední úspěšný běh předtím).

## 4. Drobnosti

- `apport-autoreport.service` (system) — failed, Ubuntu crash-report noise,
  nesouvisí se ZION.
- `zion-stack.service` — `active (exited)`, oneshot, pravděpodobně OK.

## Shrnutí akčních bodů (nic neměněno)

1. **EDGE:** resuscitate sshd / unban IP — bez toho nepoběží 3 tunely a lokální
   dashboard ukazuje Edge mrtvé (je to největší vizuální příčina „dashboard
   hlásí že nejde").
2. **GPU split:** rozhodnout, co má mít přednost na 1070 Ti — coder vs hiran
   (jinak hiran-cuda nikdy nenastartuje).
3. **NTFS:** `chkdsk`/`ntfsfix` na sdb2, `mount /mnt/data`, pak
   `systemctl --user start zion-backup.service` a ověřit, že backup doběhl.
