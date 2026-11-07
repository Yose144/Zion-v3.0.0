# Grafana: host panely, tiché poplachy a otevřené dveře

> **Datum:** 2026-11-07 (večer, ~21:00–21:30 CET)
> **Zadání:** navazující práce na P1 „EDGE1 monitoring" — dashboard hosty nekreslil (`v31-mainnet.json` měl jen pool joby). Cestou se ukázaly dvě další věci, které dělaly z Grafanu slepé místo.
> **Režim:** změny v monitoringu a v nginx vhostu `grafana.`. Žádný restart poolu, node, G8 služeb; žádná změna konsenzu, payoutů ani DNS.

## 1. Host panely (původní zadání)

Dashboard měl 11 panelů a **všechny se ptaly jen na pool joby**. EDGE1/EDGE2 CPU, RAM, disk, load, PSI a síť nebyly vidět, i když série existují.

Přidána sekce **„🖥 Hosts · EDGE1 / EDGE2"** (11 panelů, celkem 22):

| Panel | Dotaz |
|---|---|
| Host Up | `up{job=~"node\|edge2"}` s mapováním UP/DOWN |
| CPU busy %, RAM available %, Disk / used %, Host uptime | stat karty s prahovými barvami |
| CPU busy % | `100 - avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m]))*100` |
| Load average | `node_load1`, `node_load5` |
| RAM available % | `100 * MemAvailable / MemTotal` |
| Disk / used % | `1 - node_filesystem_avail_bytes{mountpoint="/"} / size` |
| Pressure (PSI) | `rate(node_pressure_{memory,cpu,io}_waiting_seconds_total[5m])` |
| Network throughput | `sum by(instance)(rate(node_network_{receive,transmit}_bytes_total[device!~"lo\|veth\|docker\|br-"][5m]))` |

Titulek dashboardu srovnán s lifecyclem (`V31 Mainnet Alpha` → **`V31 Mainnet Beta`**), stejně titulek hlavní řady.

**Ověřeno:** všech 15 dotazů vrací 2 série (edge1/edge2) s rozumnými hodnotami (disk 59 %, RAM 21 % / 46 %, load 4,3 / 1,4). Přes veřejnou URL s auth: dashboard `version 3`, 22 panelů, `/api/ds/query` vrací framy (`59.0`, `59.1`).

## 2. Dva alerty, které „hořely" od 20. září

Grafana má vlastní file-provisioned alerting (`/etc/grafana/provisioning/alerting/warp_btc_swap.yaml`, 3 pravidla). Dvě z nich měla `noDataState: NoData`, ale s `WARP_BTC_SWAP_ENABLED=0` série `warp_btc_swap_stale` a `warp_btc_swap_near_deadline` **neexistují** → obě pravidla byla od **2026-09-20 14:13** trvale ve stavu `DatasourceNoData` (= firing). Každých 60 s se navíc pokoušela odeslat notifikaci a selhávala na nekonfigurovaném SMTP.

Poplach, který nejde splnit, učí lidi ignorovat poplachy. Změněno:

- `warp_btc_swap_stuck` a `warp_btc_swap_near_deadline`: **`noDataState: OK`** (chybějící data = očekávaný stav při vypnutém swapu).
- `warp_btc_swap_metrics_down` zůstává `Alerting` — ten má data (`up{job="warp_btc_swap"}`) a hlídá smrt endpointu.
- Do souboru zapsán důvod i postup pro re-enable.

**Ověřeno:** aktivní alerty v Grafaně = **0**.

## 3. Doručovací cesta (a jeden crash)

Jediný contact point byl stock `email receiver` s `<example@email.com>` a `[smtp]` není nakonfigurované → každá notifikace končila chybou v journalu. Přidán provisioned contact point `zion-alertmanager` typu `prometheus-alertmanager` na `127.0.0.1:9093` a default policy na něj, takže Grafana alerty jdou **stejnou cestou jako Prometheus**: Alertmanager → G8 webhook sink (`127.0.0.1:9094/alerts` → `/opt/zion/data/g8_alert_events.jsonl`).

**Past, která stála za to:** první pokus použil `type: alertmanager` — takový notifier v tomto buildu **neexistuje**, provisioning shodí **start Grafanu** (`notifier alertmanager is not supported`) a systemd to zkouší pořád dokola = crash loop. Správný identifikátor je `prometheus-alertmanager` (ověřeno přes `/api/alert-notifiers`). Po opravě: `health=200`, `NRestarts=0`.

**Ověřeno doručení** bez zásahu do G8 evidence: test contact pointu namířený na dočasný listener na `:9099` zachytil POST `/api/v2/alerts` s platným Alertmanager payloadem (`alertname`, `labels`, `startsAt`, `generatorURL`) a Grafana vrátila `status: ok`. Alertmanager na 9093 zůstal nedotčený, takže v evidenci není falešný testovací alert.

## 4. Grafana byla otevřená do světa

`https://grafana.zionterranova.com` běželo **bez jakékoli autentizace na vhostu**, s `auth.anonymous=Viewer` a veřejně dostupným loginem. Kdokoli tedy mohl číst dashboardy, datasources a alert pravidla, a zkoušet login na admin účet. (Admin heslo v `grafana.ini` je navíc slabé — doporučuji rotaci; s Basic Auth v nginx už ale není veřejně dosažitelné.)

Nasazeno stejné schéma jako u ostatních ops povrchů (`/vast-ops/`, `zion-nginx.conf`):

- nový credential file `/etc/nginx/.htpasswd-grafana` (uživatel **`ops`**, práva 640 root:www-data, **oddělený** od `.htpasswd-vast`, aby rotace jednoho nezamkla druhé),
- `auth_basic "ZION ops"` na 443 bloku; ACME cesta zůstává na :80 bez auth,
- repo kopie `infra/nginx/edge-current/grafana.conf` srovnána.

**Ověřeno zvenčí:** bez auth **401** (`realm="ZION ops"`), s credentialem **200** (health i dashboard), `/api/v1/provisioning/alert-rules` bez auth **401**. `nginx -t` prošel; pre-existing warning o `conflicting server name "62.171.141.136"` (catch-all z `zion-edge-download.conf`) s tím nesouvisí a nechal se být.

## 5. Změny v repu

- `ZION_OS/infra/grafana/dashboards/v31-mainnet.json` — 11 nových panelů, title Beta, version 3.
- `ZION_OS/infra/grafana/provisioning/alerting/warp_btc_swap.yaml` — nově v repu, `noDataState: OK` u dvou swapových pravidel + vysvětlení.
- `ZION_OS/infra/grafana/provisioning/alerting/delivery.yaml` — nový contact point + default policy (typ `prometheus-alertmanager`).
- `infra/nginx/edge-current/grafana.conf` — Basic Auth.
- Rollback: `/root/v31-mainnet.json.bak-*`, `/root/warp_btc_swap.yaml.bak-*`, `/root/grafana.conf.bak-*`; smazání `delivery.yaml` vrátí doručování na (nefunkční) e-mail.

## 6. Co zůstává otevřené

- **Admin heslo Grafanu** je slabé a v plaintextu v `grafana.ini`; doporučuji rotaci (Basic Auth to kryje, ale defense-in-depth chybí).
- `auth.anonymous=Viewer` **uvnitř** zůstává záměrně — po Basic Auth není druhé přihlášení potřeba. Kdo chce tvrdší režim, vypne `GF_AUTH_ANONYMOUS_ENABLED` a bude se přihlašovat i do Grafanu.
- Stejný notifier (`prometheus-alertmanager`) je teď jediná cesta; **SMTP pro Grafana zůstává nenakonfigurované** a to je v pořádku, dokud všechny alerty tečou přes Alertmanager.
- G8 dashboard/`app.zionterranova.com/g8` Grafana neembeduje — Basic Auth tedy nic nerozbil.
