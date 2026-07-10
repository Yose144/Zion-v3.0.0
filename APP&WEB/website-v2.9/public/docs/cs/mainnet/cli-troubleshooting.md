# ZION CLI Troubleshooting (pro laiky)

Tady je rychlý postup, když "něco nefunguje".

## 0) Univerzální první krok

```bash
zion status
zion doctor
```

Když `zion` není v PATH, rozbal archive a použij `./zion`:

```bash
./zion status
./zion doctor
```

---

## 1) `zion status` ukazuje chyby

Pokračuj tímto pořadím:

```bash
zion node status
zion pool stats
zion mine status
```

---

## 2) Na webu nejsou bloky / explorer je prázdný

To bývá nejčastěji problém node RPC.

Ověř:

```bash
zion node status
```

Když node neběží, web nemá odkud číst chain data.
Zkus:

```bash
zion node start
zion node sync
```

---

## 3) Těžba neběží nebo ukazuje 0 hashrate

Ověř:

```bash
zion mine status
zion mine bench
```

Pokud GPU nefunguje, zkus CPU backend:

```bash
zion mine start --pool stratum+tcp://62.171.141.136:8444 --wallet YOUR_ADDRESS --backend cpu
```

Pokud GPU chceš, ověř backend:

- `opencl` — Linux/Windows GPU (AMD, NVIDIA)
- `cuda` — NVIDIA GPU (Linux/Windows)
- `metal` — macOS Apple Silicon GPU

---

## 4) Wallet nefunguje / nelze odeslat

Ověř:

```bash
zion wallet balance --address YOUR_ADDRESS
```

Pokud je zůstatek 0, zkontroluj adresu v Exploreru:
https://zionterranova.com/exorer

Pokud jsi zapomněl wallet, importuj ze souboru:

```bash
zion wallet import --file my-wallet.json
```

Pokud jsi ztratil soubor i 24 slov, **peněženku nelze obnovit**.

---

## 5) Node se nesynchronizuje

```bash
zion node peers
zion node sync
```

Pokud nemá peers, zkontroluj síťové připojení a firewall.
Node potřebuje odchozí TCP port 8444 (pool stratum) a příchozí/příchozí P2P.

---

## 6) Nemám jistotu, co řešit první

Drž se tohoto "anti-chaos" pořadí:

1. `zion status`
2. `zion doctor`
3. `zion node status`
4. `zion pool stats`
5. `zion mine status`

Nespouštěj hned restart všeho. Nejprve diagnostika, pak zásah.

---

## 7) Binary se nedá spustit (Linux)

```bash
chmod +x zion
./zion
```

Pokud dostaneš "command not found", jsi ve špatné složce.
Použij plnou cestu:

```bash
/home/user/zion/zion status
```

---

## 8) Binary se nedá spustit (Windows)

Otevři PowerShell v složce s `zion.exe`:

```powershell
.\zion.exe
```

Pokud Windows blokuje spuštění (SmartScreen), klikni "More info" → "Run anyway".

---

## 9) macOS: "cannot be opened because the developer cannot be verified"

Otevřít přes pravý klik → Open, nebo:

```bash
xattr -d com.apple.quarantine zion
./zion
```
