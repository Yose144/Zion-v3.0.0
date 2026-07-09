# F4.5 — Genesis Key Rotation Checklist (Air-Gapped Owner Action)

> **CRITICAL:** Tento dokument popisuje proceduru která **musí** být provedena na **air-gapped** stroji.
> Žádné private klíče se nesmí dotknout internetu.
>
> **Status:** ⏳ PENDING — vyžaduje fyzickou akci ownera
> **Priorita:** HIGH — blokuje DEPLOY-5/6/7 E2E memo testy AND open-source publication

---

## Problém

Aktuální `genesis.rs` obsahuje hardcoded kanonické wallet adresy (humanitarian, issobella, pool fee, DAO treasury, bridge vault). Tyto adresy byly odvozeny z **label-derived** seed frází, což znamená:

1. **Veřejné klíče** těchto adres jsou známy (v genesis bloku)
2. **Seed fráze** byly generovány deterministicky z labelů — pokud někdo zná algoritmus, může odvodit private klíče
3. **Coinbase rewards** (836K+ ZION) jdou na hardcoded adresu bez dostupného SK

Toto je **bezpečnostní riziko** — útočník který odvodí seed frázi může utratit treasury prostředky.

## Řešení

Vygenerovat **nové** BIP-39 mnemonics na air-gapped stroji, odvodit nové adresy, a aktualizovat `genesis.rs`.

---

## Air-Gapped Procedura

### Příprava

- [ ] Air-gapped stroj (Raspberry Pi / laptop bez WiFi/Bluetooth, čistá OS instalace)
- [ ] USB flash drive (pouze pro přenos veřejných adres)
- [ ] Metal plate + gravírovací nástroj (pro seed phrase backup)
- [ ] Tiskárna (volitelné — pro paper backup)

### Krok 1: Generování nových klíčů (air-gapped)

- [ ] **1.1** Spusť air-gapped stroj
- [ ] **1.2** Generuj 24-word BIP-39 mnemonic pro každou kanonickou wallet:
  - Humanitarian wallet (5% tithe)
  - Issobella wallet (5% tithe)
  - Pool fee wallet (1% burn) — nebo potvrd burn model (no pool fee)
  - DAO treasury wallet
  - Bridge vault wallet
  - Miner/coinbase wallet (kde jdou coinbase rewards)
- [ ] **1.3** Odvoď Ed25519 keypair z každé mnemonic
- [ ] **1.4** Získej veřejnou adresu (`zion1...`) pro každý keypair
- [ ] **1.5** Vygeneruj 5 DAO guardian keypairs (s mnemonics)
- [ ] **1.6** Vygeneruj 5 bridge validator keypairs (s mnemonics)

### Krok 2: Backup (air-gapped)

- [ ] **2.1** Zapiš každou 24-word mnemonic na **metal plate** (ne jen paper)
- [ ] **2.2** Zapiš každý private key hex na samostatný paper
- [ ] **2.3** Vytvoř `PUBLIC_ADDRESSES.txt` s veřejnými adresami (bez private keys)
- [ ] **2.4** Zkopíruj `PUBLIC_ADDRESSES.txt` na USB flash drive
- [ ] **2.5** Ulož metal plates na **2 různá fyzická bezpečná místa** (geografická redundance)

### Krok 3: Přenos veřejných adres (offline → online)

- [ ] **3.1** Vlož USB flash drive do online stroje
- [ ] **3.2** Zkopíruj `PUBLIC_ADDRESSES.txt`
- [ ] **3.3** **Zkontroluj** že soubor obsahuje POUZE veřejné adresy (žádné private keys, žádné mnemonics)

### Krok 4: Aktualizace genesis.rs

- [ ] **4.1** Nahraď hardcoded adresy v `V3/L1/core/src/genesis.rs` novými veřejnými adresami
- [ ] **4.2** Aktualizuj `V3/L1/core/src/fee.rs` (DAO_ADDRESS, BRIDGE_VAULT_ADDRESS)
- [ ] **4.3** Aktualizuj `V3/L1/core/src/crypto.rs` (BRIDGE_VAULT_SEED — nový seed string)
- [ ] **4.4** Přegeneruj genesis hash
- [ ] **4.5** Aktualizuj všechny konfigy (`V3/docker/.env`, `bridge-mainnet.toml`, `dao-mainnet.toml`)
- [ ] **4.6** Aktualizuj dokumentaci (`MAINNET_CONSTANTS.md`, `3.0.4.md`)

### Krok 5: Hard reset (L1 wipe)

> ⚠️ **Toto smaže celý blockchain!** Všechny bloky, UTXO set, account balances.
> Provést POUZE pokud jsou všechny prostředky přesunuty na nové adresy.

- [ ] **5.1** Zálohovat aktuální chain state (pro případ rollback)
- [ ] **5.2** Zastavit všechny služby na serveru
- [ ] **5.3** Smazat chain state DB
- [ ] **5.4** Build nový `zion-core` s aktualizovaným `genesis.rs`
- [ ] **5.5** Spustit node — nový genesis block s novými adresami
- [ ] **5.6** Zkontrolovat genesis hash se očekávanou hodnotou
- [ ] **5.7** Restartovat všechny L2 služby (bridge, dao, atomic-swap, pool, miner)

### Krok 6: Verifikace

- [ ] **6.1** Zkontrolovat že coinbase rewards jdou na novou miner adresu
- [ ] **6.2** Zkontrolovat fee split (89/5/5/1) na nových adresách
- [ ] **6.3** Odeslat test TX z funded adresy s dostupným SK → potvrzení DEPLOY-5/6/7
- [ ] **6.4** Zkontrolovat bridge vault balance
- [ ] **6.5** Zkontrolovat DAO guardian voting

### Krok 7: EVM revocation (pokud needed)

- [ ] **7.1** Revoke staré bridge validator keys na EVM kontraktech
- [ ] **7.2** Set nové bridge validator keys (5/5 threshold)
- [ ] **7.3** Revoke staré DAO guardian keys
- [ ] **7.4** Set nové DAO guardian keys

---

## Po dokončení

- [ ] Aktualizovat `genesis.rs` v public repu (jen veřejné adresy)
- [ ] Aktualizovat `MAINNET_CONSTANTS.md` s novými adresami
- [ ] Aktualizovat `3.0.4.md` §8 kanonické konstanty
- [ ] Commit + push
- [ ] Spustit `build-public-repo.sh` pro fresh public repo
- [ ] Push public repo na GitHub

---

## Bezpečnostní pravidla

1. **Žádné private klíče na internetu** — vše air-gapped
2. **Metal plate > paper** — odolnost proti oheň/voda
3. **2 lokace** — geografická redundance pro backup
4. **Žádné mnemonics v souboru** — jen veřejné adresy na USB
5. **Verifikace** — zkontrolovat že USB neobsahuje private data před přenosem
6. **Wipe air-gapped stroje** po dokončení (nebo fyzické zničení)

---

## Reference

- [`docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`](./GENESIS_HARD_RESET_CANONICAL.md) — kanonický postup hard reset
- [`docs/security/SECURITY_DISCLOSURE_2026-07.md`](../security/SECURITY_DISCLOSURE_2026-07.md) — F4.5 disclosure
- [`GENESIS_REGENERATION_RUNBOOK.md`](../../GENESIS_REGENERATION_RUNBOOK.md) — starší runbook (nahrazen canonical)
