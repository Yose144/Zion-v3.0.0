# zion-v31-node.service.d — production drop-ins (EDGE2 primary)

Tento adresář obsahuje **produkční override** unit `zion-v31-node.service`,
které se na EDGE2 nasazují vedle základního unitu. Repo base unit je jen
default; bez drop-inu by se primary choval jinak než produkce.

## `zz-primary.conf`

- Resetuje `ExecStart` (proto prázdný `ExecStart=` před novým).
- Live primary binduje RPC na **`0.0.0.0:9445`** (base unit má `127.0.0.1:9445`)
  a přidává **`--peer 62.171.141.136:8336`** (EDGE `node2`).
- Zachováno 1:1 z živého EDGE2 unitu (`systemctl cat zion-v31-node.service`
  + `/etc/systemd/system/zion-v31-node.service.d/zz-primary.conf`), 2026-11-11.

**Proč:** primary musí být dosažitelný z EDGE přes SSH chain tunnel
(`zion-chain-tunnel` forwarduje `127.0.0.1:9445` na EDGE → EDGE2:9445) a pro
pool/explorer cestu. Veřejný přístup jde přes nginx (`rpc.`) a tunel, **ne**
přímým vystavením portu; UFW na EDGE2 musí 9445 dál omezovat.

**Nepřenášet** na host, který má být loopback-only. Pokud se drop-in instaluje
na jiný host, zkontroluj `--peer` a UFW.

## Poznámka k env

Produkce má navíc `10-p03-env-isolation.conf` (P0-3), který načítá
`/etc/zion/env/zion-v31-node.env` po sdíleném `edge-environment.sh`. Ten je
host-specific (obsahuje prostředí konkrétního boxu), a proto tu není; drží ho
`docs/3.2/P0-3-SHARED-ENV-AUDIT.md` a runbook.
