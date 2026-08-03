# Audit close-out — položky 1–7 (sekvenční playbook)

Tento dokument navazuje na shrnutí v [`StatusV3.md`](../../../StatusV3.md) §2 a na
[`2026-04-V3_AUDIT_COMPLETION.md`](../audits/2026-04-V3_AUDIT_COMPLETION.md) §7–8.

---

## 1. Rotace kompromitovaných credentialů (P0 — manuálně)

**Vlastník:** držitel účtů GitHub / OpenAI / SSH na produkčním nodu.

Postup je autoritativně popsán v kořeni repa v
[`SECURITY_NOTICE_2026-04-28.md`](../../../SECURITY_NOTICE_2026-04-28.md)
(body „Actions still required“ pro wallet leak i addendum `ZION_KEYS/`).

Checklist bez opakování tajných hodnot:

1. Revoke GitHub PAT (Security → Tokens + security log).
2. Smazat / přegenerovat OpenAI klíč (Usage audit).
3. Rotovat SSH klíč na produkčním hostu (`authorized_keys`, audit `sshd`).
4. Po rotaci teprve má smysl **bod 5** (history scrub) jako dlouhodobá hygiena.

Do dokončení kroků 1–3 audit **F3b nepovažujte za uzavřený z pohledu rizika**.

---

## 2. Konsensus — tx-hash v2 + F2 BLAKE3 Merkle

**Konstanty:** `V3/L1/cosmic-harmony/src/deeksha.rs`
(`TX_HASH_V2_ACTIVATION_HEIGHT`, `BODY_ROOT_V2_ACTIVATION_HEIGHT`).

**Produkční mainnet (výchozí build, bez `testnet_fork_rehearsal`):** obě jsou
**`0`** — nový řetězec od Genesis #0. Nasazení **vyžaduje prázdný / nový datadir**
(starý stav s XOR body nebo tx v1 only není kompatibilní).

**Koordinovaný „flip“ na už běžícím řetězci** dnes není cíl této linky; šlo by
o budoucí release s jednou společnou výškou pro obě konstanty.

**Lokální / docker rehearsal bez měny produkčních literálů:**

```bash
cargo build --release --manifest-path V3/Cargo.toml \
  -p zion-core -p zion-pool -p zion-cli -p zion-miner \
  --features testnet_fork_rehearsal
```

Feature zapíná sdílenou rehearsal výšku (viz komentář u `TESTNET_REHEARSAL_COORDINATED_HEIGHT`
v `deeksha.rs`). **Nikdy** nepoužívejte tuto feature na produkční release artefakty.

Skript: [`V3/scripts/hardfork-rehearsal-testnet.sh`](../../scripts/hardfork-rehearsal-testnet.sh)

---

## 3. Bridge — produkční multisig (provisioning)

Současný staging přístup je v
[`V3/L2/bridge/config/bridge-mainnet.toml`](../../L2/bridge/config/bridge-mainnet.toml).

Před reálným unlock flow dokončete v konfiguraci a na hostech:

- 5× validator klíče (`bridge-validator.key` + extra keys env).
- `threshold = 3`, `total_validators = 5`, whitelist adres.
- `ANKR_API_KEY` (premium).
- Metrika `bridge_relayer_missing_signers = 0` na testnetu před produkcí.

Relayer je fail-closed (PR #27); chybějící provisioning je **provozní**, ne kódový gap.

---

## 4. Externí bezpečnostní audit (dodavatel)

Interní dokumenty **není** ekvivalent externího auditu.

Šablona rozsahu pro RFP / SOW:
[`EXTERNAL_AUDIT_SCOPE_TEMPLATE.md`](../audits/EXTERNAL_AUDIT_SCOPE_TEMPLATE.md).

---

## 5. Git history scrub (po rotaci klíčů)

**Nejdřív bod 1**, pak jednorázový destructive rewrite všech clone URL.

Skript s přesnými cestami a varováními:
[`V3/scripts/git-filter-repo-leaked-paths.sh`](../../scripts/git-filter-repo-leaked-paths.sh).

---

## 6. Dynamická analýza / fuzz (mimo interní audit §8)

Plán priorit a fází:
[`FUZZING_AND_DYNAMIC_ANALYSIS_PLAN.md`](../audits/FUZZING_AND_DYNAMIC_ANALYSIS_PLAN.md).

---

## 7. Nový produkční server (greenfield V3)

**Aktuální primární bootstrap (P2P / konfigurace v repu):** `204.168.245.175`

Checklist při přesunu na nový host (shrnutí z [`StatusV3.md`](../../../StatusV3.md) §2 P1):

1. **Build / image:** release z `main`, **bez** `testnet_fork_rehearsal` (pokud nejsi v labu).
2. **Datadir:** smazat nebo znovu vytvořit LMDB + chain metadata cesty z dokumentace
   compose / [`V3/docs/MAINNET_DEPLOY_RUNBOOK.md`](../MAINNET_DEPLOY_RUNBOOK.md) —
   žádný import starého XOR řetězce.
3. **Síť:** na **prvním** uzlu nechat `ZION_SEED_PEERS` prázdné; na follower uzlech nastavit
   `204.168.245.175:8333` (nebo jiný koordinátor). Firewall: 8333 P2P, RPC dle compose.
4. **Pool + miner:** znovu nasměrovat na RPC nového nodu; ověřit `submit_candidate` a výplaty.
5. **Bridge (volitelně):** stejné jako §3 — klíče, `bridge-mainnet.toml` (`rpc_url` směřuje na L1),
   `ANKR_API_KEY`.
6. **Smoke:** `getChainInfo`, výška roste, `/health` + Prometheus; krátký pool share test.

**Hardfork / rehearsal (ověření gate výšky mimo produkční default):**

```bash
# Lokální build se sdílenou rehearsal výškou (viz deeksha.rs)
cargo build --release --manifest-path V3/Cargo.toml \
  -p zion-core -p zion-pool -p zion-cli -p zion-miner \
  --features testnet_fork_rehearsal

# Testy jen u crate, které feature propagují (celý workspace s --features nevolat)
cargo test --release --manifest-path V3/Cargo.toml \
  -p zion-cosmic-harmony -p zion-core -p zion-pool -p zion-miner -p zion-cli \
  --features testnet_fork_rehearsal -- --test-threads=1
```

Produkční binárky **bez** této feature už mají tx-hash v2 + BLAKE3 body root od výšky **0**
(`StatusV3.md` 2026-05-03). Skript: [`V3/scripts/hardfork-rehearsal-testnet.sh`](../../scripts/hardfork-rehearsal-testnet.sh).

Detailní kroky: [`V3/docs/CLI_DEPLOY_PLAYBOOK.md`](../CLI_DEPLOY_PLAYBOOK.md),
Docker: [`V3/docker/DOCKER.md`](../../docker/DOCKER.md).

---

## Pořadí závislostí

```text
1 (rotace) → pak bezpečně 5 (scrub)
2 (konsensus / datadir) ↔ release + čistý stav na novém řetězci
7 (nový server) ↔ závislé na 2 (správný build + prázdný datadir)
3 (bridge) ↔ nezávislé na 5, závislé na klíčích / ops
4 (externí audit) ← lze paralelně připravovat od začátku
6 (fuzz)   ← lze paralelně v engineering tracku
```
