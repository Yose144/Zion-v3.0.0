# ZION Mainnet — Kompletní průvodce pro Ericku

> Tento dokument popisuje **krok za krokem**, jak spustit ZION mainnet síť od nuly.
> Psáno tak, aby to zvládl i naprostý začátečník. Pokud něčemu nerozumíš, neboj se —
> každý krok je vysvětlený.

**Verze:** 2026-03-14  
**Autor:** Yose  
**Pro koho:** Ericka (a kdokoliv, kdo potřebuje síť udržet v chodu)

---

## Obsah

1. [Co je ZION a jak funguje](#1-co-je-zion-a-jak-funguje)
2. [Co budeš potřebovat](#2-co-budeš-potřebovat)
3. [Premine peněženky — nejdůležitější věc](#3-premine-peněženky--nejdůležitější-věc)
4. [Příprava serveru](#4-příprava-serveru)
5. [Instalace Dockeru](#5-instalace-dockeru)
6. [Stažení a nahrání kódu na server](#6-stažení-a-nahrání-kódu-na-server)
7. [Spuštění mainnetu](#7-spuštění-mainnetu)
8. [Ověření, že vše běží](#8-ověření-že-vše-běží)
9. [Monitoring a údržba](#9-monitoring-a-údržba)
10. [Záloha a obnova](#10-záloha-a-obnova)
11. [Bezpečnost — co nikdy nedělat](#11-bezpečnost--co-nikdy-nedělat)
12. [Troubleshooting — když něco nefunguje](#12-troubleshooting--když-něco-nefunguje)
13. [Slovníček pojmů](#13-slovníček-pojmů)
14. [Kontakty a nouzový plán](#14-kontakty-a-nouzový-plán)

---

## 1. Co je ZION a jak funguje

ZION je kryptoměna s vlastním blockchainem (řetězcem bloků). Síť tvoří **tři části**:

| Část | Co dělá | Přirovnání |
|------|---------|------------|
| **Node** (uzel) | Uchovává celou historii transakcí, ověřuje bloky, komunikuje s ostatními uzly | Účetní kniha |
| **Pool** (bazén) | Rozděluje práci minerům, sbírá jejich výsledky | Šéf stavby |
| **Miner** (těžař) | Řeší matematické úlohy (PoW), aby vytvořil nové bloky | Dělník na stavbě |

**Jak to funguje dohromady:**
1. Node ví, jaký blok je potřeba najít
2. Pool si od Node vyžádá zadání a rozdělí ho minerům
3. Miner počítá a počítá, dokud nenajde správný výsledek
4. Pool pošle výsledek zpět do Node
5. Node ověří výsledek, přidá blok do řetězce a oznámí ho ostatním uzlům

**Nový blok se vytvoří přibližně každých 60 sekund.**

### Peníze v síti

- Celkový počet ZION, který kdy bude existovat: **144 miliard**
- Na začátku (genesis blok) bylo vytvořeno **16.78 miliard** ZION do 13 peněženek (premine)
- Zbytek (**127.22 miliard**) se postupně vytěží — odměna za blok začíná na ~5,400 ZION a každých ~10 let klesne na 80 % předchozí hodnoty

---

## 2. Co budeš potřebovat

### Hardware (server)

**Minimální požadavky:**
- 4 CPU jádra (doporučeno 8)
- 8 GB RAM (doporučeno 16 GB)
- 100 GB SSD disk (doporučeno 150+ GB)
- Stabilní internetové připojení
- Linux (Ubuntu 22.04 nebo 24.04)

**Doporučení:** Pronajmout VPS (virtuální server) u hostitele jako:
- **Hetzner** (hetzner.com) — nejlepší poměr cena/výkon, EU servery
- **OVH** (ovh.com)
- **Contabo** (contabo.com)

Aktuálně běží na Hetzner v Helsinkách: `157.180.41.213` (8 vCPU, 16 GB RAM, 150 GB SSD, ~15 EUR/měsíc).

### Software (vše se nainstaluje na serveru)
- Docker a Docker Compose (návod níže)
- Git (pro stažení kódu)

### Přístupy
- SSH klíč nebo heslo k serveru
- Přístup na GitHub repozitář `Yose144/2.9.6`
- **Premine peněženky** (viz sekce 3 — KRITICKÉ)

---

## 3. Premine peněženky — nejdůležitější věc

### Co je premine?

Při vytvoření blockchainu (genesis blok) bylo do 14 peněženek vloženo **16.78 miliard ZION**. Tyto peněženky jsou natrvalo zapsané v kódu — adresy jsou veřejné, ale **privátní klíče musí zůstat v bezpečí**.

### 14 premine adres

| # | Účel | Adresa | Částka (ZION) | Zamčeno? |
|---|------|--------|---------------|----------|
| 1 | OASIS Golden Egg 1 | `zion166e6v3k204h8p5w4w3a7m0x790q5m7z5z6n252p` | 1,650,000,000 | NE |
| 2 | OASIS Golden Egg 2 | `zion1l2h8h0e3h7m6p8e297m6n624c5m7r2k364v684a` | 1,650,000,000 | NE |
| 3 | OASIS Golden Egg 3 | `zion1e6r0q3g6t0r0v5f6h7k7c5f3v562j0v7e5e5d0a` | 1,650,000,000 | NE |
| 4 | OASIS Golden Egg 4 | `zion1l7e4c4c5x8l440t295a7m4k5p5x8v8z7r043s23` | 1,650,000,000 | NE |
| 5 | OASIS Golden Egg 5 | `zion1n8h2a8p386z274859833h7v6c5n687f7a6k523u` | 1,650,000,000 | NE |
| 6 | DAO Treasury (hlavní) | `zion176u8r6w53768e2k04035d4d3c2z5g555n6l4r3s` | 2,500,000,000 | ANO — 1 rok |
| 7 | DAO Grants | `zion12643n776r3m8f340484756q06485h5w4c2l405m` | 1,000,000,000 | ANO — 1 rok |
| 8 | DAO Bootstrap | `zion1k8w734x422f3t6t536r287k2c6n3z0e05257606` | 500,000,000 | ANO — 1 rok |
| 9 | Core Dev Fund | `zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c` | 1,000,000,000 | NE |
| 10 | Seed Nodes | `zion1h4w39686t8w376g0x0y426e775q6p2q0v698v43` | 1,000,000,000 | NE |
| 11 | Genesis Creator | `zion1x638z5x6d2d0y6u3f7y8g7j56054a4a2a2c7l8f` | 590,000,000 | NE |
| 12 | Children Future Fund | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` | 1,440,000,000 | NE |
|| 13 | Bridge Seed Fund | `zion1f6m2j0h0l773j4074324q5r528y475w4j7m9685` | 400,000,000 | NE |
| 14 | Bridge Vault UTXO Seed | `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` | 100,000,000 | NE |

> **"Zamčeno — 1 rok"** znamená, že z těchto adres (6, 7, 8) nelze nic poslat, dokud
> síť nedosáhne bloku číslo 525,600 (asi 1 rok po startu). To je zakódováno
> přímo v blockchainu a nejde to obejít.

### Kde jsou privátní klíče?

Soubor `PREMINE_WALLETS_BACKUP.json` obsahuje privátní klíče ke všem 13 peněženkám.

**KRITICKY DŮLEŽITÉ:**

1. **Offline kopie**: Klíče musí existovat na **offline** úložišti (USB flash disk, papír v trezoru). Nikdy jen na serveru.
2. **Nikdy na internetu**: Soubor s klíči nesmí být na žádném serveru, který je připojený k internetu.
3. **Dvě zálohy**: Minimálně dvě nezávislé zálohy na dvou různých místech.
4. **Kdo ztratí klíče, ztratí peníze navždy** — neexistuje žádná obnova, žádné "zapomenuté heslo".

### Jak klíče zálohovat

```
Doporučená struktura:
├── USB Flash 1 (uložit v trezoru/bezpečném místě A)
│   └── PREMINE_WALLETS_BACKUP.json
│   └── README.txt (s tímto návodem)
│
├── USB Flash 2 (uložit v bezpečném místě B, jiná lokalita)
│   └── PREMINE_WALLETS_BACKUP.json
│   └── README.txt
│
└── Papírová záloha (vytisknout adresy + klíče, uložit v trezoru)
```

### Testování klíčů

Než cokoliv pošleš, vždy nejdřív:
1. Ověř, že adresa odpovídá klíči (pomocí DesktopApp nebo `crypto.rs` knihovny)
2. Pošli nejdříve **malou částku** (např. 1 ZION) jako test
3. Ověř, že transakce prošla
4. Teprve pak pošli větší částku

---

## 4. Příprava serveru

### 4.1 Přihlášení na server

Otevři **Terminal** (na Macu) nebo **PowerShell** (na Windows) a zadej:

```bash
ssh root@ADRESA_SERVERU
```

Příklad s naším serverem:
```bash
ssh root@157.180.41.213
```

Pokud máš SSH klíč:
```bash
ssh -i ~/.ssh/tvuj_klic root@157.180.41.213
```

### 4.2 Aktualizace systému

Po přihlášení na server spusť:

```bash
apt update && apt upgrade -y
```

To aktualizuje veškerý software na serveru. Může to trvat několik minut.

### 4.3 Základní zabezpečení

```bash
# Vytvoř uživatele pro ZION (nepoužívej root pro běžný provoz)
adduser zion
usermod -aG sudo zion
usermod -aG docker zion

# Nastav firewall — povol jen potřebné porty
ufw allow 22/tcp      # SSH (abys mohla přistupovat na server)
ufw allow 8334/tcp    # ZION P2P (komunikace mezi uzly)
ufw allow 8444/tcp    # ZION Pool (připojení minerů)
ufw enable            # Zapni firewall
```

> **RPC port 8332 neotvírej do internetu.** Pool se k node připojuje interně přes Docker síť a z hosta používej jen `localhost:8332`.

> **Poznámka:** Port 22 je SSH — pokud ho zablokuješ, přijdeš o přístup k serveru!

---

## 5. Instalace Dockeru

Docker je nástroj, který zabalí celou aplikaci do "kontejneru" — jako krabice, která
obsahuje vše potřebné. Nemusíš instalovat žádné programovací jazyky ani knihovny.

### 5.1 Instalace

```bash
# Nainstaluj Docker
curl -fsSL https://get.docker.com | sh

# Ověř, že funguje
docker --version
docker compose version
```

Mělo by se zobrazit něco jako:
```
Docker version 27.x.x
Docker Compose version v2.x.x
```

### 5.2 Povolení Dockeru pro uživatele zion

```bash
usermod -aG docker zion
```

Od teď se přihlašuj jako uživatel `zion`:
```bash
su - zion
```

---

## 6. Stažení a nahrání kódu na server

### Varianta A: Git clone (jednodušší)

Na serveru:
```bash
cd /opt
sudo git clone https://github.com/Yose144/2.9.6.git zion-repo
sudo chown -R zion:zion /opt/zion-repo
cd /opt/zion-repo/V3
```

### Varianta B: Rsync z tvého počítače (pokud máš repo lokálně)

Z tvého Macu/PC:
```bash
rsync -avz --exclude target --exclude .git \
  ~/Projects/2.9.6/V3/ \
  zion@ADRESA_SERVERU:/opt/zion/
```

Příklad:
```bash
rsync -avz --exclude target --exclude .git \
  ~/Projects/2.9.6/V3/ \
  zion@157.180.41.213:/opt/zion/
```

---

## 7. Spuštění mainnetu

### 7.1 Přejdi do správného adresáře

```bash
cd /opt/zion-repo/V3    # pokud jsi použila git clone
# NEBO
cd /opt/zion            # pokud jsi použila rsync
```

### 7.2 Sestav Docker obrazy

```bash
docker compose -f docker/docker-compose.v3-mainnet.yml build
```

> **Toto bude trvat 5–15 minut** (podle výkonu serveru). Stahuje se Rust
> kompilátor a kompiluje se celý blockchain kód. Uvidíš spoustu textu —
> to je normální.

Pokud vidíš na konci `Successfully built` a `Successfully tagged`, je vše OK.

### 7.3 Spusť síť

```bash
docker compose -f docker/docker-compose.v3-mainnet.yml up -d
```

Parametr `-d` znamená "na pozadí" — kontejnery poběží i po zavření terminálu.

### 7.4 Ověř spuštění

```bash
docker compose -f docker/docker-compose.v3-mainnet.yml ps
```

Mělo by se zobrazit:
```
NAME    STATUS          PORTS
node    Up X minutes    0.0.0.0:8334->8334, 127.0.0.1:8332->8332
pool    Up X minutes    0.0.0.0:8444->8444
miner   Up X minutes
```

**Všechny tři služby musí mít status `Up`.**

---

## 8. Ověření, že vše běží

### 8.1 Logy (záznamy)

```bash
# Logy node (nejdůležitější)
docker compose -f docker/docker-compose.v3-mainnet.yml logs node --tail 50

# Logy pool
docker compose -f docker/docker-compose.v3-mainnet.yml logs pool --tail 50

# Logy miner
docker compose -f docker/docker-compose.v3-mainnet.yml logs miner --tail 50

# Všechny najednou (průběžně)
docker compose -f docker/docker-compose.v3-mainnet.yml logs -f
```

> Tip: `Ctrl+C` zastaví průběžné sledování logů (nezastaví to síť!).

### 8.2 JSON-RPC dotazy

Node odpovídá na JSON-RPC 2.0. Můžeš se ptát na stav sítě:

```bash
# Informace o řetězci (výška, hash posledního bloku)
curl -s -X POST http://localhost:8332 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | python3 -m json.tool

# Informace o uzlu
curl -s -X POST http://localhost:8332 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getNodeInfo","params":[],"id":1}' | python3 -m json.tool

# Zůstatek wallet id v aktuálním runtime
curl -s -X POST http://localhost:8332 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getBalance","params":["zion-mainnet-miner-0"],"id":1}' | python3 -m json.tool

# Připojení vrstevníci (peers)
curl -s -X POST http://localhost:8332 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getPeerInfo","params":[],"id":1}' | python3 -m json.tool
```

> **Důležité:** `getBalance`, `getAccountBalance`, `submitTransaction` a `submitAccountTransaction` dnes pracují nad wallet id z běhového account-style runtime, ne nad odděleným UTXO/premine světem. Premine `zion1...` adresy proto tímto RPC zatím neuvidíš korektně a `getBalance` je nyní odmítne explicitně.

### 8.3 Co hledat v logách

**Dobré znaky (vše OK):**
- `Accepted block at height X` — síť přijímá nové bloky
- `Template updated` — pool dostává nové zadání
- `Share accepted` — miner posílá platné výsledky
- `Connected to peer` — uzel komunikuje s ostatními

**Varovné znaky (zkontrolovat):**
- `Connection refused` — pool se nemůže připojit k node (zkontrolovat, zda node běží)
- `Stale job` — miner pracuje na starém zadání (normální občas, problém pokud stále)
- `Ban` — uzel zablokoval podezřelého peera (normální bezpečnostní opatření)

**Chybové znaky (řešit):**
- `panic` — program spadl (restartovat, viz troubleshooting)
- `disk full` — plný disk (musíš rozšířit nebo vyčistit)
- `out of memory` — málo RAM (potřebuješ větší server)

---

## 9. Monitoring a údržba

### 9.1 Denní kontrola (1 minuta)

```bash
# Zkontroluj, že všechny kontejnery běží
docker compose -f docker/docker-compose.v3-mainnet.yml ps

# Zkontroluj výšku řetězce
curl -s -X POST http://localhost:8332 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'
```

Výška řetězce by měla každou minutu růst o 1. Za den to je ~1,440 bloků.

### 9.2 Týdenní kontrola (5 minut)

```bash
# Kolik místa zabírá blockchain na disku
du -sh /var/lib/docker/volumes/

# Kolik volného místa zbývá
df -h

# Aktualizace systému
sudo apt update && sudo apt upgrade -y
```

### 9.3 Restart služeb

```bash
# Restart všeho
docker compose -f docker/docker-compose.v3-mainnet.yml restart

# Restart jen jedné služby (např. miner)
docker compose -f docker/docker-compose.v3-mainnet.yml restart miner

# Úplné zastavení a spuštění
docker compose -f docker/docker-compose.v3-mainnet.yml down
docker compose -f docker/docker-compose.v3-mainnet.yml up -d
```

### 9.4 Aktualizace kódu

Když je k dispozici nová verze:

```bash
cd /opt/zion-repo
git pull origin main

cd V3
docker compose -f docker/docker-compose.v3-mainnet.yml build
docker compose -f docker/docker-compose.v3-mainnet.yml up -d
```

> **Důležité:** Blockchain data se neztratí — jsou uložená ve Docker volume
> `zion-node-data`, které přežije restart i rebuild.

---

## 10. Záloha a obnova

### 10.1 Co zálohovat

| Co | Kde to je | Jak často | Proč |
|----|-----------|-----------|------|
| Premine klíče | Offline USB/trezor | Jednorázově | **Ztráta = ztráta 16.78B ZION** |
| Blockchain data | Docker volume `zion-node-data` | Týdně | Pro rychlý restart bez stahování |
| peers.json | Uvnitř Docker volume | Automaticky | Seznam známých uzlů |
| Tento návod | Minimálně 2 kopie | Při změnách | Abys věděla, co dělat |

### 10.2 Záloha blockchain dat

```bash
# Zastav node (aby data nebyla poškozená během kopírování)
docker compose -f docker/docker-compose.v3-mainnet.yml stop node

# Vytvoř zálohu
docker run --rm -v zion-node-data:/data -v $(pwd):/backup \
  debian:bookworm-slim tar czf /backup/zion-chain-backup-$(date +%Y%m%d).tar.gz /data

# Spusť node zpět
docker compose -f docker/docker-compose.v3-mainnet.yml start node
```

### 10.3 Obnova ze zálohy

```bash
# Zastav vše
docker compose -f docker/docker-compose.v3-mainnet.yml down

# Obnov data
docker run --rm -v zion-node-data:/data -v $(pwd):/backup \
  debian:bookworm-slim tar xzf /backup/zion-chain-backup-YYYYMMDD.tar.gz -C /

# Spusť vše
docker compose -f docker/docker-compose.v3-mainnet.yml up -d
```

### 10.4 Nový server od nuly (bez zálohy)

Pokud nemáš zálohu blockchain dat, uzel si je stáhne od ostatních uzlů (seed peers).
Může to trvat déle, ale funguje to automaticky — ZION má vestavěný IBD
(Initial Block Download).

```bash
# Na novém serveru:
# 1. Nainstaluj Docker (sekce 5)
# 2. Stáhni kód (sekce 6)
# 3. Spusť mainnet (sekce 7)
# Uzel se automaticky připojí k seed peers a stáhne celý řetězec.
```

---

## 11. Bezpečnost — co nikdy nedělat

### NIKDY:

1. **Nikdy nedávej privátní klíče na server** — klíče k premine peněženkám musí být offline
2. **Nikdy nesdílej privátní klíče emailem, chatem, ani přes cloud** (Google Drive, Dropbox…)
3. **Nikdy nespouštěj síť jako `root`** — používej uživatele `zion`
4. **Nikdy nevypínej firewall** (`ufw disable`)
5. **Nikdy nezveřejňuj repozitář před BFG scrubem** — v git historii jsou privátní klíče!
6. **Nikdy neměň genesis blok** — tím bys vytvořila jinou síť (fork)
7. **Nikdy neinstaluj neznámý software na server** kde běží mainnet

### Co je BFG scrub?

V historii git repozitáře existuje soubor `PREMINE_WALLETS_BACKUP.json` s privátními
klíči. I když byl smazán, je stále v historii. **BFG Repo-Cleaner** je nástroj,
který ho odstraní ze CELÉ historie. **Toto MUSÍ být provedeno před jakýmkoliv
zveřejněním repozitáře.**

```bash
# BFG scrub (POUZE jednou, PŘED zveřejněním)
# Stáhni BFG: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files PREMINE_WALLETS_BACKUP.json /opt/zion-repo
cd /opt/zion-repo
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all    # POZOR: přepíše celou historii na GitHubu
```

> **Další bezpečnostní poznámka:** Tyto instrukce předpokládají, že repozitář je
> soukromý. Pokud se někdy rozhodneš ho zveřejnit, udělej BFG scrub PRVNÍ, a pak
> ideálně vytvoř nový veřejný repozitář jen s V3/ adresářem.

### SSH hardening

```bash
# Změna výchozího SSH portu (volitelné, ale doporučené)
sudo nano /etc/ssh/sshd_config
# Najdi:     Port 22
# Změň na:   Port 2222  (nebo jiný)
# Ulož:      Ctrl+O, Enter, Ctrl+X

# Zakázání přihlášení heslem (pokud máš SSH klíč)
sudo nano /etc/ssh/sshd_config
# Najdi:     PasswordAuthentication yes
# Změň na:   PasswordAuthentication no

sudo systemctl restart sshd

# Nezapomeň aktualizovat firewall:
sudo ufw allow 2222/tcp
sudo ufw delete allow 22/tcp
```

---

## 12. Troubleshooting — když něco nefunguje

### "Kontejner se neustále restartuje"

```bash
# Podívej se na logy
docker compose -f docker/docker-compose.v3-mainnet.yml logs node --tail 100

# Nejčastější příčiny:
# - Plný disk → uvolni místo
# - Poškozená data → smaž volume a nech uzel resynchronizovat:
docker compose -f docker/docker-compose.v3-mainnet.yml down
docker volume rm $(docker compose -f docker/docker-compose.v3-mainnet.yml config --volumes | head -1)
docker compose -f docker/docker-compose.v3-mainnet.yml up -d
```

### "Pool se nemůže připojit k Node"

```bash
# Ověř, že node běží
docker compose -f docker/docker-compose.v3-mainnet.yml ps node

# Ověř, že node poslouchá na portu 8332
docker compose -f docker/docker-compose.v3-mainnet.yml exec node ss -tlnp | grep 8332

# Pool musí mít v env: ZION_NODE_RPC_ADDR=node:8332
# (v docker-compose je to nastaveno automaticky)
```

### "Miner nic netěží"

```bash
# Zkontroluj logy mineru
docker compose -f docker/docker-compose.v3-mainnet.yml logs miner --tail 50

# Miner potřebuje:
# 1. Pool musí běžet
# 2. Pool musí být připojený k Node
# 3. Node musí mít aktuální template

# Zkus restart mineru:
docker compose -f docker/docker-compose.v3-mainnet.yml restart miner
```

### "Řetězec nerostě (výška se nemění)"

```bash
# Ověř, že miner pracuje
docker compose -f docker/docker-compose.v3-mainnet.yml logs miner --tail 20

# Ověř, že node má template
curl -s -X POST http://localhost:8332 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getBlockTemplate","params":[],"id":1}'

# Pokud máš jen tento jeden server bez externích minerů,
# při vysoké obtížnosti může těžba trvat déle.
```

### "docker compose build" selže

```bash
# Nejčastější příčina: málo místa na disku
df -h

# Vyčisti staré Docker obrazy
docker system prune -f

# Zkus build znovu
docker compose -f docker/docker-compose.v3-mainnet.yml build --no-cache
```

### "Nemohu se připojit na server přes SSH"

1. Zkontroluj, zda je server zapnutý (v panelu hostitele — např. Hetzner Cloud)
2. Zkontroluj, zda používáš správnou IP adresu
3. Zkontroluj, zda jsi nezměnila SSH port (výchozí je 22, mohl být změněn na 2222)
4. Zkontroluj firewall pravidla v panelu hostitele

---

## 13. Slovníček pojmů

| Pojem | Vysvětlení |
|-------|------------|
| **Blockchain** | Digitální účetní kniha — neměnitelný řetězec bloků s transakcemi |
| **Blok** | Stránka v účetní knize — obsahuje seznam transakcí |
| **Genesis blok** | Úplně první blok (č. 0) — obsahuje premine |
| **Premine** | Mince vytvořené při startu sítě, před začátkem těžby |
| **Privátní klíč** | Tajné heslo k peněžence — kdo ho má, ovládá peníze |
| **Veřejná adresa** | Číslo účtu — bezpečné sdílet, používá se pro příjem |
| **Node (uzel)** | Program, který uchovává celý blockchain a ověřuje transakce |
| **Miner (těžař)** | Program, který řeší matematické úlohy za odměnu (nové mince) |
| **Pool (bazén)** | Prostředník, který rozděluje práci minerům |
| **PoW** | Proof of Work — důkaz prací = způsob, jakým se ověřují bloky |
| **Docker** | Nástroj pro spouštění aplikací v izolovaných kontejnerech |
| **Docker Compose** | Nástroj pro spuštění více Docker kontejnerů najednou |
| **SSH** | Secure Shell — zabezpečené vzdálené připojení k serveru |
| **Firewall** | Brána, která blokuje neoprávněný přístup k serveru |
| **Volume** | Trvalé úložiště pro Docker kontejner (data přežijí restart) |
| **RPC** | Remote Procedure Call — způsob, jak se programy ptají na data |
| **P2P** | Peer-to-Peer — přímá komunikace mezi uzly bez prostředníka |
| **Seed peers** | Výchozí uzly, ke kterým se nový uzel připojuje na začátku |
| **IBD** | Initial Block Download — stažení celého řetězce při startu |
| **DAA** | Difficulty Adjustment — automatická úprava obtížnosti těžby |
| **UTXO** | Unspent Transaction Output — model sledování zůstatků |
| **Fork** | Rozdělení řetězce — vzniknou dva konkurující řetězce |
| **DAO** | Decentralized Autonomous Organization — komunální pokladna |
| **BFG** | Nástroj pro odstranění dat z git historie |

---

## 14. Kontakty a nouzový plán

### Nouzové postupy

| Situace | Co udělat |
|---------|-----------|
| Server nereaguje | Restartovat přes panel hostitele (Hetzner), pak se připojit přes SSH |
| Síť stojí (nerostou bloky) | Restartovat miner, ov. logy, kontaktovat Yose |
| Podezření na útok | Vypni pool port (`ufw deny 8444`), kontaktovat Yose |
| Ztráta přístupu k serveru | Použít nouzový přístup přes panel hostitele (KVM konzole) |
| Potřeba poslat ZION z premine | **STOP** — neotvírej klíče na serveru! Kontaktuj Yose. |

### Důležité soubory

| Soubor | Kde je | Co obsahuje |
|--------|--------|-------------|
| `docker-compose.v3-mainnet.yml` | `V3/docker/` | Konfigurace celé sítě |
| `PREMINE_ADDRESSES_PUBLIC.txt` | Kořen repozitáře | 12 veřejných adres |
| `PREMINE_WALLETS_BACKUP.json` | **OFFLINE ONLY!** | Privátní klíče — NIKDY na serveru |
| Tento dokument | `V3/docs/ERICKA_MAINNET_GUIDE.md` | Návod, který právě čteš |
| `V3/README.md` | `V3/` | Technický přehled projektu |
| `V3/ROADMAP.md` | `V3/` | Plán vývoje a stav modulů |

### Porty

| Port | Služba | Směr | Potřebný |
|------|--------|------|----------|
| 22 (nebo 2222) | SSH | TVůj počítač → server | ANO — bez toho nemáš přístup |
| 8334 | P2P | Ostatní uzly ↔ server | ANO — bez toho je uzel izolovaný |
| 8332 | RPC | Pool → Node (interní) | ANO — ale nevystavuj na internet |
| 8444 | Pool stratum | Minerové → Pool | JEN pokud chceš, aby se připojovali externí minerové |

---

## Rychlý tahák (Quick Reference)

```bash
# === STAV ===
docker compose -f docker/docker-compose.v3-mainnet.yml ps         # běží?
docker compose -f docker/docker-compose.v3-mainnet.yml logs -f     # co se děje?

# === RESTART ===
docker compose -f docker/docker-compose.v3-mainnet.yml restart     # restart vše
docker compose -f docker/docker-compose.v3-mainnet.yml restart miner  # restart jen miner

# === STOP / START ===
docker compose -f docker/docker-compose.v3-mainnet.yml down        # zastavit vše
docker compose -f docker/docker-compose.v3-mainnet.yml up -d       # spustit vše

# === AKTUALIZACE ===
cd /opt/zion-repo && git pull origin main
cd V3 && docker compose -f docker/docker-compose.v3-mainnet.yml build
docker compose -f docker/docker-compose.v3-mainnet.yml up -d

# === LOGY ===
docker compose -f docker/docker-compose.v3-mainnet.yml logs node --tail 50
docker compose -f docker/docker-compose.v3-mainnet.yml logs pool --tail 50
docker compose -f docker/docker-compose.v3-mainnet.yml logs miner --tail 50

# === INFORMACE O SÍTI ===
curl -s -X POST http://localhost:8332 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'
```

---

**S láskou pro Ericku, Peace & One Love — Yose** ❤️
