# ZION TerraNova — Kompletní Průvodce (FORSITA)

> **Pro koho:** Pro každého — vývojáře, přítele, nováčka, **i úplného laika**, který nikdy nespustil server.
> **Co se naučíš:** Co je ZION, jak repo funguje, jak si **koupit a nastavit server**, jak **spustit mainnet uzel**, **přijmout/poslat platbu**, **těžit**, použít **zion CLI**, a co dělat když něco nefunguje.
> **Poslední update:** 2026-05-22 (dashboard + Launch Day automation + GPU mining lokálně + mainnet ready pro 31.12.2026)
> **Aktuální status repa:** [`StatusV3.md`](./StatusV3.md) + [`StatusV3-Part2.md`](./StatusV3-Part2.md)

---

## 📑 Obsah

1. [Co je ZION (pro laika)](#1-co-je-zion-pro-laika)
2. [Slovníček (pojmy bez kterých si neporadíš)](#2-slovníček)
3. [Mapa repositáře — co je kde](#3-mapa-repositáře)
4. [Premine peněženky](#4-premine-peněženky)
5. **[Robustní mainnet deployment od nuly](#5-robustní-mainnet-deployment-od-nuly)** ← hlavní část
6. **[Dashboard & Launch Day Automation](#6-dashboard--launch-day-automation)** ← novinka
7. [zion CLI — operátorský nástroj](#7-zion-cli)
8. [Bridge ZION ↔ wZION (Base)](#8-bridge--zion--wzion)
9. [Desktop, Mobile, Web aplikace](#9-aplikace)
10. [Monitoring (Prometheus + Grafana)](#10-monitoring)
11. [Backup & disaster recovery](#11-backup--disaster-recovery)
12. [Security checklist](#12-security-checklist)
13. [Troubleshooting (FAQ)](#13-troubleshooting)
14. [Jak přispět](#14-jak-přispět)

---

## 1. Co je ZION (pro laika)

**ZION TerraNova** je vlastní **kryptoměna a blockchain** — postavený od nuly v jazyku **Rust**, ne fork Bitcoinu/Etherea. Má vlastní těžební algoritmus (Cosmic Harmony Ekam Deeksha v2) a 3-vrstvou architekturu (L1 chain → L2 DeFi → L3 AI a cross-chain).

**Klíčová čísla:**

| | |
|---|---|
| Total supply | **144 000 000 000 ZION** (nikdy víc) |
| Premine (genesis) | 16,78 mld ZION (11,65 %), v 12 účelových peněženkách |
| Block reward | 5 400 ZION → klesá o **20 % každých 10 let**, tail ~724 ZION/blok navždy |
| Block time | **60 s** |
| Fee policy | **100 % burn** (deflationary) |
| Reward split | 89 % miner / 5 % humanitarian / 5 % Issobella / 1 % pool |
| Decimals | 10¹² flowers / 1 ZION |
| Hashing | BLAKE3 + Cosmic Harmony 6-stage pipeline (256 KiB scratchpad) |

**Filosofie:** Fair Launch (žádný presale, žádné ICO), 100letý horizont (ne hype-cycle), open source MIT.

---

## 2. Slovníček

Pokud něco nevíš, vrať se sem.

| Pojem | Co to znamená v kontextu ZION |
|---|---|
| **Node** | Program běžící na serveru, který drží kompletní kopii blockchainu, ověřuje transakce, propaguje bloky. Syn. "uzel". |
| **Mainnet** | Hlavní (živá, produkční) síť. Tady jsou skutečné peníze. Opak: **testnet** (zkušebka, fake peníze). |
| **Genesis #0** | Úplně první blok řetězce. Po `git filter-repo` cleanup (2026-05-07) startujeme **nový mainnet od bloku 0**. |
| **Pool** | Server, který sdružuje malé minery a rozděluje odměnu. ZION pool používá **PPLNS**. |
| **Miner** | Program (CPU nebo GPU), který hledá platné bloky. Posílá svou práci pool serveru. |
| **Wallet** | Peněženka — pár klíčů (privátní + adresa). Privátní klíč = peníze. **Nikdy ho nikomu nedávej.** |
| **RPC** | "Remote Procedure Call" — způsob, jak se s nodem mluví (např. `getBalance`). U ZION je to **raw TCP** na portu 8443, ne HTTP! |
| **P2P** | Peer-to-peer vrstva, kde si nody mezi sebou vyměňují bloky. Port **8333**. |
| **Stratum** | Protokol mezi minerem a poolem. Port **8444**. |
| **Bridge** | Most mezi ZION L1 a Ethereum (Base). Pošleš ZION → dostaneš wZION (ERC-20). |
| **VPS** | Virtual Private Server — pronajatý server v cloudu (Hetzner, Contabo, OVH, DigitalOcean…). |
| **SSH klíč** | Kryptografický klíč k přihlášení na server bez hesla. Bezpečnější než heslo. |
| **systemd / Docker** | Dva způsoby, jak na Linuxu trvale spouštět služby. ZION mainnet nasazujeme přes **Docker Compose**. |
| **CLI** | Command-line interface. ZION má `zion` binárku — operátorský "uber-tool". |

---

## 3. Mapa repositáře

```
2.9.6/                          ← ROOT (multi-layer monorepo)
│
├── README.md                   ← Přehled projektu
├── ROADMAP.md                  ← Master roadmapa
├── FORSITA.md                  ← TOTO — kompletní průvodce
├── AGENTS.md                   ← Pravidla pro AI agenty / collaboratory
├── StatusV3.md                 ← ⭐ Aktuální stav (mainnet polish)
├── StatusV3-Part2.md           ← Independent audit + cleanup
├── DASHBOARD_AUTOSTART.md      ← Dashboard — instalace autostartu
├── PREMINE_ADDRESSES_PUBLIC.txt← 15 genesis peněženek (veřejné adresy)
│
├── V3/                         ← 🚀 AKTIVNÍ MAINNET KÓD
│   ├── L1/                     ←   Jádro blockchainu
│   │   ├── core/               ←     Node (konsensus, P2P, RPC, storage)
│   │   ├── cosmic-harmony/     ←     PoW algoritmus
│   │   ├── pool/               ←     Mining pool (Stratum, PPLNS)
│   │   ├── miner/              ←     Miner (CPU + GPU)
│   │   └── native-libs/        ←     C/Metal/CUDA knihovny
│   ├── L2/                     ←   DeFi vrstva
│   │   ├── bridge/             ←     wZION bridge (ZION ↔ Base)
│   │   ├── dao/                ←     DAO governance
│   │   └── atomic-swap/        ←     HTLC atomic swapy
│   ├── L3/                     ←   AI & Cross-chain
│   │   ├── ncl/                ←     Neural Compute Layer
│   │   ├── warp/               ←     Universal bridge (7 chainů)
│   │   └── ai-native/          ←     AI Agent framework (Hiranyagarbha)
│   ├── cli/                    ←   ⭐ "zion" operátorská CLI binárka
│   ├── docker/                 ←   ⭐ MAINNET docker compose (sem!)
│   │   ├── docker-compose.yml                ← unified s profiles
│   │   ├── docker-compose.v3-mainnet.yml     ← legacy mainnet stack
│   │   ├── docker-compose.monitoring.yml     ← Prometheus/Grafana
│   │   ├── prometheus.yml + alert_rules.yml
│   │   └── DOCKER.md / HARDENING.md          ← návody
│   ├── docs/                   ←   V3 dokumentace
│   │   ├── CLI_GUIDE.md        ←     ⭐ jak používat zion CLI
│   │   ├── CLI_DEPLOY_PLAYBOOK.md
│   │   ├── CLI_REFERENCE.md
│   │   └── audits/             ←     Audit reporty
│   ├── ROADMAP.md              ←   Detailní V3 roadmapa
│   └── README.md               ←   V3 status a popis
│
├── HiranV2.1/                  ← AI agent (Hiranyagarbha v2.1) — RAG + LoRA pipeline
│   ├── Hiran_v2.1.md           ←   Specifikace agenta + RAG router
│   ├── PLAN_v2.1.md            ←   Prováděcí plán (fáze 0-D)
│   └── bootstrap_workspace.sh  ←   Setup skript
│
├── L1/ … L6/                   ← Legacy vrstvy (referenční historický kód)
│                                  ⚠️ Nový kód se píše do V3/, ne sem!
│
├── APP&WEB/                    ← Frontendové aplikace
│   ├── desktop-agent/          ←   Electron desktop app
│   ├── mobile-app/             ←   React Native + Expo
│   └── website-v2.9/           ←   Next.js 16 web
│
├── docker/                     ← (legacy root-level docker, postupně migrace do V3/docker/)
├── config/                     ← Konfigurační soubory (mainnet.toml, testnet.toml, …)
├── scripts/                    ← Deployment + ops skripty
├── docs/                       ← Veškerá dokumentace (audity, whitepaper, …)
├── tests/                      ← Integrační testy
└── .pre-commit-config.yaml     ← Git hooks (fmt + clippy + gitleaks)
```

**Klíčové pravidlo:** Nový mainnet kód se píše **do `V3/`**. Vše ostatní je referenční nebo aplikační vrstva.

---

## 4. Premine peněženky

V genesis bloku je předem vytvořeno **16,78 mld ZION** (11,65 %) ve **12 peněženkách**. Plus 3 operační peněženky (Issobella, Pool fee, Pool payout) plněné odměnami za těžbu.

Veřejné adresy: **`PREMINE_ADDRESSES_PUBLIC.txt`** v rootu repa.

| # | Účel | Kolik |
|---|---|---|
| 1–5 | OASIS Golden Egg / Xp | 5× 1,65 mld = **8,25 mld** |
| 6 | DAO Treasury (hlavní) | **2,5 mld** |
| 7 | DAO Grants & Bounties | **1,0 mld** |
| 8 | DAO Ecosystem Bootstrap | **0,5 mld** |
| 9 | Core Development Fund | **1,0 mld** |
| 10 | Network Infrastructure | **1,0 mld** |
| 11 | Genesis Creator | **0,59 mld** |
| 12 | Humanitarian (Children) | **1,44 mld** |
| 13 | Issobella Fund | plněno 5 % bloku |
| 14 | Pool Fee | plněno 1 % bloku |
| 15 | Pool Payout Wallet | tranzitní |

**Privátní klíče** premine peněženek **NEJSOU v repu** (`.gitignore`), existují jen offline u Genesis creatora. Po `git filter-repo` history scrub (2026-05-07) jsou odstraněny i z historie.

---

## 5. Robustní mainnet deployment od nuly

> Tahle sekce tě provede od **úplného začátku** (nemáš ještě nic) až k **běžícímu mainnet uzlu** v cloudu. Po cestě probereme i **3-server topologii** doporučenou pro Genesis #0.

### 5.1 Co budeš potřebovat

| Položka | Cena (orientačně) | Poznámka |
|---|---|---|
| **VPS** | $20–80/měs za kus | Doporučujeme 3 servery v různých zemích |
| **Doménové jméno** | $10–15/rok | Volitelné (pro web a SSH alias) |
| **Lokální PC** | — | macOS / Linux / WSL2 na Windows |
| **SSH klient** | zdarma | Built-in `ssh` na všech OS |
| **Trpělivost** | — | Počítej 1–3 hodiny od nuly k prvnímu bloku |

**Doporučená VPS specifikace pro 1 mainnet node:**

| Resource | Min | Doporučeno | Pro pool/bridge |
|---|---|---|---|
| CPU | 2 vCPU | **4 vCPU** | 8 vCPU |
| RAM | 4 GB | **8 GB** | 16 GB |
| Disk | 50 GB SSD | **200 GB NVMe** | 500 GB NVMe |
| Bandwidth | 1 TB/měs | 5 TB/měs | unmetered |
| OS | Ubuntu 22.04 LTS | **Ubuntu 24.04 LTS** | Debian 12 |

### 5.2 Volba poskytovatele

> **Důrazně doporučujeme rozprostřít 3 nody do 3 různých datacenter / providerů.** Snižuje single-point-of-failure (geo, právní, infra).

| Provider | Plus | Mínus |
|---|---|---|
| **Hetzner** (DE/FI/US) | Levné, výkonné, EU GDPR | Vyžaduje ID verifikaci |
| **OVH** (FR/CA/SG) | Široký výběr lokací | Občas pomalé support |
| **Contabo** (DE/US/JP) | Nejlevnější za RAM | Pomalejší disk |
| **DigitalOcean** | Skvělé docs, API | Dražší než EU providers |
| **Vultr** | Velký výběr lokací | Cena srovnatelná s DO |
| **Linode (Akamai)** | Stabilní, US-friendly | Méně lokací |

**Příklad doporučené 3-server topologie pro mainnet:**

```
Server A (EU)         Server B (US)         Server C (APAC)
Hetzner FSN1          Hetzner ASH1          Vultr Tokyo
4 vCPU / 8 GB / 200GB 4 vCPU / 8 GB / 200GB 4 vCPU / 8 GB / 200GB
role: full node       role: full node       role: full node
        + pool                + bridge              + monitoring
```

### 5.3 Krok za krokem: od koupě VPS k běžícímu nodu

#### Krok 1 — Koupit VPS

1. Registruj se u zvoleného providera (např. Hetzner Cloud).
2. **Vygeneruj SI lokálně SSH klíč** (NE u providera!):
   ```bash
   # Na svém laptopu
   ssh-keygen -t ed25519 -a 100 -f ~/.ssh/zion_node_a -C "zion-node-a-$(date +%Y%m%d)"
   # Stiskni Enter na passphrase pokud chceš jednodušší přístup z CI
   # NEBO zadej passphrase pro lepší bezpečnost (musíš pak používat ssh-agent)
   
   cat ~/.ssh/zion_node_a.pub
   # Tenhle text (jeden řádek) zkopíruj
   ```
3. V cloud panelu providera klikni **Create server**:
   - OS: **Ubuntu 24.04 LTS**
   - Lokace: dle topologie (EU/US/APAC)
   - Type: 4 vCPU / 8 GB RAM / 200 GB SSD
   - **SSH key:** vlož ten public key z `cat ~/.ssh/zion_node_a.pub`
   - Firewall: zatím nic (uděláme níže přes ufw)
4. Po spuštění získáš **veřejnou IP** (např. `203.0.113.42`).
5. Otestuj SSH:
   ```bash
   ssh -i ~/.ssh/zion_node_a root@203.0.113.42
   # Když poprvé: "Are you sure you want to continue?" → yes
   # Měl bys být přihlášený jako root@hostname:~#
   ```

#### Krok 2 — Základní hardening (bezpečnost)

Připojený přes SSH spusť:

```bash
# 1. Update systému
apt update && apt upgrade -y

# 2. Vytvoř ne-root usera (bezpečnější než přímý root)
adduser zion-deploy            # zadej silné heslo, ostatní fields skip
usermod -aG sudo zion-deploy
mkdir -p /home/zion-deploy/.ssh
cp ~/.ssh/authorized_keys /home/zion-deploy/.ssh/
chown -R zion-deploy:zion-deploy /home/zion-deploy/.ssh
chmod 700 /home/zion-deploy/.ssh
chmod 600 /home/zion-deploy/.ssh/authorized_keys

# 3. Zakaž root login + heslo přihlášení
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
echo 'AllowUsers zion-deploy' >> /etc/ssh/sshd_config
systemctl reload sshd

# 4. Firewall
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     comment "SSH"
ufw allow 8333/tcp   comment "ZION P2P"
ufw allow 8443/tcp   comment "ZION RPC (zvážit jen z trusted IPs)"
ufw allow 8444/tcp   comment "ZION pool stratum (jen pokud je to pool node)"
ufw allow 9090/tcp   comment "Prometheus (jen pokud je monitoring node)"
ufw --force enable
ufw status

# 5. fail2ban (chrání proti brute-force)
apt install -y fail2ban
systemctl enable --now fail2ban

# 6. Automatic security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

Otestuj nové přihlášení **z jiného terminálu** (ne zavírej původní SSH session, dokud neověříš!):

```bash
ssh -i ~/.ssh/zion_node_a zion-deploy@203.0.113.42
# Mělo by fungovat
```

Pokud OK, můžeš zavřít root session a dál pracovat jako `zion-deploy`.

#### Krok 3 — Instalace Dockeru

```bash
# Jako zion-deploy s sudo:
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Přidej se do docker grupy (aby nebylo nutné sudo u každého docker příkazu)
sudo usermod -aG docker $USER
# Odhlas se a zpátky (nebo `newgrp docker`)
exit
```

Re-login a otestuj:
```bash
ssh -i ~/.ssh/zion_node_a zion-deploy@203.0.113.42
docker --version
docker compose version
docker run --rm hello-world    # quick smoke test
```

#### Krok 4 — Klonovat repo a nasadit ZION

```bash
# Volitelně: nainstaluj git pokud chybí
sudo apt install -y git

# Klonuj repo
cd ~
git clone https://github.com/Yose144/2.9.6.git zion
cd zion

# Vytvoř .env (kam chodí odměny za bloky)
cat > .env << 'EOF'
# Tvoje wallet adresa (vygeneruj ji lokálně, viz Krok 5)
MINER_WALLET=zion1...TVOJE_ADRESA

# Operační peněženky (zachovat jak jsou — protokolové defaults)
HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20
ISSOBELLA_WALLET=zion170a374s6h390k7w244m5c4f354v8n4678844655
POOL_FEE_WALLET=zion1y5u653y3w4z7p5r3l034y0q6u06542a426z77j7
POOL_PAYOUT_WALLET=zion1k3h7p6q4z7l0s495w6h775f566u0276237rh8x5

# Pokud běžíš pool, vygeneruj signing key:
#   docker run --rm zion-core wallet new-keypair
# A vlož sem hex private key (bez 0x):
POOL_SIGNING_KEY=
EOF
chmod 600 .env

# Spusť unified compose s mainnet profilem
docker compose -f V3/docker/docker-compose.yml --env-file .env --profile mainnet up -d

# Sleduj logy
docker compose -f V3/docker/docker-compose.yml logs -f node
# Ctrl+C ukončí jen tail, ne kontejner

# Po pár sekundách ověř:
docker ps
# Měl bys vidět: zion-core, zion-pool, zion-miner …

# Otestuj RPC (POZOR: raw TCP, ne HTTP — ne curl, použij nc!):
echo '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' | \
  nc -w 3 127.0.0.1 8443
# Měl bys dostat JSON odpověď s tip_height, hashrate, mempool, ...
```

#### Krok 5 — Vytvoř si peněženku (lokálně, ne na serveru!)

> **Privátní klíč peněženky NIKDY nedrž jen na serveru.** Vždy ho generuj lokálně a důkladně zazálohuj.

Lokálně na svém laptopu:

```bash
# Klonuj repo
git clone https://github.com/Yose144/2.9.6.git
cd 2.9.6

# Spusť V3 wallet generator
cargo run --release --manifest-path V3/Cargo.toml -p zion-cli -- wallet new
# Nebo přes desktop agenta:
cd APP&WEB/desktop-agent && npm install && npm start
```

Generator ti dá:
- **Adresu** (`zion1...`) — to je veřejné, posílej kamkoli
- **Privátní klíč** (hex string) — **TAJNÉ**, uložit do password manageru
- **Mnemonic** (12–24 anglických slov) — **TAJNÉ**, vytisknout a zamknout

Adresu pak vlož do `.env` na serveru jako `MINER_WALLET`.

#### Krok 6 — Připojit se k peer mesh (P2P)

Pokud je server první v síti, je to genesis seed. Pokud jsou už jiné nody, edituj `config/mainnet.toml`:

```toml
[p2p]
seed_peers = [
  "203.0.113.42:8333",     # tvoje server A
  "198.51.100.55:8333",    # tvoje server B
  "192.0.2.99:8333",       # tvoje server C
]
```

Po každé změně configu:
```bash
docker compose -f V3/docker/docker-compose.yml --env-file .env restart node
```

#### Krok 7 — Replikuj na 2 zbývající servery

Opakuj Kroky 1–6 pro server B a C. Klíčové rozdíly:

- **Server A:** node + pool + miner (těžba zde)
- **Server B:** node + bridge (L2 → Base mostek)
- **Server C:** node + monitoring (Prometheus + Grafana)

Nakonec všechny 3 se musí navzájem znát v `seed_peers`.

### 5.4 Sanity check po nasazení

Z laptopu na všech 3 servery najednou:

```bash
for IP in 203.0.113.42 198.51.100.55 192.0.2.99 ; do
  echo "=== $IP ==="
  ssh -i ~/.ssh/zion_node_a zion-deploy@$IP "
    echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getChainInfo\",\"params\":{}}' | \
      nc -w 3 127.0.0.1 8443 | python3 -c 'import sys,json; r=json.load(sys.stdin); print(\"height:\", r[\"result\"][\"tip_height\"])'
  "
done
```

Všechny 3 by měly hlásit **stejnou výšku ±1**. Pokud se rozcházejí o víc, není to OK — zkontroluj `seed_peers` a firewall na portu 8333.

---

## 6. Dashboard & Launch Day Automation

ZION má vestavěný **operátorský dashboard** — webové rozhraní běžící lokálně, které sleduje všechny komponenty v reálném čase.

### 6.1 Spuštění dashboardu

```bash
# Windows (jednoduché)
start-dashboard.bat

# Nebo ručně z root repa:
cd dashboard && python app.py
```

Dashboard je dostupný na: **`http://127.0.0.1:8766`**

### 6.2 Co dashboard zobrazuje

| Tab | Obsah |
|-----|-------|
| **Overview** | Node status, pool status, miner hashrate, edge relay, mainnet readiness |
| **Nodes** | Detailní logy Node1 + Node2, výška chainu, P2P peers |
| **Pool** | Aktivní sessiony, shares, blocks found, fee split, recent payouts |
| **Miner** | GPU backend, hashrate, accepted/rejected shares, current job |
| **Settings** | Konfigurace fee split adres, mining parametrů |
| **Launch Day** | ⭐ **Automatizace pro 31.12.2026** |

### 6.3 Launch Day Tab (31.12.2026 12:00 UTC)

Launch Day tab připravuje a automatizuje **mainnet genesis rotaci**:

- **Status karet:** Počet dní do launchi, backup status, genesis hash
- **Akce:**
  - `Check Status` — ověří aktuální stav sítě
  - `Create Backup` — lokální záloha `backups/launch-day-TIMESTAMP/` (genesis, chain data, konfigurace)
  - `Rotate Genesis` — připraví nový genesis blok pro mainnet
  - `Execute Full Launch Sequence` — kompletní automatizovaná sekvence
- **Launch Day log:** Timestampovaný záznam všech operací
- **Auto-start:** Dashboard se po instalace spustí automaticky po přihlášení do Windows (`install-dashboard-autostart.bat`)

### 6.4 Auto-start instalace (Windows)

```powershell
# Vyžaduje admin práva (spusť jako Administrator):
.\install-dashboard-autostart.bat
```

Tím se vytvoří Scheduled Task, který spustí dashboard při každém přihlášení uživatele. Detailní návod v [`DASHBOARD_AUTOSTART.md`](./DASHBOARD_AUTOSTART.md).

---

## 7. zion CLI

`zion` je unifikovaný operátorský binární příkaz pro celý stack. Detail v [`V3/docs/CLI_GUIDE.md`](./V3/docs/CLI_GUIDE.md).

### 7.1 Build

```bash
# Z root repa:
cargo build --release --manifest-path V3/Cargo.toml -p zion-cli
sudo cp V3/target/release/zion /usr/local/bin/

# Ověř:
zion --help
```

### 7.2 Nejčastější příkazy

```bash
# Interaktivní menu (arrow keys)
zion
# nebo:
zion menu

# První-runtime setup wizard
zion onboard

# Zdravotní kontrola všech vrstev
zion status
zion doctor                      # pre-flight diagnostics

# Spustit/zastavit služby
zion start all                   # vše: node + pool + miner + agent + bridge + dao + website + monitoring
zion start node                  # jen node
zion stop pool
zion restart bridge

# Logy
zion logs node --tail 100
zion logs bridge -f              # follow mode

# L1 specifické
zion node sync-status
zion node peers
zion mine start --threads 4
zion wallet balance zion1...

# L2
zion bridge status
zion dao proposals

# Deploy (per V3/docs/CLI_DEPLOY_PLAYBOOK.md)
zion deploy --target mainnet --server 203.0.113.42

# Konfigurace
zion config show
zion config set p2p.seed_peers "['203.0.113.42:8333','198.51.100.55:8333']"

# Block explorer TUI
zion explorer

# Live monitoring TUI
zion monitor
```

### 7.3 Kompletní reference

- [`V3/docs/CLI_GUIDE.md`](./V3/docs/CLI_GUIDE.md) — koncept a top-level
- [`V3/docs/CLI_REFERENCE.md`](./V3/docs/CLI_REFERENCE.md) — všechny příkazy
- [`V3/docs/CLI_DEPLOY_PLAYBOOK.md`](./V3/docs/CLI_DEPLOY_PLAYBOOK.md) — deploy workflows
- [`V3/docs/CLI_FAQ.md`](./V3/docs/CLI_FAQ.md) — časté dotazy
- [`V3/docs/CLI_TROUBLESHOOTING.md`](./V3/docs/CLI_TROUBLESHOOTING.md) — řešení problémů

---

## 8. Bridge — ZION ↔ wZION

Bridge umožňuje převést ZION z hlavního chainu na **Base** (Coinbase L2 nad Ethereem) jako **wZION** (ERC-20).

### 8.1 Smart kontrakty na Base Mainnet

| Kontrakt | Adresa |
|---|---|
| **wZION** (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| **ZIONBridge** | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` |
| **UniV3 Pool** (wZION/WETH 0.3%) | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` |

### 8.2 Bridge vault adresa (kam posíláš ZION)

```
zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0
```

### 8.3 Jak funguje bridge

```
ZION L1                              Base L2
─────────                            ──────
1. Pošleš X ZION na vault
   s memo: BRIDGE:base:0xTVOJE_EVM
                  │
                  ▼
2. L1 watcher detekuje lock
3. Čeká 60 bloků (finalita)
                  │
                  ▼
4. Relayer agreguje 3/5 validator podpisů
                  │
                  ▼
5. Submit submitLockProof() ────► 6. ZIONBridge.unlock() mintne
                                     X wZION na 0xTVOJE_EVM
                                  7. Vidíš v MetaMask ✅
```

### 8.4 Bridge stav (2026-05-08)

> ⚠️ **Bridge je v staging** (`threshold=1, total_validators=2`). Před produkčním unlock-flow je potřeba provisioning **3/5 multisig** (5 validator klíčů, každý na samostatném serveru). Detail v [`StatusV3.md` § P1](./StatusV3.md).

### 8.5 DeFi Hub & web

| Stránka | URL | Popis |
|---|---|---|
| DeFi Hub | `/defi` | Swap wZION/WETH, bridge burn, portfolio |
| Bridge | `/bridge` | Detailní operace + FAQ |
| DAO | `/dao` | Governance, treasury, návrhy |
| Warp | `/warp` | Multi-chain koridory (ETH live, BTC+SOL plánované) |

---

## 9. Aplikace

### 9.1 Desktop Agent (Electron)

```bash
cd APP\&WEB/desktop-agent
npm install
npm start                    # GUI pro mining + wallet
```

### 9.2 Mobile App (React Native + Expo)

```bash
cd APP\&WEB/mobile-app
npm install
npx expo start               # naskenuj QR v Expo Go appce
```

9 obrazovek: Dashboard, Wallet, Send, Receive, Mining, Bridge, Network, Settings, TransactionHistory.

### 9.3 Website (Next.js)

```bash
cd APP\&WEB/website-v2.9
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # produkce
```

---

## 10. Monitoring

Doporučujeme aktivovat monitoring profile na alespoň jednom ze 3 serverů (typicky server C).

```bash
docker compose -f V3/docker/docker-compose.yml --env-file .env \
  --profile mainnet --profile monitoring up -d
```

Spuštěné služby:

| Služba | Port | URL |
|---|---|---|
| Prometheus | 9090 | `http://203.0.113.42:9090` |
| Grafana | 3000 | `http://203.0.113.42:3000` (default admin/admin → změň!) |
| Alertmanager | 9093 | `http://203.0.113.42:9093` |
| node_exporter | 9100 | system metrics |

**Doporučené alerty** (`V3/docker/alert_rules.yml` má defaults):

- `zion_chain_tip_lag > 5 blocks` — node se rozjíždí
- `zion_p2p_peer_count < 3` — málo peerů
- `bridge_relayer_missing_signers > 0` — bridge nemá quorum
- `node_disk_free < 10 %` — server brzy bez místa
- `mempool_depth > 1000` — backlog v mempoolu

Grafana dashboards jsou v `monitoring/grafana/` v repu.

---

## 11. Backup & disaster recovery

### 11.1 Co zálohovat

| Co | Frekvence | Kam |
|---|---|---|
| Privátní klíče peněženek | jednorázově | offline (papír v sejfu, password manager) |
| Server SSH klíče | jednorázově | password manager + offline backup |
| `.env` soubory ze serverů | po každé změně | šifrovaný backup (např. age, gpg) |
| ZION chain data (LMDB) | každých 6 h | snapshot na druhý server / S3 |
| Bridge SQLite DB | každých 1 h | dtto |
| Validator key (`/etc/zion/bridge-validator.key`) | jednorázově | offline; `chmod 600 999:999` |

### 11.2 Backup skript (cron na serveru)

```bash
# /home/zion-deploy/zion-backup.sh
#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M)
DEST="/home/zion-deploy/backups"
mkdir -p "$DEST"

# 1. Snapshot chain data (read-only kopie)
docker exec zion-core sqlite3 /data/state.db ".backup '/data/backup-$TS.db'" 2>/dev/null || true
docker cp zion-core:/data/backup-$TS.db "$DEST/" 2>/dev/null || true

# 2. Bridge DB
docker exec zion-v3-bridge sqlite3 /data/bridge.db ".backup '/tmp/bridge-$TS.db'"
docker cp zion-v3-bridge:/tmp/bridge-$TS.db "$DEST/"

# 3. Komprese + upload na S3 (nebo rclone na druhý server)
tar czf "$DEST/zion-backup-$TS.tar.gz" "$DEST/backup-$TS.db" "$DEST/bridge-$TS.db"
# rclone copy "$DEST/zion-backup-$TS.tar.gz" remote:zion-backups/

# 4. Smaž starší než 7 dní
find "$DEST" -name "*.tar.gz" -mtime +7 -delete
```

Cron (`crontab -e`):
```
0 */6 * * * /home/zion-deploy/zion-backup.sh >> /var/log/zion-backup.log 2>&1
```

### 11.3 Disaster recovery scenáře

| Scénář | Akce |
|---|---|
| Server crashed (HW failure) | Postav nový server, pull repo, restore datadir z S3, restart compose |
| Datadir corruption | `docker compose down`, restore poslední backup, `docker compose up -d` |
| Single node desync | `zion node force-resync --from-peer 203.0.113.42:8333` |
| Síťový split (2 nody se neshodují s 3.) | Vždy se přiklonit ke chainu s vyšší celkovou prací (longest valid chain) |
| Validator key compromise | Okamžitě rotovat validator address v multisig + slash starý klíč |
| Wallet mnemonic ztracen | **Není recovery.** Proto offline backup. |

---

## 12. Security checklist

Před spuštěním produkce projít vše:

```
[ ] SSH klíče vygenerovány lokálně, ne v cloudu
[ ] Root login zakázán (PermitRootLogin no)
[ ] PasswordAuthentication no
[ ] AllowUsers obsahuje jen deploy account
[ ] ufw enabled, jen porty 22 + ZION
[ ] fail2ban běží
[ ] Automatic security updates aktivní
[ ] .env soubory chmod 600
[ ] Validator key chmod 600 999:999
[ ] Wallet privátní klíče OFFLINE (papír + password manager)
[ ] Mnemonic NIKDY nefoceno na telefon (EXIF)
[ ] Žádné credentials v gitu (git secret scan)
[ ] .pre-commit-config.yaml aktivní (gitleaks + private-key detect)
[ ] Backup skript v cronu, otestovaná restore procedura
[ ] Monitoring zapnutý, alerty směřují na funkční email/telegram
[ ] Bridge threshold = 3/5 (ne staging 1/2!)
[ ] HTTPS na webu (Let's Encrypt)
[ ] DNS DNSSEC zapnutý (volitelné, ale doporučené)
```

---

## 13. Troubleshooting

### Cargo build selhává

```bash
# Ujisti se že jsi ve V3 workspace
cd V3 && cargo build --release
# OpenCL/Metal warnings: optional GPU backend, OK ignorovat
```

### Node se nesyncuje (height neroste)

```bash
zion node peers              # vidíš peers?
zion logs node --tail 50     # nějaké errory?
# Pokud "no peers": zkontroluj seed_peers v configu + ufw 8333
sudo ufw status | grep 8333
```

### RPC vrací prázdnou odpověď

```bash
# NE: curl http://localhost:8443/...
# ANO: raw TCP
echo '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' | \
  nc -w 3 127.0.0.1 8443
```

### Docker "no space left"

```bash
df -h                         # kolik místa
docker system df              # co Docker zabírá
docker system prune -a        # smaže nepoužívané images (opatrně!)
docker volume prune           # smaže unused volumes (POZOR: ztráta dat!)
```

### Pool nepřijímá shares od mineru

```bash
zion logs pool --tail 100 | grep -E "share|reject"
# "stale share": miner běží na starém jobu → restart miner
# "low diff": miner posílá pod var diff → ověř hashrate
# "auth fail": špatná adresa → ověř MINER_WALLET formát zion1...
```

### Bridge nezpracovává unlock

```bash
docker logs zion-v3-bridge --tail 100 2>&1 | grep -E "ERROR|unlock|missing"
# "missing signers": chybí validator quorum (P1 blokátor)
# "ANKR_API_KEY": chybí env var
# Ověř konfiguraci:
grep -E "threshold|total_validators" V3/L2/bridge/config/bridge-mainnet.toml
```

### High memory / OOM kill

```bash
free -h
docker stats --no-stream
# Pokud OOM: zvyš RAM serveru nebo přidej swap:
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Hiran (AI agent) backend nedostupný

Hiran v2.3 je **volitelný** AI agent s hybridním RAG + full fine-tuning na 32B modelu. Pokud běží jen technické vrstvy (L1+L2), agent nemusí být deployed. Detail v [`HiranV2.3/PLAN_v2.3.md`](./HiranV2.3/PLAN_v2.3.md).

```bash
zion agent status
# "degraded mode": OK, technické funkce nepostižené
# Pro plný setup: viz HiranV2.3/ — DeepSpeed ZeRO-3 full FT pipeline
```

---

## 14. Jak přispět

1. Forkni repo na GitHubu (až bude public)
2. Vytvoř branch: `git checkout -b moje-zmena`
3. **Píš kód do `V3/`** (ne do legacy `L1/`–`L6/`)
4. Spusť testy: `cargo test --manifest-path V3/Cargo.toml --workspace -- --test-threads=1`
5. Spusť pre-commit: `pre-commit run --all-files`
6. Commitni a pushni
7. Otevři Pull Request

Pravidla v [`AGENTS.md`](./AGENTS.md), audit kontext v [`StatusV3.md`](./StatusV3.md).

---

## 📚 Klíčové dokumenty

| Soubor | Co v něm najdeš |
|---|---|
| [`StatusV3.md`](./StatusV3.md) | ⭐ Aktuální stav mainnet polish |
| [`StatusV3-Part2.md`](./StatusV3-Part2.md) | Independent audit + 2026-05-07 cleanup log |
| [`README.md`](./README.md) | Přehled projektu |
| [`ROADMAP.md`](./ROADMAP.md) | Master roadmapa (fáze) |
| [`V3/ROADMAP.md`](./V3/ROADMAP.md) | Detailní V3 implementační stav |
| [`V3/docs/CLI_GUIDE.md`](./V3/docs/CLI_GUIDE.md) | zion CLI koncept |
| [`V3/docs/CLI_REFERENCE.md`](./V3/docs/CLI_REFERENCE.md) | Všechny CLI příkazy |
| [`V3/docker/DOCKER.md`](./V3/docker/DOCKER.md) | Docker compose & profiles |
| [`V3/docker/HARDENING.md`](./V3/docker/HARDENING.md) | Production hardening (ufw, log rotation, non-root) |
| [`docs/MAINNET_CONSTITUTION.md`](./docs/MAINNET_CONSTITUTION.md) | Neměnné parametry protokolu |
| [`docs/DEFI_FULL_ROADMAP.md`](./docs/DEFI_FULL_ROADMAP.md) | DeFi ecosystem plán (6 waves) |
| [`DASHBOARD_AUTOSTART.md`](./DASHBOARD_AUTOSTART.md) | Dashboard — autostart instalace (Windows) |
| [`MAINNET_LAUNCH_SEQUENCE.md`](./MAINNET_LAUNCH_SEQUENCE.md) | Kompletní launch plán 31.12.2026 |
| [`HiranV2.3/PLAN_v2.3.md`](./HiranV2.3/PLAN_v2.3.md) | AI agent v2.3 — DeepSpeed ZeRO-3 full FT + hybrid RAG |
| [`PREMINE_ADDRESSES_PUBLIC.txt`](./PREMINE_ADDRESSES_PUBLIC.txt) | 15 genesis peněženek (veřejné) |

---

*"On the Star — building for 100 years, not for a hype cycle."* ⭐
