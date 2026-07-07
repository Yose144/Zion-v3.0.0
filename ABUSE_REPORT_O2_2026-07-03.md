# Abuse Report — O2 Czech Republic

**To:** abuse@o2.cz
**Date:** 2026-07-03
**Subject:** Abuse report — IP 109.81.30.165 — unauthorized access to computer systems (§211, §230 TZ ČR)

---

Vážená paní / Vážený pane,

oznamujeme zneužití IP adresy **109.81.30.165** (hostname: `109-81-30-165.rct.o2.cz`, AS5610, O2 Czech Republic) pro neoprávněný přístup k našim serverům a odcizení citlivých dat. Žádáme o zablokování této IP adresy a poskytnutí zákaznických údajů příslušným orgánům činným v trestním řízení.

## 1. Identifikace IP adresy

| Pole | Hodnota |
|------|---------|
| IP | 109.81.30.165 |
| Hostname | 109-81-30-165.rct.o2.cz |
| ASN | AS5610 |
| ISP | O2 Czech Republic, a.s. |
| Geolokace | Fulnek, Moravskoslezský kraj, 742 45 |
| Typ | Residential (domácí internet) |

## 2. Popis útoku

IP adresa **109.81.30.165** byla použita k:

1. **Neoprávněnému SSH přístupu na náš server** (Hetzner Cloud, IP 77.42.71.94) pomocí odcizeného SSH privátního klíče
2. **Odeslání padělaných transakcí** na náš blockchain uzel přes RPC rozhraní
3. **Odcizení citlivých kryptografických klíčů** ze serveru
4. **Procházení našeho webu** zionterranova.com z této IP adresy

## 3. Časová osa útoku

| Čas (UTC) | Akce |
|-----------|------|
| 2026-07-01 18:28:52 | První SSH přihlášení na server jako root |
| 2026-07-01 18:28–18:35 | 20+ SSH relací (krátké, 1-2s — pravděpodobně automatizované SCP) |
| 2026-07-02 04:46:48 | Procházení zionterranova.com z IP 109.81.30.165 |
| 2026-07-02 14:08:53 | Přístup k souboru `/root/.ssh/github_deploy` (odcizení GitHub deploy klíče) |
| 2026-07-02 22:00:51 | Odeslání padělaných blockchain transakcí přes RPC |
| 2026-07-02 22:25:21 | Další vlna SSH přihlášení (20+ relací) |
| 2026-07-02 23:13:17 | Poslední zaznamenaná SSH relace z této IP |

**Celková doba útoku:** ~29 hodin (July 1 18:28 — July 2 23:13 UTC)

## 4. Důkazy

### 4.1 SSH auth log (server 77.42.71.94)

```
2026-07-01T18:28:52 MainnetEdge sshd[403431]: Accepted publickey for root from 109.81.30.165 port 51456 ssh2: ED25519 SHA256:lllhVJG1qQGWXSi3EPGgoDmCGzjuFRkDXZpYMYkrOhQ
2026-07-01T18:28:54 MainnetEdge sshd[403561]: Disconnected from user root 109.81.30.165 port 51456
... (20+ další relace)
2026-07-02T22:26:12 MainnetEdge sshd[1221366]: Accepted publickey for root from 109.81.30.165 port 64732 ssh2: ED25519 SHA256:lllhVJG1qQGWXSi3EPGgoDmCGzjuFRkDXZpYMYkrOhQ
... (20+ další relace)
2026-07-02T23:13:17 MainnetEdge sshd[1239564]: Accepted publickey for root from 109.81.30.165 port 64575 ssh2: ED25519 SHA256:lllhVJG1qQGWXSi3EPGgoDmCGzjuFRkDXZpYMYkrOhQ
```

**SSH klíč fingerprint:** `SHA256:lllhVJG1qQGWXSi3EPGgoDmCGzjuFRkDXZpYMYkrOhQ`

### 4.2 HTTP access log (zionterranova.com)

```
2026-07-02 04:46:48 MainnetEdge caddy: remote_ip=109.81.30.165
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36
  Accept-Language: cs-CZ,cs;q=0.9,en;q=0.8
  Host: zionterranova.com
  URI: /api/bridge/status, /api/health, /api/defi/price, /api/blockchain/stats
```

**User-Agent:** Windows 10/11, Chrome 149
**Accept-Language:** cs-CZ (čeština jako primární jazyk)

### 4.3 Padělané blockchain transakce

```
2026-07-02T22:00:51 MainnetEdge zion-node: rpc_in method=submitAccountTransaction
  from: zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604 (pool wallet)
  to: zion1w523a76830x2t5m7f3j023w265e8g5c400a4790 (default miner)
  amount: 4,655,737,504 ZION
  public_key: 93a7a70d8203bed584ca213419049aa5854667e1d3b0301fc40a0e7df16b76bc
```

Útočník se pokusil odeslat transakce z pool walletu pomocí odcizeného privátního klíče.

### 4.4 TeamViewer remote access

Útočník získal SSH klíč prostřednictvím **TeamViewer remote access** na vývojářský počítač:

| TeamViewer ID | Spojení | Typ |
|---------------|---------|-----|
| 708168736 | 4x (June 16-23, 2026) | RemoteControl |

Toto TeamViewer ID se připojovalo z IP adresy útočníka.

## 5. Požadavek

Žádáme O2 Czech Republic o:

1. **Zablokování IP adresy 109.81.30.165** pro další zneužití
2. **Uchování zákaznických údajů** (jméno, adresa, smlouva) pro trestní řízení
3. **Poskytnutí údajů** Policii ČR — NCOZ (Národní centrum pro kybernetickou kriminalitu) na základě oficiální žádosti

## 6. Kontakt

**Poškozený:** Yosef Hubálek
**Email:** yosef.hubalek@gmail.com
**Server:** zionterranova.com (Hetzner Cloud, 77.42.71.94)
**Trestní oznámení:** Bude podáno u NCOZ Policie ČR

## 7. Přílohy

- `auth.log` — kompletní SSH auth log z serveru (109.81.30.165)
- `caddy.log` — HTTP access log z serveru (109.81.30.165)
- `zion-node.log` — RPC audit log (padělané transakce)
- `TeamViewer_connections.txt` — TeamViewer connection log

---

S pozdravem,

Yosef Hubálek
yosef.hubalek@gmail.com
