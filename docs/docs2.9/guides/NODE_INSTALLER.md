# ZION Node – jednoduchá instalace (inspirace MystNodes)

Chcete rychle spustit vlastní ZION uzel? Připravili jsme jednoduchý způsob přes Docker Compose, podobně jako „one‑click“ instalátory.

## Požadavky

- Docker a Docker Compose plugin
- macOS / Linux / Windows (WSL2)

## Rychlý start

1) Otevřete terminál v kořeni repozitáře a spusťte instalátor:

```bash
scripts/install-zion-node.sh
```

2) Ověřte, že uzel běží:

```bash
curl http://localhost:18081/getheight
```

3) Logy uzlu:

```bash
docker logs -f zion-node
```

## Co skript dělá

- Vytvoří lokální adresáře `docker/node/{config,data,logs}`
- Nasadí kontejner s `ziond`, zpřístupní porty 18080 (P2P) a 18081 (RPC)
- Použije defaultní konfiguraci `docker/node/zion.conf` (můžete upravit)

## Odinstalace

```bash
scripts/uninstall-zion-node.sh
```

Volitelně smaže persistentní data a logy.

## Poznámky

- Pokud máte předpřipravený image v registry, můžete upravit `docker/compose.single-node.yml` a vynechat lokální build.
- Na veřejný server otevřete porty 18080/18081 ve firewallu.