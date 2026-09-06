# ZION TerraNova — Genesis Key Ceremony Runbook (v2.9.7)

> **Tento dokument je závazný postup** pro vytvoření a ověření genesis bloku.  
> Všechny kroky se provádějí **OFFLINE** na air-gapped stroji kromě explicitně
> označených online kroků.  
> Datum ceremonie: bude vyhlášeno ≥ 48h předem.

---

## Přehled ceremony

```
OFFLINE machine
│
├─ 1. Příprava  ── ověření kódu, build release binárky
│
├─ 2. Klíče  ──── vygenerování premine keypairů (ed25519 / bech32)
│
├─ 3. Genesis  ── sestavení genesis.json, výpočet hash
│
├─ 4. Ověření  ── nezávislé ověření adres vs. PREMINE_ADDRESSES_PUBLIC.txt
│
└─ 5. Publikace ─ (ONLINE) nahrání genesis.json + hash do repozitáře

```

---

## Prerekvizity

### Hardware
- **Dedikovaný offline stroj** (nikdy nepřipojen k internetu po dobu ceremony)
- USB flash (pro přenos binárky a genesis.json — pouze jednosměrně ven)
- Hardware RNG pro seed (doporučeno: jeden mincový hod per bit není nutný,
  postačí `/dev/urandom` na offline stroji)

### Software (předpřipravit a ověřit hash PŘED odpojením od internetu)
- Rust toolchain `stable` ≥ 1.75
- `cargo build --release -p zion-core` — binárka zkompilovaná z verze `v2.9.7-freeze`
- `sha256sum` / `b2sum`

### Dokumenty k dispozici
- `PREMINE_ADDRESSES_PUBLIC.txt` — seznam výsledných adres
- `docs/mainnet/MAINNET_CONSTITUTION.md` — immutable parameters
- `L1/core/src/blockchain/premine.rs` — source of truth pro sumy

---

## Krok 1 — Příprava offline stroje

```bash
# Ověřit commit hash repozitáře
git rev-parse HEAD
# Očekáváno: taggováno jako v2.9.7-freeze, hash zaznamenaný níže:
# EXPECTED_COMMIT: <doplnit při tagging>

# Build release binárky
cargo build --release -p zion-core
sha256sum target/release/zion-core
# Zaznamenat hash:_______________________________________________
```

---

## Krok 2 — Generování a ověření premine keypairů

Premine adresy jsou **již finalizovány** v `PREMINE_ADDRESSES_PUBLIC.txt`.  
Klíče k těmto adresám jsou v custody zakladatele projektu.

V rámci ceremony se provádí pouze **ověření**, nikoliv nové generování:

```bash
# Ověřit formát všech adres v premine.rs
cargo test -p zion-core blockchain::premine:: --release
# PASS expected: test_all_premine_addresses_valid_format
# PASS expected: test_no_duplicate_premine_addresses
# PASS expected: test_premine_total

# Zkontrolovat shodu s PREMINE_ADDRESSES_PUBLIC.txt
grep -o "zion1[a-z0-9]*" L1/core/src/blockchain/premine.rs | sort > /tmp/code_addrs.txt
grep -o "zion1[a-z0-9]*" PREMINE_ADDRESSES_PUBLIC.txt | sort > /tmp/public_addrs.txt
diff /tmp/code_addrs.txt /tmp/public_addrs.txt
# PASS: prázdný výstup (žádný rozdíl)
```

| Premine kategorie | Počet adres | Celkem ZION | Unlock |
|-------------------|-------------|-------------|--------|
| OASIS Golden Egg | 5 | 8,250,000,000 | okamžitě (OASIS DAO) |
| DAO Treasury | 3 | 4,000,000,000 | blok 525,600 (~1 rok) |
| Infrastructure | 3 | 2,590,000,000 | okamžitě |
| Humanitarian | 1 | 1,440,000,000 | okamžitě |
| **Celkem** | **12** | **16,780,000,000** | |

---

## Krok 3 — Sestavení genesis.json

Genesis blok je blok výšky **0** se speciální strukturou:

```json
{
  "version": 1,
  "height": 0,
  "prev_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "timestamp": <unix_epoch_sekund — UTC, nastavit na vyhlášené datum>,
  "difficulty": 1,
  "nonce": 0,
  "algorithm": "cosmic_harmony",
  "merkle_root": "<vypočítat z premine transakcí>",
  "transactions": [
    {
      "id": "0000000000000000000000000000000000000000000000000000000000000000",
      "version": 1,
      "inputs": [],
      "outputs": [
        <12 premine výstupů dle premine.rs — přesné sumy v atomic units>
      ],
      "fee": 0,
      "timestamp": <shodný s blokem>
    }
  ],
  "genesis_message": "<obsah docs/2.9.7/GENESIS_MESSAGE.txt — UTF-8, max 256 B>"
}
```

> **`genesis_message`** je uložen v coinbase transakci jako `memo` pole prvního
> výstupu nebo jako extra pole v genesis transakci. Přesný formát dle implementace
> v `state/mod.rs`.

### Výpočet hash genesis bloku

```bash
# Spustit node s --genesis-only přepínačem (nevysílá, pouze generuje)
./target/release/zion-core --genesis-only --config config/mainnet.toml \
  --genesis-file genesis.json 2>&1 | tee /tmp/genesis_output.txt

# Zaznamenat hash
GENESIS_HASH=$(grep "Genesis block:" /tmp/genesis_output.txt | awk '{print $NF}')
echo "GENESIS_HASH: $GENESIS_HASH"
```

---

## Krok 4 — Nezávislé ověření

Oba přítomní účastníci ceremony provedou ověření nezávisle:

### Ověření 1 — Sumy
```bash
python3 -c "
addrs = [
  ('OASIS slot 1-5', 1_650_000_000_000_000 * 5),
  ('DAO main+grants+bootstrap', 2_500_000_000_000_000 + 1_000_000_000_000_000 + 500_000_000_000_000),
  ('Infra dev+nodes+audit', 1_000_000_000_000_000 + 1_000_000_000_000_000 + 590_000_000_000_000),
  ('Humanitarian', 1_440_000_000_000_000),
]
total = sum(v for _, v in addrs)
assert total == 16_780_000_000_000_000, f'FAIL: {total}'
print(f'OK: {total:,} atomic = {total//1_000_000:,} ZION')
"
```

### Ověření 2 — Genesis hash reprodukce
Druhý účastník spustí identický příkaz a porovná `GENESIS_HASH`.  
Oba hasy MUSÍ být byte-for-byte identické.

### Ověření 3 — Premine adresy
```bash
sha256sum PREMINE_ADDRESSES_PUBLIC.txt
# Zaznamenat: ___________________________________________________
```

---

## Krok 5 — Publikace (ONLINE)

Po ověření offline:

1. Přenést na USB (jednosměrně):
   - `genesis.json`
   - `genesis_hash.txt` (hash + datum + podpisy účastníků)

2. Na online stroji:
```bash
# Umístit genesis.json do repo
cp genesis.json /path/to/repo/Genesis/genesis.json
cp genesis_hash.txt /path/to/repo/Genesis/genesis_hash.txt

# Commit + tag
git add Genesis/genesis.json Genesis/genesis_hash.txt
git commit -m "genesis: add mainnet genesis block (ceremonially verified)"
git tag -s v2.9.7-genesis -m "ZION MainNet Genesis Block — $(date -u +%Y-%m-%d)"
git push origin main --tags
```

3. Publikovat `genesis_hash.txt` na veřejném kanálu (Twitter/Telegram/Discord)
   jako **public commitment** před spuštěním sítě.

---

## Záznam ceremony

| Položka | Hodnota |
|---------|---------|
| Datum ceremony | |
| Místo (offline stroj) | |
| Účastník 1 | |
| Účastník 2 | |
| Commit hash kódu | |
| Genesis timestamp (UTC) | |
| Genesis hash | |
| SHA256 genesis.json | |
| SHA256 PREMINE_ADDRESSES_PUBLIC.txt | |

---

## Bezpečnostní poznámky

- Po ceremony **bezpečně smazat** soukromé klíče z offline stroje (pokud byly
  generovány nové — v případě v2.9.7 klíče existují, pouze se ověřují)
- `genesis.json` je **veřejný dokument** — neobsahuje žádná privátní data
- DAO Treasury klíče jsou v multi-sig custody — nikdy na jednom místě
- Pokud je při ověření nalezen rozdíl v hash: ceremony PŘERUŠIT, zjistit příčinu

---

## Custody Runbook — Premine Key Security (H-02e)

> Tento oddíl adresuje audit gate **H-02e**: air-gapped machine + dual backup.

### A. Air-gapped machine (povinné)

1. **Dedikovaný offline stroj** — nikdy nepřipojen k internetu po vygenerování klíčů
2. Před ceremonií: stáhnout repo + rust toolchain na USB na jiném stroji, ověřit SHA-256
3. Přenést USB na offline stroj → kompilace → generování klíčů → ověření
4. Po ceremonii: `shred -u` privátní klíče na offline stroji (pokud se neuchovávají záměrně)

### B. Dual backup (povinné — minimálně 2 kopie na 2 nezávislých médiích)

| Záloha | Médium | Umístění | Šifrování |
|--------|--------|----------|-----------|
| Backup 1 | Hardware wallet (Ledger/Trezor) nebo zašifrovaný USB | Fyzicky u zakladatele | AES-256 passphrase |
| Backup 2 | Papírová záloha BIP39 mnemonic | Bezpečnostní schránka (bankovní sejf nebo ekvivalent) | N/A — fyzická bezpečnost |
| (Doporučeno) Backup 3 | Shamir Secret Sharing split | Dvě důvěryhodné osoby / Geografia oddělení | — |

### C. Postup zálohy

```bash
# Na OFFLINE stroji — po vygenerování klíčů:
# 1. Vypsat BIP39 mnemonic na papír (ručně — nepoužívat printer)
# 2. Ověřit mnemonic → adresa odpovídá PREMINE_ADDRESSES_PUBLIC.txt
# 3. Zašifrovat JSON backup:
gpg --symmetric --cipher-algo AES256 PREMINE_WALLETS_BACKUP.json
# Výsledný .gpg soubor přenést na USB Backup 1

# 4. Smazat plaintext backup:
shred -u PREMINE_WALLETS_BACKUP.json
```

### D. Ověření custody (před ceremonií)

- [ ] Backup 1 přístupný a dešifrovatelný (test decrypt na offline stroji)
- [ ] Backup 2 fyzicky zajištěn (osobní potvrzení zakladatele)
- [ ] DAO Treasury adresy: multi-sig — min 2 ze 3 podpisů (pokud implementováno)
- [ ] Záznamy do tabulky "Záznam ceremony" výše

### E. Obnovení (emergency recovery)

Pokud je jeden backup ztracen:
1. Okamžitě informovat Core Dev team
2. Použít zbývající backup k přesunutí fondů na nové adresy
3. Zveřejnit migrace on-chain s podpisem (transparency)

---

*Runbook udržován v `docs/2.9.7/GENESIS_CEREMONY.md` · verze 1.1 · 2026-03-05*
