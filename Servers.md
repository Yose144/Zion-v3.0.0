# Mainnet V3 — servery a kompletní nasazení

Poslední úprava: 2026-05 (greenfield řetězec od genesis — viz `StatusV3.md`).  
Projektová dokumentace: [`V3/docker/DOCKER.md`](V3/docker/DOCKER.md), [`V3/docker/HARDENING.md`](V3/docker/HARDENING.md), [`V3/docs/MAINNET_DEPLOY_RUNBOOK.md`](V3/docs/MAINNET_DEPLOY_RUNBOOK.md), [`V3/docs/operational/AUDIT_CLOSEOUT_1_THROUGH_6.md`](V3/docs/operational/AUDIT_CLOSEOUT_1_THROUGH_6.md).

---

## Tabulka flotily (aktuální)

| Role          | Lokace    | IPv4               | Poznámka                                         |
|---------------|-----------|-------------------|--------------------------------------------------|
| Koordinátor   | Helsinki  | `204.168.245.175` | Main — první uzel (`ZION_SEED_PEERS` **prázdné**); typicky node + pool + vnější miner |
| Node 1        | Singapur  | `5.223.62.255`    | Follower — seed jen na Helsinki `204.168.245.175:8333` |
| Node 2        | USA       | `5.78.197.254`    | Follower — seed jen na Helsinki `204.168.245.175:8333` |

SSH: jeden klíč v `~/.ssh` na všech hostech (uživatel dle systévu, níže **`root`** jako příklad).

Export pro skripty:

```bash
export COORD="204.168.245.175"
export N1="5.223.62.255"
export N2="5.78.197.254"
export NODES="${COORD} ${N1} ${N2}"
export SEED="${COORD}:8333"
```

---

## Automatizovaný bootstrap (Praha = šablona `.env`, kód z lokálního `V3/`)

Na **prod operátorském počítači** (kde máš checkout tohoto repa a SSH klíč):

```bash
export ZION_SSH_USER=root
export ZION_SSH_IDENTITY="${HOME}/.ssh/zion_hetzner_key"
export ZION_TEMPLATE_HOST=91.98.122.165          # Praha — jen docker/.env (pool SK, miner wallet)
export ZION_TARGET_HOST="${COORD}"
export ZION_FLEET_ROLE=coordinator                # follower: nastav též ZION_COORD_P2P="${COORD}:8333"
./V3/scripts/fleet-mainnet-remote-bootstrap.sh
```

Skript: [`V3/scripts/fleet-mainnet-remote-bootstrap.sh`](V3/scripts/fleet-mainnet-remote-bootstrap.sh) — nainstaluje Docker na cíli (pokud chybí), **rsync** lokálního `V3/` na **`/root/zion-v3-fleet/V3`**, složí `docker/.env` z [`V3/docker/.env.example`](V3/docker/.env.example) + hodnot z **`/root/zion-2.9.6/docker/.env`** na Praze (`MINER_WALLET` → `ZION_MINER_ADDRESS`), nastaví `ZION_SEED_PEERS`, provede **`docker compose -f docker-compose.v3-mainnet.yml down -v`** (greenfield volumy), **`up -d --build`**, kontrola `/health` a `getChainInfo`.

**Firewall na cílovém VPS po skriptu:** nezapomeň otevřít **8333/tcp** (P2P) a zvenku **8444/tcp** (pool pro minery), pokud to `ufw`/security group blokuje — skript síť nekonfiguruje.

**Odlišnost od Pražského compose:** aktivní VPS v Praze běží **vlastní** starší stack (`docker-compose.v3-mainnet.yml` pod `/root/zion-2.9.6/docker` s **pool port 3333** a `network_mode: host`). Kanonické soubory v **tomto** repu mapují stratum na **8444** a RPC jen **127.0.0.1:8443**. Minery a externí tooling pro nový Helsinki mainnet používej proti **`204.168.245.175:8444`** (ne 3333).

**Followři (Singapore / USA):**

```bash
export ZION_TARGET_HOST="${N1}"   # nebo N2
export ZION_FLEET_ROLE=follower
export ZION_COORD_P2P="${COORD}:8333"
./V3/scripts/fleet-mainnet-remote-bootstrap.sh
```

---

## Start pomalu — fáze 0 (řekni si „dnes jen příprava“)

Cíl: na **Helsinkách** mít SSH + Docker + naklonované repo a `.env` rozumně vyplněné — **ještě bez** followerů, nebo je nech vypnuté, dokud koordinátor neprošel healthcheckem.

| Krok | Co udělat |
|------|-----------|
| 0a | **SSH host key:** při novém VPS smaž staré záznamy v `~/.ssh/known_hosts` (jinak `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED`). Bezpečně: `ssh-keygen -R <IP>` pro `COORD`, `N1`, `N2`. Otisk nového klíče ověř u providera, pak první přihlášení ručně (`ssh root@…`). |
| 0b | **Čistý řetězec:** rozhodni, jestli na koordinátorovi **vyhazuješ starý datadir / volume** (`zion-node-data` apod.) — u greenfield Mainnet V3 ano, pokud tam nebyla už jen tato verze. |
| 0c | **Docker:** na každém hostovi nainstalovat Engine + Compose v2 (např. [get.docker.com](https://get.docker.com) nebo balíčky z distro). Bez toho compose z `Servers.md` nepoběží. |
| 0d | **Repo + pin:** stejný git **commit** na všech třech strojích (`git rev-parse HEAD` musí sedět). Lokálně měj alespoň jeden **pushnutý** bod na `origin`, ať se na servery dá `git pull`. |
| 0e | **Jen Helsinki první:** `ZION_SEED_PEERS=` prázdné, `docker compose … up` (node / nebo celý mainnet stack dle plánu). Až `getChainInfo` a logy vypadají zdravě, přidej **Singapore** a **USA** se seedem na `204.168.245.175:8333`. |

**Rychlý test z notebooku po 0a:** `ssh -o ConnectTimeout=10 root@${COORD} 'hostname && docker --version'` — očekáveš jméno stroje a číslo verze Dockeru (ne `no_docker`).

---

## Předpoklady (všechny hosty)

1. **Docker + Docker Compose** v2 (stack běží v kontejnerech dle [`V3/docker/docker-compose.yml`](V3/docker/docker-compose.yml)).
2. **Firewall**
   - **8333/tcp** ven (P2P) — všude, kde má být plnohodnotný uzel.
   - **8443** (RPC) — ideálně jen **localhost**/VPN/firewall na allowlist; neexponovat veřejně bez nutnosti.
   - **8444/tcp** jen tam, kde běží **pool** směrem k minerům (typicky Helsinki).
   - Detailní pravidla: [`V3/docker/HARDENING.md`](V3/docker/HARDENING.md).
3. **Kód / images:** build z **`main`**, artefakt **bez** feature `testnet_fork_rehearsal` (produkční konsensus od výšky **0**).
4. **Datadir nový řetězec:** při prvním greenfield greenlight smazat / nepoužívat stará data z před‑V3 nebo XOR řetězce — viz `AUDIT_CLOSEOUT` §2 a §7.

---

## Repo na serverech

Stejná absolutní cesta na všech hostech usnadňuje copy‑paste (`REMOTE_DIR` uprav):

```bash
export REMOTE_DIR="/opt/zion/V3"

# Doporučeno na každém hostu: git clone + checkout stejného tagu/commitu, pak:
#   cd ${REMOTE_DIR} && git pull && git checkout <release-tag>

# Nebo nasyncuj celý strom V3/ z lokálního počítače (z kořene repa kde existuje ./V3/):
rsync -az --delete --exclude target --exclude '**/target' \
  ./V3/ root@${COORD}:${REMOTE_DIR}/

for h in ${N1} ${N2}; do
  rsync -az --delete --exclude target --exclude '**/target' \
    ./V3/ root@${h}:${REMOTE_DIR}/
done
```

Na serverech drž **stejný git commit/tag** napříč flotilou před ostrým zapnutím P2P.

---

## Konfigurace prostředí (`.env` v `docker/`)

Na každém hostě:

```bash
cd ${REMOTE_DIR}/docker   # např. /opt/zion/V3/docker
cp .env.example .env
cp .env.mainnet.example .env.mainnet   # pokud používáš split; jinak doplň do .env
```

**Sdílené (všechny uzly):** `ZION_NODE_ID` unikátní na host (`helsinki-main`, `singapore-1`, `usa-2`), správné **fee split** adresy (`ZION_MINER_ADDRESS`, humanitarian, pool fee…) dle operační dokumentace — ověř uvnitř běžícího kontejneru jako v [`MAINNET_DEPLOY_RUNBOOK.md`](V3/docs/MAINNET_DEPLOY_RUNBOOK.md) §6.

**Koordinátor (Helsinki):**

```env
ZION_SEED_PEERS=
```

**Followři (Singapore, USA)** — jen jeden koordinující peer, **bez** vlastní veřejné IP v tomto řetězci:

```env
ZION_SEED_PEERS=204.168.245.175:8333
```

Na **žádném** hostu neuváděj ve `ZION_SEED_PEERS` **vlastní** `veřejná_ip:8333`.

Další klíče: porty (`P2P_PORT`, `RPC_PORT`), `POOL_PORT` kde poběží pool — viz [.env.example](V3/docker/.env.example).

---

## Pořadí spuštění (kritické)

1. **Helsinki:** node musí naběhnout jako první a naslouchat P2P.
2. Až Helsinki hlásí zdravý node (`/health`, log bez fatálních chyb), spusť **Singapore**, pak **USA** (pořadí followerů je pružné, ale až koordinátor žije).

---

## Compose příkazy

**Koordinátor — plný Mainnet stack (node + pool + vestavěný miner v compose):**

```bash
ssh root@${COORD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.yml --profile mainnet up -d --build"
```

Na produkci často vestavěný `miner` službou vypneš (`--scale miner=0`) nebo necháš jen pro lokální kouř; hlavní těžba může být externí proces / jiný host — rozhodni podle provozu.

**Followři — pouze core node (bez poolu na stejném stroji):**

```bash
for h in ${N1} ${N2}; do
  ssh root@${h} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.yml --profile mainnet up -d --build node"
done
```

Logy:

```bash
ssh root@${COORD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.yml logs -f --tail=100 node"
```

Alternativa (starší jednosouborové compose): [`V3/docker/docker-compose.v3-mainnet.yml`](V3/docker/docker-compose.v3-mainnet.yml) — musí sedět stejné env proměnné jako u nového unify compose.

---

## Ověření po nasazení

### 1) Kontejnery

```bash
for h in $NODES; do
  echo "===== ${h} ====="
  ssh root@${h} "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
done
```

### 2) Shoda řetězce (JSON-RPC řádek + LF, port **8443**)

```bash
for h in $NODES; do
  echo "===== ${h} ====="
  ssh root@${h} 'printf "%s\n" "{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}" | nc -w 3 127.0.0.1 8443'
done
```

Všude musí sedět **`chain_height`** a **`tip_hash`**. Rozdíly = P2P / firewall / nesoulad genesis nebo špatný seed.

### 3) Lokálně z vývojářského počítače

```bash
export PATH="/path/to/V3/target/release:$PATH"
# dočasný ~/.zion nebo odkaz na dokumentaci zion.toml
zion node status
zion node rpc getChainInfo
```

Nasměruj `rpc_host` na veřejnou IP jen pokud máš bezpečné pravidlo firewallu.

### 4) Pool a mining (End-to-End)

- Logy poolu na koordinátorovi: `docker compose logs pool` (název služby dle aktuálního compose — často `pool`, kontejner `zion-v3-pool`).
- Z notebooku / těžebního stroje:

```bash
zion mine start --pool ${COORD}:8444 --wallet zion1... --threads auto --backend auto
```

Očekávej ve výpisu mineru **`welcome`**, **`mining job`** a **`Accepted`** shares. Pokud více minerů za jednou IP (`ZION_MAX_SESSIONS_PER_IP` na poolu).

### 5) Růst výšky

Po startu všech nodů počkej na nové bloky; lze sledovat cyklem `getChainInfo` (viz MAINNET_DEPLOY_RUNBOOK §8).

---

## Rollback / znovustežení řetězce

Změnil‑li sis omylem konsensus bez koordinovaného výstupku: **zastavit všechny uzly**, smazat **datadir** všude, znovu spustit v pořadí Helsinki → followers. Nesmíš míchat uložený stav ze starým genesis nebo XOR řetězcem.

---

## Checklist před „go mainnet publicity“

- [ ] Všechny tři hosty na **stejném** git commitu, **bez** `testnet_fork_rehearsal` v release image  
- [ ] `ZION_SEED_PEERS` jen jak výše  
- [ ] Shoda **`tip_hash`** na všech uzlech  
- [ ] Pool health + miner share **Accepted**  
- [ ] RPC neleží zbytečně na `0.0.0.0:8443` bez ochrany  
- [ ] Záloha / dokumentace provozních klíčů a `.env` mimo repo (bez commitu tajemství)  

Další mise (bridge, DAO, monitoring): profily `monitoring`, L2 docs v `V3/L2/` a `CLI_DEPLOY_PLAYBOOK.md`.
