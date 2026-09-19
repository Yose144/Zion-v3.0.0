# BTCunlock

Recovery toolkit pro **vlastní** ztracené/nedostupné BTC walletů.

> **Právní hranice:** nástroj je určený výhradně pro recovery walletů, které
> vlastníš (zapomenutá passphrase, chybně opsaná seed slova, neznámá
> derivation path). Nikdy ho nepoužívej na cizí seeds/klíče.

## Co umí

| Příkaz | Use case |
|---|---|
| `fix-mnemonic` | Chybí ti 1–2 slova z BIP39 phrase — `?` placeholder se doplní z wordlistu, projdou jen checksum-validní kandidáti |
| `scan` | Máš seed, ale nevíš jakou derivation path / script type wallet používal — projede BIP44/49/84 × account × receive/change × index a zkontroluje balance přes esplora |
| `wif` | Decoduje WIF privátní klíč → síť, pubkey, P2PKH + P2WPKH adresy |

## Build

```bash
cd BTCunlock
cargo build --release
./target/release/btcunlock --help
```

## Použití

### Mnemonic s chybějícím slovem

```bash
# 1 neznámé slovo (2048 kandidátů, ~sekundy)
btcunlock fix-mnemonic "track wool dawn filter recipe attack install mutual heavy flash ? truck illness strategy add morning pull clay afraid palace plunge vanish stove gasp"

# 2 neznámá slova (~4.2M kombinací, minuty)
btcunlock fix-mnemonic "track wool ? filter recipe attack install mutual heavy flash ankle truck illness strategy add morning pull clay afraid palace ? stove gasp" --derive
```

`--derive` u každého validního kandidátu rovnou ukáže první BIP84 adresu
(`m/84'/0'/0'/0/0`) — poznáš správnou phrase podle známé adresy.

### Path scan (seed je správně, adresu neznáš)

```bash
# online — kontrola balance přes mempool.space
btcunlock scan "24 slov…" --network mainnet --max-index 20

# offline — jen výpis adres (žádné API cally)
btcunlock scan "…" --offline --max-index 5

# vlastní esplora
btcunlock scan "…" --api http://localhost:3002/api
```

Scan pokrývá: `m/{44,49,84}'/{coin}'/{account}'/{0,1}/{0..max_index}`
— P2PKH, P2SH-P2WPKH, P2WPKH; accounts 0..2; receive i change chain.
Vypíše jen adresy s historií/balancem.

### WIF decode

```bash
btcunlock wif cTWXPL7qHTroFaqbPNgpKZ6QRuygT3gTDDZjFQsdqXAn8hGbPRMg
```

## Roadmap (další fáze)

- [ ] BIP39 passphrase (25. slovo) recovery — `scan --passphrase-file`
- [ ] `wallet.dat` dump + extraction (BerkeleyDB)
- [ ] Partial-key recovery (známé znaky WIF)
- [ ] Watch-only balance check přes vlastní bitcoind/esplora
- [ ] Checkpoint/resume pro dlouhé scany
- [ ] GPU mnemonic fix (3+ missing words — momentálně zamítnuto záměrně)

## Bezpečnost

- Mnemonic/WIF zůstává lokálně — jediné síťové volání je `GET /address/{addr}`
  na esplora (adresa je derivovaná, seed nikam neodchází).
- Pro citlivé recovery použij `--offline` a balance dohledej ručně.
- Soubor s recovery výstupy drž mimo git (`warp-btc-wallet.txt` pattern).
