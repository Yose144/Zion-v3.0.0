# ZION CLI Quickstart (10 minut pro nováčky)

Toto je nejkratší cesta, jak si osahat ZION CLI bez chaosu.

## Cíl

Do 10 minut:

1. ověříš, že CLI běží,
2. uvidíš stav sítě,
3. vytvoříš peněženku,
4. začneš těžit.

---

## Krok 1: Stáhni binary z GitHub Releases

Jeden `zion` binary pro všechny platformy:

- **Linux x86_64** — `zion-cli-linux-x86_64.tar.gz`
- **macOS Apple Silicon (M1–M4)** — `zion-cli-macos-aarch64.tar.gz`
- **macOS Intel** — `zion-cli-macos-x86_64.tar.gz`
- **Windows x86_64** — `zion-cli-windows-x86_64.zip` (node + pool + miner embedded)

Stáhni z: https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta

---

## Krok 2: Rozbal a spusť

### Linux / macOS

```bash
tar xzf zion-cli-linux-x86_64.tar.gz
chmod +x zion
./zion
```

### Windows

Rozbal `zion-cli-windows-x86_64.zip` a dvakrát klikni na `zion.exe`,
nebo spusť v PowerShellu:

```powershell
.\zion.exe
```

---

## Krok 3: Interaktivní menu

Spuštění `zion` bez argumentů otevře interaktivní menu:

- šipky ↑↓ = pohyb,
- Enter = potvrzení,
- Esc = zpět.

Menu tě provede krok za krokem: wallet → node → pool → miner.

---

## Krok 4: Vytvoř peněženku

```bash
zion wallet new --mnemonic --out my-wallet.json --print
```

Dostaneš 24 slov (BIP39 mnemotechnika). **Zapiš si je na papír!**
To je tvoje záloha — bez ní nelze peněženku obnovit.

---

## Krok 5: Spusť těžbu

```bash
zion mine start --pool stratum+tcp://pool.zionterranova.com:8444 --wallet YOUR_ADDRESS
```

Sleduj hashrate a accepted shares v konzoli.

---

## Krok 6: Zkontroluj zůstatek

```bash
zion wallet balance --address YOUR_ADDRESS
```

Nebo navštiv Explorer na https://zionterranova.com/explorer

---

## Co dál

1. [ZION CLI Guide](cli-guide.md) — kompletní průvodce
2. [ZION CLI Reference](cli-reference.md) — všechny příkazy
3. [ZION CLI Troubleshooting](cli-troubleshooting.md) — řešení problémů
4. [ZION CLI FAQ](cli-faq.md) — časté otázky
