# Testovací SSH server – čistý start, nové core a zkouška těžby (CZ)

Tento návod popisuje, jak připravit čistý testovací server (VPS), nasadit ZION core (daemon), volitelně spustit pool a provést rychlou zkoušku těžby.

## 1) Reset starého prostředí (volitelné, destruktivní)

- Skript smaže kontejnery, síť `zion-seeds`, systemd službu `zion`, a adresář `/opt/zion`.
- S `CLEAN=1` navíc odstraní Docker volumes a provede `docker system prune -af`.

```
./scripts/deployment/reset-ssh-server.sh <server-ip> [user]
# nebo destruktivně
CLEAN=1 ./scripts/deployment/reset-ssh-server.sh <server-ip> [user]
```

## 2) Nasazení nového core (a volitelně poolu)

- Skript provede instalaci Dockeru, (případně) Docker Compose, UFW s pravidly pro ZION, vytvoří síť `zion-seeds`, stáhne repozitář a spustí compose s profilem `pool`.
- RPC (18081) je defaultně pouze interní v kontejneru, P2P (18080) je publikovaný ven.

```
./scripts/deployment/deploy-ssh.sh <server-ip> [user]
```

Po 20–90 sekundách by měl být node nahoře. Základní informace skript vypíše; stav ověří healthcheck uvnitř kontejneru.

## 3) Zkouška těžby (xmrig)

Varianty:

- SSH tunel z lokálu na pool (pokud běží profil `pool`):
  - Vytvoření tunelu: `ssh -L 3333:localhost:3333 <user>@<server-ip>`
  - Nastavte miner na `stratum+tcp://localhost:3333` s vaší Z3 adresou

- Docker test miner na serveru (pokud máte `docker/Dockerfile.xmrig`):

```
# na serveru
cd /opt/zion/zion-repo
docker compose -f docker/compose.test-miner.yml up -d xmrig-test
# logy
docker logs -f zion-xmrig-test
```

Poznámka: V `docker/xmrig.config.json` upravte `user` na Z3 adresu, kterou chcete odměňovat.

## Tipy a řešení problémů

- Pokud RPC nechcete publikovat, neotevírejte 18081 na UFW (ponecháno v defaultu).
- Více `seed-node` přidejte do `config/mainnet.conf` pro rychlejší discovery.
- Po prvotní synchronizaci udělejte snapshot volume s blockchainem (`zion_data`).
- Při chybě parsování konfigurace daemona držte se ini-stylu a CLI-only přepínače (např. `--data-dir`) nenechávejte v configu.

```diff
# příklad minimálního configu
rpc-bind-ip=127.0.0.1
rpc-bind-port=18081
p2p-bind-ip=0.0.0.0
p2p-bind-port=18080
seed-node=91.98.122.165:18080
log-level=2
log-file=/var/log/zion/zion.log
```

## Bezpečnost

- Uchovávejte RPC neveřejné (nebo chraňte reverse proxy s ACL/TLS).
- Na serveru povolte jen potřebné porty v UFW.
- Rotujte logy a sledujte provoz (`server-monitor.sh`).

---

Hotovo. Tímto postupem docílíte rychlého, čistého testu nového core a funkcí těžby.
