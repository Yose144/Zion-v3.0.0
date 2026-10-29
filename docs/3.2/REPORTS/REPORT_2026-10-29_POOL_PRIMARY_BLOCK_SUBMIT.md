# REPORT — primary-only `submitBlock` a same-height fork node3 (2026-10-29)

**Větev:** `cursor/pool-primary-block-submit-42e5` · commit `144df59c0` · PR [#87](https://github.com/Yose144/Zion-v3.0.0/pull/87)
**Rozsah:** jen pool (routing nalezeného bloku). Payout `call_all` beze změny. P2P same-height politika (1.B3) beze změny. Na EDGE se nenasazovalo.

## Verdikt

Tip-affinity z 27. 10. (`0cc967c53`, položka 2.B1) opravila zápis bloku na uzel s cizím tipem, ale na stejné výšce fork **prodlužovala**: node3 už držel vlastní blok, `tip == prev_hash` seděl, další blok šel zase tam.

V repu je teď `submitBlock` jen na primary. Šablony a payout fanout dál používají celý seznam endpointů.

Fork na node3 je zahojený. V 01:49 CET (Europe/Prague) mají primary, node2 i node3 stejný tip na výšce **100 325**. Kanonický blok 100 294 není fork `586e1eaf…`.

Běžící binárka poolu na EDGE tuto změnu ještě nemá. Další deploy z `edge-environment.sh` bez ní by tip-affinity znovu zapnul, pokud by seznam RPC zase začínal followery.

## Co se stalo

```text
mineři → pool submitBlock
            ├─ tip-affinity → node2 :9446
            ├─ tip-affinity → node3 :9447   ← stejná výška, cizí tip
            └─ fallback     → primary :9445
node3 při stejné výšce lokální tip drží (P2P: peer není přísně vyšší)
```

- **2.B1** (`submit_block_to_node` v `V31/L1/pool/src/stratum.rs`): probe `getChainInfo` a `submitBlock` tam, kde `tip_hash` / `native_tip_hash` == `previous_hash`. Důvod: `last_good` poslal blok na uzel s cizím tipem a node ho zahodil (`previous hash mismatch`). In-result error se v `call()` bere jako úspěch, takže se další endpoint nezkoušel.
- **29. 10.:** env poolu byl `9446,9447,207.180.217.100:9445` (followeři první). node3 už měl na 100 294 jiný blok (`586e1eaf…`). Tip-affinity další blok zapsal zase na node3 a fork prodloužil.
- **1.B3** zůstává otevřená a v tomto diffu se nesahá. `V31/L1/core/src/p2p.rs`: `peer_height <= our_height` → lokální tip se nechá. node3 skočí na primary, až je primary **přísně vyšší** (shallow reorg, `MAX_REORG_DEPTH=64`).
- **`e53931732`** (`L1Endpoints::call_all`) platí jen pro payout `submitUtxoTransaction`. Mempool je node-local; jeden endpoint = výplata chybí na uzlu, který vyhraje šablonu. To forky bloků nedělá a v tomhle commitu se nemění.

## Co je v gitu

| Místo | Změna |
|---|---|
| `V31/L1/pool/src/rpc_client.rs` | `primary_only`, `select_block_submit_endpoints`, `block_submit_endpoints` |
| `V31/L1/pool/src/stratum.rs` | `submit_block_to_node` už neprobíhá tipy; píše jen na vybraný primary |
| `V31/L1/pool/src/main.rs` | start loguje submit cíl zvlášť od template/payout seznamu |
| `V31/deploy/systemd/zion-v31-pool.service` | `ZION_L1_BLOCK_SUBMIT_URL=http://127.0.0.1:9445` |
| `V31/deploy/config/edge-environment.sh` | stejný pin (repo kopie; živý soubor na serveru se neměnil) |
| `docs/3.2/ZION-POOL-NG-PLAN.md` | odstavec k F6, historické bulletiny nepřepsané |

Pravidlo:

1. `ZION_L1_BLOCK_SUBMIT_URL` — použije se jen **první** platná URL.
2. Jinak jen **první** URL z `--l1-rpc-url` / `ZION_L1_RPC_URL`.
3. Mrtvý primary submit **neopakuje** na follower. Zahozený blok je levnější než prodloužený fork.
4. Šablona z opožděného followeru může na primary dostat `previous hash mismatch` a blok se osiří. Řetěz zůstane kanonický.
5. Standby unit pin nedostal. Jeho `--l1-rpc-url` je už jedno `:9445` přes `ZION_STANDBY_L1_RPC_URL`. Natvrdo `127.0.0.1:9445` na jiném hostu by mířilo na lokální tunel, který tam nemusí být. Fallback na první URL standby kryje.

Repo unit má v `ExecStart` primary první (`9445,9446,9447`). Živý seznam na EDGE followery první míval. „První URL“ bez pinu proto nestačí. Pin v unitu drží submit na primary i když někdo comma list přehází. Kód čte env v okamžiku submitu, ne z clapu: `--l1-rpc-url` na příkazové řádce dál přepíše `ZION_L1_RPC_URL`, ale **nepřepíše** `ZION_L1_BLOCK_SUBMIT_URL`.

## Ověření node3

Primary veřejné RPC i P2P `{"type":"GetStatus"}` (jeden řádek JSON, spojení zavřené, žádný gossip bloků).

| Uzel | Adresa | 01:49 CET | Tip |
|---|---|---|---|
| primary | `207.180.217.100:8335` | výška 100 325 | `b10122c3f98e4044b8495c712a9046b65c5e51cb8d28b96fe0e5839907ec5fb2` |
| node2 | `62.171.141.136:8336` | výška 100 325 | stejný |
| node3 | `62.171.141.136:8337` | výška 100 325 | stejný |

Veřejné `getChainInfo` na `https://rpc.zionterranova.com/jsonrpc` sedí na stejný tip. Výška 100 294 má hash `9530d935c03b03a484ef5ef570f92e934409a65f423ee097b17fbc04d5bd1c23`, ne `586e1eaf…`.

Dřívější odběr ve stejné session (primary už nad 100 294, tip `60d1cb6c…` na 100 307) ukázal totéž: všechny tři uzly na jednom tipu. Mezi odběry řetěz popošel o 18 bloků a shoda drží.

RPC `:9445` / `:9446` / `:9447` zvenku neposlouchá (bind na localhost). P2P 8335/8336/8337 je otevřené a stačilo.

## Testy

`cargo +stable test --locked -p zion-pool --lib` (toolchain 1.99; výchozí 1.83 v tomhle prostředí lockfile s `edition2024` nenačte):

- `block_submit_without_override_is_the_first_endpoint_only`
- `block_submit_url_pins_primary_even_when_followers_are_listed_first`
- `block_submit_url_ignores_extra_entries_and_blank_override`
- `block_submit_contacts_only_the_primary_target` — dva počítací JSON-RPC sockety; follower dostane **0** TCP spojení (starý tip-affinity by ho aspoň pro `getChainInfo` otevřel)
- `call_all_broadcasts_to_every_endpoint`, `call_all_survives_dead_endpoints`, `call_all_prefers_accept_over_rejection` — payout fanout beze změny

## Co nasazené není

- Rebuild ani restart `zion-v31-pool` na EDGE se nedělal. Běžící build dál hlásí provenance starší než tenhle commit a tip-affinity v něm zůstává, dokud se binárka nepřestaví.
- Živý `/etc/zion/edge-environment.sh` (řádek se třemi URL) se neměnil. Ostatní služby ten soubor sdílejí.
- Drop-in `/etc/zion/zion-pool-l1-primary.env` (`ZION_L1_RPC_URL=http://127.0.0.1:9445`) je provozní překryv mimo git. Samotný `ZION_L1_RPC_URL` nestačí, pokud `ExecStart` pořád předává comma list — clap env přebije. Nový kód proto čte samostatný `ZION_L1_BLOCK_SUBMIT_URL`.

## Co se záměrně neměnilo

- P2P same-height heal (1.B3). Je to konsensus. Bez výslovného souhlasu se `p2p.rs` nesahá.
- Payout `call_all` ve sweep / fee / deferred. Sjednocuje mempool, forky bloků nedělá.
- k256 trial, MarketPlace lockfile a knižní soubory mimo tuhle větev.
