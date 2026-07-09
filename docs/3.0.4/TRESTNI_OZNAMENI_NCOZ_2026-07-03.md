# TRESTNÍ OZNÁMENÍ

**Komu:** Policie ČR — Národní centrála proti organizovanému zločinu (NCOZ)
**Adresa:** PO BOX 41/NCOZ, 156 80 Praha 5 – Zbraslav
**Telefon:** 974 836 933
**Datová schránka:** eesyd9x
**Email:** podatelna@policie.gov.cz (předmět: pro NCOZ)
**Datum:** 2026-07-03
**Předmět:** Trestní oznámení — neoprávněný přístup k počítačovým systémům a datům (§211 TZ ČR) a narušení provozu informačního systému (§230 TZ ČR)

> **Poznámka:** Trestní oznámení lze podat i ústně do protokolu na kterémkoliv oddělení policie (ideálně SKPV v místě spáchání), nebo přes datovou schránku eesyd9x. Elektronické podání vyžaduje uznávaný elektronický podpis.

---

## I. Oznamovatel

**Jméno:** Yosef Hubálek
**Email:** yosef.hubalek@gmail.com
**Telefon:** [doplnit]
**Bydliště:** [doplnit]
**Pozice:** Vývojář a provozovatel blockchain platformy ZION (zionterranova.com)

## II. Poškozený

**Yosef Hubálek** — provozovatel serveru zionterranova.com (Hetzner Cloud, IP 77.42.71.94)
**Projekt:** ZION V3 — blockchain platforma s vlastní kryptoměnou ZION
**Server:** Hetzner Cloud, IP 77.42.71.94, hostname MainnetEdge
**Web:** https://zionterranova.com

## III. Popsaný trestný čin

### Skutkový děj

Neznámý pachatel se v období od **1. července 2026 18:28 UTC** do **2. července 2026 23:13 UTC** neoprávněně připojil k serveru poškozeného (IP 77.42.71.94) pomocí odcizeného SSH privátního klíče, čímž spáchal trestný čin neoprávněného přístupu k počítačovým informacím a systému podle §211 odst. 1, 2 písm. b) trestního zákoníku (zákon č. 40/2009 Sb.).

Pachatel následně:
1. Odcizil citlivé kryptografické klíče ze serveru (včetně GitHub deploy klíče a privátních klíčů kryptoměnových peněženek)
2. Odeslal padělané transakce na blockchain uzel poškozeného, čímž se pokusil o neoprávněný převod kryptoměny v hodnotě převyšující 4,6 miliardy ZION
3. Narušil provoz informačního systému poškozeného

### Právní kvalifikace

- **§211 odst. 1, 2 písm. b) TZ ČR** — Neoprávněný přístup k počítačovým informacím a systémům (trestný čin)
- **§230 odst. 1, 2 TZ ČR** — Narušení provozu informačního systému a počítačové sítě
- **§209 TZ ČR** — Poškození cizí věci (modifikace zion-node binárky)
- **§248 TZ ČR** — Podvod (pokus o neoprávněný převod kryptoměny)

## IV. Identifikace pachatele

### IP adresa

| Pole | Hodnota |
|------|---------|
| **IP** | **109.81.30.165** |
| Hostname | 109-81-30-165.rct.o2.cz |
| ASN | AS5610 |
| ISP | **O2 Czech Republic, a.s.** |
| Geolokace | **Fulnek, Moravskoslezský kraj, PSČ 742 45** |
| Souřadnice | 49.7124, 17.9032 |
| Typ připojení | **Residential** (domácí internet) |

IP adresa je přiřazena O2 Czech Republic jako poskytovateli domácího internetu. O2 má zákaznické údaje (jméno, adresa, smlouva) pro tuto IP adresu.

### TeamViewer ID

Pachatel získal SSH klíč prostřednictvím **TeamViewer remote access** na vývojářský počítač poškozeného:

| TeamViewer ID | Spojení | Datum |
|---------------|---------|-------|
| **708168736** | 4x RemoteControl | 16.-23. června 2026 |

TeamViewer má záznamy o tomto ID (IP, device name, případně account email).

### Technická identifikace

| Identifikátor | Hodnota |
|---------------|---------|
| SSH klíč fingerprint | `SHA256:lllhVJG1qQGWXSi3EPGgoDmCGzjuFRkDXZpYMYkrOhQ` |
| User-Agent | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36` |
| Accept-Language | `cs-CZ,cs;q=0.9,en;q=0.8` (čeština jako primární jazyk) |
| OS | Windows 10/11 |
| Prohlížeč | Google Chrome 149 |

## V. Časová osa útoku

| Čas (UTC) | Akce | Důkaz |
|-----------|------|-------|
| 2026-06-16 08:00 | První TeamViewer připojení ID 708168736 | TeamViewer log |
| 2026-06-16–23 | 4x TeamViewer RemoteControl na W11 PC | TeamViewer log |
| 2026-06-16–23 | Zcizení SSH privátního klíče z W11 PC | (odvozeno) |
| **2026-07-01 18:28:52** | **První SSH přihlášení na server jako root** | auth.log |
| 2026-07-01 18:28–18:35 | 20+ SSH relací (krátké, 1-2s — automatizované SCP) | auth.log |
| 2026-07-02 04:46:48 | Procházení zionterranova.com z IP 109.81.30.165 | caddy.log |
| 2026-07-02 14:08:53 | Přístup k `/root/.ssh/github_deploy` (odcizení klíče) | atime |
| **2026-07-02 22:00:51** | **Odeslání padělaných transakcí přes RPC** | zion-node.log |
| 2026-07-02 22:00–22:07 | 10+ padělaných transakcí z pool walletu | zion-node.log |
| **2026-07-02 22:25:21** | **Druhá vlna SSH přihlášení (20+ relací)** | auth.log |
| 2026-07-02 22:25–23:13 | 20+ SSH relací | auth.log |
| 2026-07-02 23:13:17 | Poslední zaznamenaná SSH relace | auth.log |

**Celková doba útoku:** ~29 hodin

## VI. Škoda

### Přímá škoda

1. **Odcizené kryptografické klíče:**
   - SSH privátní klíč k serveru (kompromitován)
   - GitHub deploy klíč (odcizen — atime 2026-07-02 14:08:53)
   - Pool payout privátní klíč (kompromitován — útočník měl root access)
   - Atomic swap escrow klíč (kompromitován)
   - Možné další klíče na serveru

2. **Pokus o neoprávněný převod kryptoměny:**
   - 10+ padělaných transakcí z pool walletu (`zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604`)
   - Celková částka: ~4,6 miliardy ZION (tržní hodnota neexistuje — kryptoměna není veřejně obchodovaná)
   - Cílové adresy: `zion1w523a76830x2t5m7f3j023w265e8g5c400a4790`, `zion1m883u5h7t8l2q6y44670c6q5l067v4u2a3ku332`
   - Transakce byly zpracovány blockchainem (F1 exploit — viz níže)

3. **Modifikace binárního souboru:**
   - `/usr/local/bin/zion-node` byl modifikován během útoku

4. **Náklady na remediaci:**
   - Migrace na nový server (nová IP, nové OS)
   - Kompletní rotace všech kryptografických klíčů (air-gapped operace)
   - Náklady na forenzní analýzu a audit

### Nepřímá škoda

- Kompromitace důvěry v platformu
- Náklady na obnovu provozu
- Ztráta vývojářského času

## VII. Důkazy

### Důkazní materiály k dispozici

1. **`/var/log/auth.log`** — SSH auth log z serveru 77.42.71.94
   - 40+ SSH relací z IP 109.81.30.165
   - SSH klíč fingerprint: `SHA256:lllhVJG1qQGWXSi3EPGgoDmCGzjuFRkDXZpYMYkrOhQ`

2. **Caddy HTTP log** — access log z serveru
   - HTTP požadavky z IP 109.81.30.165 na zionterranova.com
   - User-Agent: Chrome 149, Windows 10/11, cs-CZ

3. **ZION node RPC audit log** — log padělaných transakcí
   - 10+ `submitAccountTransaction` volání z localhost (přes SSH tunnel)
   - Veškeré transakce podepsány odcizeným klíčem (public_key: `93a7a70d8203bed584ca213419049aa5854667e1d3b0301fc40a0e7df16b76bc`)

4. **TeamViewer `Connections_incoming.txt`** — log vzdálených připojení
   - Cesta: `C:\Program Files\TeamViewer\Connections_incoming.txt`
   - 4 připojení z ID 708168736 (16.-23. června 2026)

5. **`stat` výstup** — atime souborů na serveru
   - `/root/.ssh/github_deploy` — Access: 2026-07-02 14:08:53 (odcizení klíče)
   - `/usr/local/bin/zion-node` — modifikován během útoku

6. **IP geolokace** — ipinfo.io
   - `https://ipinfo.io/109.81.30.165/json`
   - Potvrzuje: Fulnek, CZ, O2 Czech Republic, residential

### Žádost o zajistení důkazů

Žádáme Policii ČR o:

1. **Zajištění zákaznických údajů** od O2 Czech Republic pro IP 109.81.30.165
   - Jméno, adresa, telefon, email zákazníka
   - Historie přidělení IP adresy
   - Smlouva o poskytování služeb

2. **Žádost o data od TeamViewer** (TeamViewer GmbH, Germany)
   - Záznamy pro TeamViewer ID 708168736
   - IP adresa, device name, account email
   - Logy spojení

3. **Zajištění logů od Hetzner Cloud**
   - Network flow logy pro IP 77.42.71.94
   - Případné další útočné IP adresy

## VIII. Svědci a spolupracovníci

- **Devin AI (Cognition Labs)** — AI asistent který pomáhal s forenzní analýzou a objevením útoku. Logy konverzace k dispozici.

## IX. Přílohy

1. `EVIDENCE/auth.log.109.81.30.165.txt` — SSH auth log (filtrováno pro 109.81.30.165)
2. `EVIDENCE/caddy.log.109.81.30.165.txt` — HTTP access log (filtrováno)
3. `EVIDENCE/zion-node.rpc.audit.txt` — RPC audit log (padělané transakce)
4. `EVIDENCE/TeamViewer.connections.txt` — TeamViewer connection log
5. `EVIDENCE/ipinfo.109.81.30.165.json` — IP geolokace
6. `EVIDENCE/forensic.timeline.txt` — kompletní časová osa
7. `ABUSE_REPORT_O2_2026-07-03.md` — abuse report pro O2 (kopie)

## X. Prohlášení

Prohlašuji, že všechny výše uvedené údaje jsou pravdivé a že jsem si vědom odpovědnosti za uvedení nepravdivých údajů v trestním oznámení podle §345 odst. 1 TZ ČR.

Žádám o prošetření věci a potrestání pachatele.

---

**Datum:** 2026-07-03
**Místo:** [doplnit]

___________________________
Yosef Hubálek
(podpis oznamovatele)

---

## Příloha: Kontakty na poskytovatele služeb

| Poskytovatel | Kontakt | Co žádat |
|--------------|---------|----------|
| **O2 Czech Republic** | abuse@o2.cz | Zákaznické údaje pro IP 109.81.30.165 |
| **TeamViewer GmbH** | support@teamviewer.com, privacy@teamviewer.com | Logy pro ID 708168736 |
| **Hetzner Cloud** | abuse@hetzner.de | Network flow logy pro 77.42.71.94 |
| **GitHub** | support@github.com | Logy přístupů (pokud útočník použil odcizený deploy klíč) |

### NCOZ kontakty

| Kanál | Hodnota |
|-------|---------|
| **Adresa** | PO BOX 41/NCOZ, 156 80 Praha 5 – Zbraslav |
| **Telefon** | 974 836 933 |
| **Datová schránka** | eesyd9x |
| **Email** | podatelna@policie.gov.cz (předmět: pro NCOZ) |
| **Web** | https://policie.gov.cz/clanek/ncoz-kontakty.aspx |

> **Důležité:** NCOZ upozorňuje, že phishing emaily s nabídkou mimosoudního vyrovnání pod hlavičkou NCOZ NEJSOU od policie. Trestní oznámení podávejte výhradně přes `podatelna@policie.gov.cz`, datovou schránku, nebo osobně.

---

## Příloha: Relevantní paragrafy TZ ČR

### §211 Neoprávněný přístup k počítačovým informacím a systémům

(1) Kdo neoprávněně vnikne do počítačového systému nebo do jeho části, bude potrestán odnětím svobody až na tři roky.

(2) Odnětím svobody šest měsíců až pět let bude pachatel potrestán, pokud spáchá čin uvedený v odstavci 1:
- a) s výhledem získání pro sebe nebo pro jiného prospěch, jehož hodnota nepřesahuje 5 000 000 Kč, nebo s výhledem způsobení jiné újmy,
- **b) jako člen organizované skupiny,**
- c) způsobením škody na cizím majetku,
- d) získáním pro sebe nebo pro jiného prospěchu, jehož hodnota nepřesahuje 5 000 000 Kč, nebo způsobením jiné újmy.

### §230 Narušení provozu informačního systému a počítačové sítě

(1) Kdo neoprávněně naruší provoz informačního systému nebo počítačové sítě, bude potrestán odnětím svobody až na tři roky.

(2) Odnětím svobody šest měsíců až pět let bude pachatel potrestán, pokud způsobí činem uvedeným v odstavci 1 větší škodu.
