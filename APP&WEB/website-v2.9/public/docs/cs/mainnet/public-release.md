# ZION v3-Mainnet Public Release — Jak to použít

> **Repozitář:** https://github.com/Zion-TerraNova/v3-Mainnet
> **Licence:** MIT
> **Aktuální release:** v3.0.5-beta
> **Stav:** Mainnet Beta — používejte na vlastní riziko

Tento návod vysvětluje, jak stáhnout veřejný ZION CLI, ověřit ho a začít těžit na živém mainnetu.

---

## 1. Co obsahuje veřejný repozitář?

Repozitář [`v3-Mainnet`](https://github.com/Zion-TerraNova/v3-Mainnet) je kurátorovaný open-source release ZIONu V3. Obsahuje:

- **L1 jádro** — Rust blockchain nód, konsenzus, P2P, peněženka, pool a miner.
- **L2 kontrakty** — DeFi, DAO, bridge a atomic-swap Solidity kontrakty.
- **L3 WARP** — cross-chain bridge adaptery.
- **CLI / SDK** — zjednodušená `zion` binárka a wallet SDK.
- **Dokumentaci** — whitepaper, právní disclaimery, security disclosures a runbooky.

> **Co NENÍ publikováno:** zdroják webu, dashboardu, operační server configy, private keys, mnemonics a interní runbooky. Ty zůstávají v private repozitáři.

---

## 2. Stáhněte si poslední release

1. Otevřete https://github.com/Zion-TerraNova/v3-Mainnet/releases.
2. Vyberte nejnovější **v3.0.5-beta** release.
3. Stáhněte archiv pro vaši platformu:

| Platforma | Soubor |
|-----------|--------|
| Linux x86_64 | `zion-cli-linux-x86_64.tar.gz` |
| macOS Apple Silicon | `zion-cli-macos-aarch64.tar.gz` |
| macOS Intel | `zion-cli-macos-x86_64.tar.gz` |
| Windows x86_64 | `zion-cli-windows-x86_64.zip` |

Stáhněte také `SHA256SUMS.txt` pro ověření archivu.

---

## 3. Ověřte archiv (doporučeno)

### Linux / macOS

```bash
tar -xzf zion-cli-linux-x86_64.tar.gz
sha256sum -c SHA256SUMS.txt
```

U staženého souboru byste měli vidět `OK`.

### Windows (PowerShell)

```powershell
Get-FileHash zion-cli-windows-x86_64.zip -Algorithm SHA256
```

Porovnejte vytisknutý hash s hodnotou v `SHA256SUMS.txt`.

---

## 4. První spuštění — interaktivní setup

CLI má interaktivní menu. Stačí spustit:

```bash
./zion
```

Menu vás provede:

1. **Wallet** — vytvoření nebo načtení `zion1...` adresy.
2. **Node** — synchronizace s mainnet seed nody.
3. **Pool** — volitelný lokální pool setup (většina uživatelů se připojí k veřejnému poolu).
4. **Miner** — spuštění CPU nebo GPU miningu.

---

## 5. Rychlé těžení do veřejného poolu

Pokud už máte peněženku, nejrychlejší cesta je:

```bash
./zion miner --pool stratum+tcp://62.171.141.136:8444 \
  --payout zion1VASA_ADRESA \
  --algo deeksha_lite_v1
```

Nahraďte `zion1VASA_ADRESA` vaší reálnou ZION adresou.

### GPU mining

Použijte `--backend opencl` pro AMD/NVIDIA na Linuxu/Windows, nebo `--backend metal` na Apple Silicon:

```bash
./zion miner --pool stratum+tcp://62.171.141.136:8444 \
  --payout zion1VASA_ADRESA \
  --algo deeksha_lite_fire \
  --backend opencl
```

Spusťte `./zion miner --help` pro všechny možnosti.

---

## 6. Spusťte vlastní nód

```bash
./zion node --network mainnet --data-dir ~/.zion
```

Nód se připojí k výchozím seed peers a synchronizuje od genesis. Po synchronizaci můžete těžit proti lokálnímu nódu:

```bash
./zion miner --node http://127.0.0.1:8443 --payout zion1VASA_ADRESA
```

---

## 7. Monitorujte všechno

Otevřete druhý terminál a spusťte:

```bash
./zion monitor
```

Zobrazí:

- Aktuální block height a sync status
- Hashrate minera a přijaté share
- Balance peněženky
- Zdraví služeb

---

## 8. Důležité poznámky pro Mainnet Beta

- **Těžte na vlastní riziko.** Síť je živá, ale stále v Beta. Chyby jsou možné.
- **Neinvestujte prostředky, které si nemůžete dovolit ztratit.** Není záruka, že se současný chain znovu neresetuje, i když hard reset z července 2026 byl explicitně poslední plánovaný reset a genesis je nyní deklarován jako permanentní.
- **Uchovejte seed phrase peněženky v bezpečí.** Ztracené klíče nelze obnovit.
- **Sledujte aktualizace.** Nové CLI release se objeví na stejné GitHub releases stránce.
- **Přečtěte si právní disclaimer:** [`LEGAL_DISCLAIMER.md`](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/LEGAL_DISCLAIMER.md)

---

## 9. Build ze zdroje (pokročilé)

Pokud chcete kompilovat sami:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release
```

Binárky budou v `V3/target/release/`. Potřebujete Rust ≥ 1.78 a standardní build nástroje.

---

## 10. Kde hledat pomoc

- Veřejný repozitář: https://github.com/Zion-TerraNova/v3-Mainnet
- Stav sítě: https://zionterranova.com/network
- Explorer: https://zionterranova.com/explorer
- Pool: https://zionterranova.com/pool

---

*ZION TerraNova v3-Mainnet Public Release • aktualizováno 10. 7. 2026*
