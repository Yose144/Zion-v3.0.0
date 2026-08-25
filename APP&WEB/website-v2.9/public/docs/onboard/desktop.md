# ZION Public Miner — Desktop aplikace pro začátečníky

Nejjednodušší a nejrychlejší cesta, jak začít s ZION, je desktopová aplikace **ZION Public Miner**. Stáhneš ji, nainstaluješ, povolíš v systémových nastaveních a během pár minut můžeš těžit.

## Co je ZION Public Miner?

Jedná se o oficiální desktopový klient pro Windows 11 a macOS, který obsahuje:

- jednoduché GUI pro těžbu,
- integrovanou peněženku,
- připojení na veřejný pool,
- CPU a GPU (NVIDIA) těžbu,
- Bridge, DeFi a Market přímo z aplikace.

## 1. Stáhni si instalátor

Přejdi na GitHub release v3.1.0 desktop:

- `https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop`

Vyber si soubor podle svého systému:

| Systém | Soubor |
|--------|--------|
| Windows 11 (x64) | `zion-public-miner-v3.1.0-windows-x64.exe` |
| macOS (Apple Silicon M1/M2/M3) | `zion-public-miner-v3.1.0-mac-arm64.dmg` |
| macOS (Intel) | `zion-public-miner-v3.1.0-mac-x64.dmg` |

## 2. Nainstaluj a povol v nastavení

### Windows 11

1. Spusť stažený `.exe`.
2. Objeví se instalátor NSIS — postupuj podle pokynů.
3. Pokud Windows SmartScreen zobrazí varování „Neposkytovatel aplikace...“:
   - Klikni na **Více informací** (More info).
   - Poté klikni na **Přesto spustit** (Run anyway).
4. Po instalaci najdeš aplikaci v nabídce Start jako **ZION Public Miner**.

### macOS

1. Otevři stažený `.dmg`.
2. Přetáhni ikonu **ZION Public Miner** do složky **Applications**.
3. Při prvním spuštění může macOS zobrazit hlášku, že aplikace není ověřená:
   - Otevři **Nastavení systému → Soukromí a zabezpečení**.
   - Najdi zprávu o **ZION Public Miner** a klikni na **Otevřít přesto**.
   - Alternativně klikni na aplikaci pravým tlačítkem a zvol **Otevřít**.
4. Na Apple Silicon může být potřeba povolení otevření aplikací z App Store a ověřených vývojářů.

## 3. První spuštění a nastavení peněženky

Po prvním spuštění aplikace:

1. Aplikace se tě zeptá na **ZION adresu** (peněženku).
2. Pokud ještě adresu nemáš:
   - V aplikaci přejdi na záložku **Wallet**.
   - Klikni na **Create Wallet** a zaznamenáj seed na bezpečném místě.
   - Zkopíruj veřejnou adresu (`zion1...`) a vlož ji do nastavení těžby.
3. Nastav **Pool** na veřejný pool:
   ```
   pool.zionterranova.com:8444
   ```
4. Zvol **Worker Name** — libovolný název tvého zařízení, např. `muj-mac` nebo `pc-doma`.
5. Nastav počet **CPU vláken** podle počtu jader tvého procesoru.
6. Zapni **GPU**, pokud máš NVIDIA nebo Apple Silicon GPU.

## 4. Začni těžit

1. Klikni na tlačítko **Start Mining** na hlavní obrazovce.
2. Aplikace se připojí na pool a začne zobrazovat:
   - aktuální hashrate,
   - přijaté share,
   - odhadovaný výdělek.
3. Hotovo — tvůj počítač nyní těží ZION.

## 5. Ukončení a poznámky

- Aplikace běží i v systémové liště / menu baru.
- Těžba se automaticky ukládá na tvou ZION adresu podle poolových výplat.
- Pro nejlepší výkon nech počítač zapnutý a připojený k internetu.

## Alternativa: Linux

Pro Linux existuje `.AppImage` a `.deb` balíček. Postup je obdobný — stáhni, spusť a nastav adresu.
