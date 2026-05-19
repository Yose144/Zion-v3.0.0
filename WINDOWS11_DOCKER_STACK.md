# ZION V3 Stack na Windows 11 — Docker Desktop + WSL2

> **Datum:** 2026-05-19
> **Cíl:** Rozběhnout celý ZION V3 stack přímo pod Windows 11 bez dual-bootu.
> **Hardware:** AMD GPU (RX 5700 XT), Docker Desktop s WSL2 backendem.

---

## Přehled

Na Windows 11 nejjednodušeji rozběhneš ZION stack přes **Docker Desktop** s **WSL2 backendem**. Docker Desktop automaticky instaluje WSL2 Ubuntu distro, kde je všechno připravené jako na čistém Linuxu — včetně GPU OpenCL supportu.

| Komponenta | Jak běží na Win11 |
|---|---|
| **Node** | Docker / WSL2 nativní |
| **Pool** | Docker / WSL2 nativní |
| **Miner** | **WSL2 nativní** (OpenCL GPU) nebo Docker CPU-only |
| **OASIS** | Docker / WSL2 nativní |
| **Monitoring** | Docker / WSL2 nativní |

> **Proč ne čistý Docker Desktop?** AMD GPU OpenCL v Docker kontejneru na Windows není přímočaré. Miner se nejlépe spustí **nativně ve WSL2 Ubuntu** (má přímý přístup k AMD ROCm/OpenCL). Node, pool a monitoring mohou běžet v Dockeru.

---

## Požadavky

| Položka | Minimum | Doporučeno |
|---|---|---|
| Windows 11 | Pro/Enterprise (Home funguje taky) | Pro (Hyper-V) |
| RAM | 16 GB | 32 GB (8 GB pro WSL2 + 4 GB stack + zbytek Win) |
| Disk | 100 GB volných | 250 GB+ |
| GPU | AMD RX 5700 XT (nebo libovolná) | RX 5700 XT+ (OpenCL) |

---

## Krok 1 — Povolit WSL2 a Virtual Machine Platform

Otevři **PowerShell jako Administrátor** (Start → PowerShell → Run as Admin):

```powershell
# Povol WSL2 a virtuální platformu
wsl --install
# Restart PC po dokončení
```

Pokud už máš WSL, ujisti se že je verze 2:

```powershell
wsl --set-default-version 2
wsl --update
```

---

## Krok 2 — Docker Desktop

1. Stáhni z https://www.docker.com/products/docker-desktop/
2. Instaluj → zaškrtni **"Use WSL 2 instead of Hyper-V"**
3. Po instalaci: Docker Desktop → Settings → Resources → WSL Integration
4. **Enable integration with my default WSL distro** → ON
5. **Apply & Restart**

Ověř v PowerShell:

```powershell
docker --version
docker compose version
```

---

## Krok 3 — WSL2 Ubuntu Terminal

Docker Desktop automaticky instaluje **Ubuntu** WSL distro. Otevři ho:

```powershell
wsl -d Ubuntu
```

Nebo: Start → Ubuntu

V Ubuntu terminálu:

```bash
# Aktualizuj systém
sudo apt-get update && sudo apt-get upgrade -y

# Nainstaluj základní nástroje
sudo apt-get install -y git curl build-essential pkg-config libssl-dev

# Nainstaluj ROCm / OpenCL (AMD GPU)
sudo mkdir -p --mode=0755 /etc/apt/keyrings
wget -q -O - https://repo.radeon.com/rocm/rocm.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/rocm.gpg

# Pro Ubuntu 24.04 / 26.04 (zkus noble pokud resolute nefunguje)
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/rocm.gpg] https://repo.radeon.com/rocm/apt/latest noble main" | \
  sudo tee /etc/apt/sources.list.d/rocm.list

sudo apt-get update
sudo apt-get install -y rocm-opencl-runtime rocminfo clinfo mesa-opencl-icd

# Ověř GPU
rocminfo | head -5
clinfo | head -10
```

---

## Krok 4 — Clone repo + Build

Ve **WSL2 Ubuntu terminálu**:

```bash
cd ~
git clone https://github.com/Yose144/2.9.6.git zion
cd zion

# Build s OpenCL GPU support
cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
cargo build --release --manifest-path V3/Cargo.toml -p zion-core --bin node
cargo build --release --manifest-path V3/Cargo.toml -p zion-pool --bin server
cargo build --release --manifest-path V3/Cargo.toml -p zion-cli
```

> První build trvá 10–20 minut. Opakovaný je okamžitý.

---

## Krok 5 — Spusť stack (2 možnosti)

### Možnost A: Vše Docker (CPU mining, nejjednodušší)

V PowerShell nebo WSL terminálu:

```powershell
# PowerShell (nebo bash ve WSL)
cd C:\Users\TvojeUzivJmeno\zion\V3\docker    # Windows cesta
# nebo ve WSL:
cd ~/zion/V3/docker

# Kopíruj env
cp .env.example .env

# Spusť stack (node + pool + miner CPU + oasis)
docker compose -f docker-compose.yml --profile mainnet up -d --build

# + Monitoring (Prometheus + Grafana)
docker compose -f docker-compose.yml --profile mainnet --profile monitoring up -d

# Logy
docker compose logs -f node
docker compose logs -f miner
```

> ⚠️ Miner v Dockeru běží **CPU-only** (Docker Desktop nemá AMD GPU passthrough pro OpenCL).
> Pro GPU mining použij **Možnost B**.

### Možnost B: Mix Docker + WSL2 Nativní (GPU mining, doporučeno)

**Node + Pool + OASIS** = Docker kontejnery (řídí je Docker Desktop).
**Miner** = Nativní WSL2 s OpenCL GPU.

```bash
# Ve WSL2 Ubuntu terminálu:
cd ~/zion

# 1. Docker stack (bez miner služby)
cd V3/docker
docker compose -f docker-compose.yml --profile mainnet up -d --scale miner=0

# 2. Nativní miner s OpenCL GPU
cd ~/zion
source .env.zion-native
export ZION_POOL_ADDR=127.0.0.1:8444
export ZION_GPU_BACKEND=opencl
export ZION_GPU_WORK_SIZE=4096

./V3/target/release/zion-miner
```

> Miner běží ve WSL2 s plným přístupem k AMD RX 5700 XT přes ROCm.
> Node a pool běží v Dockeru spravovaném Docker Desktopem.

---

## Krok 6 — Přístup z Windows 11

| Služba | URL z Windows | Poznámka |
|---|---|---|
| Node RPC | `http://localhost:8443` | Port forward z WSL2/Docker |
| Pool Stratum | `localhost:8444` | Pro miner |
| Grafana | `http://localhost:3000` | admin/admin |
| Prometheus | `http://localhost:9090` | Query metrik |

> Docker Desktop automaticky forwarduje porty z kontejnerů/WSL2 na `localhost` Windows hosta.

---

## Krok 7 — Zion CLI z Windows

Z Windows PowerShell (nebo CMD) můžeš volat CLI ve WSL2:

```powershell
# Zavolej zion CLI ve WSL2 z PowerShell
wsl -d Ubuntu -e ~/zion/V3/target/release/zion status

# Nebo otevři WSL terminál a tam:
wsl -d Ubuntu
cd ~/zion
./V3/target/release/zion status
./V3/target/release/zion node rpc getChainInfo
```

---

## Krok 8 — Autostart po přihlášení (volitelné)

Chceš, aby stack startoval automaticky po přihlášení do Windows:

### 8a. Docker stack autostart
Docker Desktop → Settings → General → **"Start Docker Desktop when you sign in to your computer"**

### 8b. WSL2 + Miner autostart
Vytvoř `.bat` soubor na ploše:

```bat
@echo off
:: Start WSL2 Ubuntu and launch miner
call wsl -d Ubuntu -e bash -c "cd ~/zion && nohup ./V3/target/release/zion-miner > /tmp/zion-miner.log 2>&1 &"
echo ZION miner started in WSL2
pause
```

A přidej do `shell:startup` (Win+R → `shell:startup`) zástupce toho `.bat`.

---

## Krok 9 — Miner jako Windows služba (volitelné)

Pokud chceš miner běžící i po zavření terminálu:

```bash
# Ve WSL2:
cd ~/zion
nohup ./V3/target/release/zion-miner > /tmp/zion-miner.log 2>&1 &
echo $! > /tmp/zion-miner.pid

# Zastavení:
kill $(cat /tmp/zion-miner.pid)
```

---

## Rychlá referenční tabulka

| Příkaz | Kde spustit |
|---|---|
| `docker compose up -d` | PowerShell nebo WSL2 bash |
| `./V3/target/release/zion-miner` | **WSL2 bash** (GPU OpenCL) |
| `./V3/target/release/zion status` | WSL2 bash |
| `curl http://localhost:8443/health` | PowerShell / Prohlížeč |
| `wsl --shutdown` | PowerShell (vypne WSL2) |

---

## Troubleshooting

### Docker Desktop nevidí GPU
- Normalní. Docker Desktop na Windows nemá AMD GPU passthrough. Použij **Možnost B** (nativní WSL2 miner).

### WSL2 Ubuntu se neotevírá
```powershell
wsl --list --verbose          # zobraz distra
wsl --install -d Ubuntu       # nainstaluj Ubuntu
```

### Port 8443 je zabraný Windows službou
```powershell
netstat -ano | findstr 8443   # kdo drží port
# Změň port v .env: RPC_PORT=18443
```

### Miner nevidí OpenCL ve WSL2
```bash
# Ve WSL2:
rocminfo   # mělo by ukázat GPU
clinfo     # mělo by detekovat 2 platformy

# Pokud ne:
sudo usermod -aG video,render $USER
# Odhlásit se a znovu přihlásit do WSL2
```

---

## Srovnání s dual-boot Ubuntu

| Aspekt | Windows 11 + Docker/WSL2 | Dual-boot Ubuntu |
|---|---|---|
| **Setup čas** | 30 min (Docker Desktop + WSL2) | 2–3 hod (instalace) |
| **Mining GPU** | ✅ Ve WSL2 nativní (OpenCL) | ✅ Přímý přístup |
| **Přepínání OS** | ❌ Není potřeba — W11 pořád běží | ✅ Musíš rebootovat |
| **Výkon** | ~98 % (WSL2 je lehký hypervizor) | 100 % native |
| **Docker** | ✅ Docker Desktop (user-friendly) | ✅ Docker Engine |
| **Gaming** | ✅ Funguje normálně | ❌ Musíš bootovat W11 |
| **Složitost** | Nízká | Střední |

**Verdikt:** Pokud chceš Windows 11 pro práci a ZION jako **background službu**, Docker Desktop + WSL2 je nejrychlejší cesta. Pro **dedikovaný 24/7 node** je dual-boot nebo samostatný PC lepší.

---

## Další kroky

1. Nainstaluj Docker Desktop + WSL2
2. Otevři WSL2 Ubuntu terminál
3. Clone repo a build (`cargo build --release`)
4. Spusť: `docker compose --profile mainnet up -d` + nativní miner
5. Otevři Grafana: http://localhost:3000

---

*Generováno Devinem 2026-05-19. Viz také `DUALBOOT_GUIDE.md` pro alternativní přístup.*
