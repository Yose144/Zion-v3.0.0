# AGENTS.md — V31 Mainnet Alpha

> **Působnost:** Tento soubor je určený pro Devina a operátory pracující s V31 Mainnet Alpha.

Tento soubor je provozní a bezpečnostní pravidla pro pracovní prostor `V31` — čistý Mainnet Alpha track v `/Users/yeshuae/Projects/2.9.6/V31/`. V31 cutover je dokončen a produkční Edge běží na V31; historická V3 data zůstávají v `archive/V3/` a `v3_compat` pro checkpoint sync. Veškerá nová mainnet-track vývojárna patří do `V31/`. Historická topologie a incidenty jsou v kořenovém `/Users/yeshuae/Projects/2.9.6/AGENTS.md`.

Aktuální stav V31 (2026-08-07): `cargo clippy --workspace` je čisté a `cargo test --workspace` prochází (2079 testů). `zion-core` používá kanonický `EkamDeeksha` PoW (v2: 128 KiB scratchpad, 1 pass, 32 random reads, 2 AES rounds), `zion-miner` ho mapuje na kanonické `deeksha_lite`/`deeksha_chv3` OpenCL/CUDA backendy. V31 je nasazen na Edge (public RPC, pool, multichain, dashboard). Historická V3 validace zůstává v `v3_compat`. `zion-pool` má rate limiting reconnect stormu. `zion-miner` nyní běží ve triple-stream režimu (ZION + GPU/CPU AuxPoW), má `ZION_STREAM3_FORCE_COIN`, profit switching s 15% hysteresí a TUI/metriky; `cargo test -p zion-miner` 92 pass. `zion-dao` runtime načítá/persistuje návrhy a hlasy, spouští L1 scanner a vystavuje HTTP API/metriky. Fáze B i C jsou kompletní z hlediska kódu a testů; Go/No-Go na reálném GPU/rigu zůstává pending. Dashboard UI/UX je V31-first a je nasazen na Edge (`zion-edge-python-dashboard` active, `/health` OK). V31 banner KPIs a V31 Production panel (metriky, live logy, embedovaný Grafana `v31-mainnet`) jsou integrovány do full dashboardu. Pool API/metrics port opraven na 8080, Prometheus scrape a Grafana provisioning nasazeny. **V31 cutover proveden**: V3 služby (`zion-edge-node1/2`, `zion-edge-pool`, bridge, DAO, atomic-swap, DEX, WARP, OASIS, starý dashboard) zastaveny a maskovány; `zion-v31-node` osamostatněn od V3 a běží nezávisle na portu 9445. Edge registry v dashboardu (`SERVICE_REGISTRY_EDGE_PRIMARY`, `EDGE_SERVICE_ORDER`) nastavena V31-first, přidány `zion-v31-miner`, `zion-v31-dao`, `zion-v31-oasis`, Prometheus/Grafana/website/marketplace. Opraveny systemd unit mapy (z `zion-edge-miner.service` na `zion-v31-miner.service`), `_build_health_map`, `build_checklist`, `build_readiness_score` a `build_alerts` pro V31. V31 pool, multichain, DAO, OASIS a dashboard běží, `/api/services` i `/api/readiness` vrací V31 služby jako `primary` (readiness 100 %).

---

## 1. Působnost a zdroje pravdy

1. V31 je aktivní Mainnet Alpha workspace. Všechny nové funkce, refaktoringy a opravy mainnet-tracku jdou sem.
2. V3 zůstává produkční běh na Edge. Do V3 sahat jen pro kritické hotfixy.
3. Zdroje pravdy pro provoz: `/Users/yeshuae/Projects/2.9.6/StatusV3.md`, `/Users/yeshuae/Projects/2.9.6/V31/ROADMAP.md` (pokud existuje), a tento soubor.
4. Kořenový `/Users/yeshuae/Projects/2.9.6/AGENTS.md` obsahuje historickou topologii, incidenty 2026-07-19 a 2026-07-20 a detailní pokyny k `public/`. Používejte ho jako referenci; toto je zkrácená a V31-specifická verze.

---

## 2. Model síťové bezpečnosti

**Základní postoj: default-deny.** Veřejně dosažitelné musí být pouze:

- veřejný pool stratum (`62.171.141.136:8444`);
- SSH pro operátorské IP adresy;
- veřejné webové služby (dashboard, web) pouze pro operátorské IP adresy, pokud nejsou veřejným frontendem.

Vše ostatní je uzavřené za firewallem, proxované přes nginx s IP allowlistem, nebo vázané na `127.0.0.1`.

### 2.1 Obecná pravidla firewallu

- Na serveru `62.171.141.136` (Contabo, IPv6 `2a02:c207:2342:5821::1`) používej default-deny `ufw` nebo `nftables`.
- Input chain: `DROP` jako výchozí politika, pak explicitní `ALLOW` pro známé služby a zdroje.
- Nepoužívej `ACCEPT` pro RPC port `9443` z internetu — ten je lokální (`127.0.0.1:9443`) a veřejný přístup jde přes nginx na `rpc.zionterranova.com:8443` s operátorským allowlistem.
- P2P porty `8333`/`8334` jsou otevřené jen pro známé peery / bootstrap seznam. Pokud možno filtruj podle whitelisted peer IPs a používej `fail2ban` jail `zion-p2p` pro detekci port scanu / reconnect stormu.
- SSH autentizace výhradně přes klíč. Žádné root heslo. SSH běží na portech `22` a `2222`, IPv4 i IPv6. Port `22` a `2222` musí mít `AddressFamily any` a správné `ListenStream` v `systemd` drop-ins (`/etc/systemd/system/ssh.socket.d/`), aby nedošlo k IPv6-only situaci.
- `fail2ban` musí být aktivní se jménem `zion-p2p` (maxretry=50/10min, bantime=24h dle provozní zkušenosti) a s aktuálními `ignoreip`.
- nginx TCP stream pro RPC (`rpc.zionterranova.com:8443` → `127.0.0.1:9443`) musí mít allowlist nad rámec reverse proxy.
- Dashboard (`dashboard.zionterranova.com`) a web (`zionterranova.com`) jsou za nginx; používejte Basic Auth nebo IP allowlist dle služby.

---

## 3. Seznam povolených operátorů (`OPERATOR_IPS`)

Následující IP adresy jsou definovány jako `OPERATOR_IPS`. Musí být trvale uloženy v `ignoreip` v `/etc/fail2ban/jail.d/zion-p2p.conf` a v `allow` pravidlech firewallu. Jakákoliv změna vývojářského / Mac IP musí být okamžitě promítnuta do obou míst.

```bash
OPERATOR_IPS=(
  109.81.31.210
  109.81.27.87
  109.81.89.176
  109.81.83.205
  109.81.81.86
  109.81.83.81     # added 2026-08-05 during Phase D E2E / Playwright work
  2a02:c207:2342:5821::1/64
)
```

**Pravidla:**

- [ ] `ignoreip` v `/etc/fail2ban/jail.d/zion-p2p.conf` obsahuje všechny `OPERATOR_IPS`.
- [ ] `ufw` / `nftables` `allow` pravidla obsahují všechny `OPERATOR_IPS` pro SSH, RPC/dash a další operátorské služby.
- [ ] IPv6 `2a02:c207:2342:5821::1/64` pokrývá lokální síť / loopbackové rozhraní serveru a IPv6 fallback.
- [ ] Pokud se Mac IP změní, upravte `ignoreip` dříve, než spustíte lokální backup node nebo pool test.
- [ ] Nastavení fail2ban a firewallu musí přežít reboot (`systemctl enable fail2ban`, persistované pravidla).

---

## 4. Portová matice V31

| Služba | Port / Adresa | Proces | Dostupnost | Poznámka |
|---|---|---|---|---|
| SSH | `22` / `2222` | `sshd` | **operator-only** | Klíčová autentizace, žádné root heslo, IPv4 + IPv6. |
| Node P2P (V31) | `0.0.0.0:8335` | `zion-node` | **known-peers** | V31 Edge primary; legacy/backup may use `8333/8334`. fail2ban hlídá scan. |
| Node RPC (V31) | `127.0.0.1:9445` | `zion-node` | **localhost-only** | Nikdy přímo veřejný. Pouze interní L2 služby. |
| RPC přes nginx | `rpc.zionterranova.com:8443` → `127.0.0.1:9445` | `nginx` (TCP stream) | **operator-only** | TCP proxy; zakončení na V31 node RPC `9445` (ne historickém `9443`). |
| RPC alternativa | `127.0.0.1:9445` | `zion-node` | **localhost-only** | Výhradně lokální; veřejně přístupný jen přes nginx `8443`. |
| Pool stratum | `62.171.141.136:8444` | `zion-pool` | **public** | Hlavní veřejná služba pro minery. |
| Pool HTTP API / Prometheus | `0.0.0.0:8080` | `zion-pool` | **localhost-only** | `/stats`, `/metrics`, `/miners`; neexponuj bez allowlistu. |
| WARP API | `0.0.0.0:8453` | `zion-multichain` (`warpd`) | **local** | Výchozí `localhost-only`; public jen s allowlistem/nginx. |
| Dashboard | `443` → `127.0.0.1:8766` | `nginx` → dashboard | **operator-only** | Basic Auth nebo IP allowlist. |
| Web | `443` | `nginx` | **public** / **maintenance** | Případně maintenance mód, pokud je web vypnutý. |

### 4.1 Dostupnost — legendy

- **public:** Služba je dostupná z internetu bez IP restrikcí (pool stratum) nebo s veřejným DNS.
- **operator-only:** Dostupná pouze z `OPERATOR_IPS`, případně přes VPN/ssh tunnel; jinak default-deny.
- **localhost-only:** Vázána na `127.0.0.1` nebo `::1`; není dosažitelná zvenčí. Pouze interní služby / nginx upstream.
- **known-peers:** P2P porty jsou technicky otevřené, ale komunikace se řídí whitelisted peery a bootstrap seznamem; od neznámých zdrojů mohou být REJECT/DROP.

### 4.2 Nasazování nové služby

- Každá nová služba musí mít přiřazenou jednu z kategorií z tabulky.
- Default-deny: pokud není explicitně označená jako public/operator/localhost, považuj ji za zakázanou.
- Záznam o portu patří do tohoto souboru a do `StatusV3.md` (nebo `V31/STATUS.md`) při každé změně.

---

## 5. Nakládání s taji a citlivými daty

Nikdy nenahrávejte do repozitáře žádné tajné materiály.

### 5.1 Zakázané v commitech

- [ ] Mnemotechnické fráze, seed phrase nebo HD wallet klíče.
- [ ] GPG soukromé klíče nebo hesla k GPG (`/tmp/zion_gpg/` zůstává mimo repo).
- [ ] Soubory `.env`, `environment.sh`, `*.env.local` s API klíči, hesly nebo RPC secrets.
- [ ] Serverová hesla, root hesla nebo VNC hesla.
- [ ] API klíče třetích stran (Etherscan, Basescan, Infura, Alchemy, apod.).
- [ ] SSH soukromé klíče nebo obsah `~/.ssh/`.
- [ ] Konfigurace s `rpc.zionterranova.com` credentials, pokud by obsahovaly secrets.

### 5.2 Povolené umístění secrets

- Používejte `EnvironmentFile=` v systemd service files.
- Cesty pro systemd `EnvironmentFile`:
  - `/etc/zion/V31/*.env` nebo `/etc/zion/config/*.env`
  - `~/.zion/V31/*.env`
- Práva: `chmod 600` pro všechny `.env` a `*.sh` obsahující secrets.
- Vlastník: `root:root` pro system services, `zionserver:zionserver` pro user services.
- Globální konfigurace projektu:
  - `/etc/zion/config/*.toml`
  - `~/.config/devin/`
- V kódu čtěte secrets výhradně z proměnných prostředí nebo systemd `EnvironmentFile`; nikdy je nehardcodujte.

### 5.3 `.gitignore` a audit

- Ujistěte se, že `/Users/yeshuae/Projects/2.9.6/V31/.gitignore` obsahuje `.env`, `*.env`, `*.key`, `*.pem`, `*.secret`, `*.p12`, `*.gpg`, `*.asc` (soukromé klíče).
- Před každým push do `public/` subtree proveďte audit, že neunikla žádná tajná data ani interní IP adresy kromě veřejně dokumentovaného RPC/pool.

---

## 6. Pravidla zálohování

Zálohy jsou nedílnou součástí bezpečnosti. Používejte kanonické skripty a pravidelně testujte obnovu.

### 6.1 Kanonické skripty

- `/Users/yeshuae/Projects/2.9.6/ZION_OS/infra/scripts/backup-edge.sh`
- `/Users/yeshuae/Projects/2.9.6/ZION_OS/infra/scripts/sync-edge-backups.sh`

Tyto skripty jsou autoritativní. Jakýkoliv nový V31 backup skript by měl být jejich odvozeninou nebo je nahradit explicitním rozhodnutím operátora.

### 6.2 SQLite zálohy

- [ ] Pro SQLite DBs vždy používejte `sqlite3 .backup` (ne jen kopii souboru s WAL).
- [ ] `.backup` vytvoří konzistentní snapshot i při aktivním WAL.
- [ ] Zálohujte i `-wal` a `-shm` soubory pouze jako sekundární opatření, primární je `.backup` výstup.
- [ ] Po záloze spusťte `PRAGMA integrity_check` na kopii.

### 6.3 Co zálohovat pro V31

- [ ] SQLite databáze L1 uzlu (chain state, mempool index, account store).
- [ ] SQLite databáze poolu (`pplns-state.db` a test DB).
- [ ] `peers.json` a konfigurace nodu.
- [ ] Multichain HTLC SQLite persistence a WARP state.
- [ ] Environment files z `/etc/zion/` a `~/.zion/`.
- [ ] `/etc/zion/config/*.toml`, `chains.toml`, V31 `Cargo.toml` a `config/`.
- [ ] Systemd service/timers, nginx site configs, fail2ban jail.d.
- [ ] Let’s Encrypt certifikáty (`/etc/letsencrypt/live` a `archive`).

### 6.4 Off-site sync a retence

- [ ] Po lokální záloze spusťte `rsync` off-site pomocí `/Users/yeshuae/Projects/2.9.6/ZION_OS/infra/scripts/sync-edge-backups.sh`.
- [ ] Preferujte IPv6 fallback spojení (`ssh -6`) kvůli stabilitě při IPv4 banu.
- [ ] Edge retence: 14 denních + 4 týdenních; lokální retence: 30 denních + 8 týdenních.
- [ ] Zkontrolujte `tar tzf` a MD5/SHA256 kontrolní součty state souborů proti live Edge.

### 6.5 Test obnovy

- [ ] Alespoň jednou za 30 dní proveďte testovací restore na samostatný adresář / VM.
- [ ] Ověřte `PRAGMA integrity_check` na všech obnovených SQLite DB.
- [ ] Ověřte, že node startuje a dosahuje očekávané výšky bloku.
- [ ] Výsledek testu zaznamenejte do `/Users/yeshuae/Projects/2.9.6/StatusV3.md` nebo `V31/STATUS.md`.

---

## 7. Veřejný subtree `public/`

Kořenový adresář `/Users/yeshuae/Projects/2.9.6/public/` je git subtree repozitáře `github.com/Zion-TerraNova/v3-Mainnet` (MIT). Slouží pro publikování kódu, který je bezpečný pro veřejnost.

### 7.1 Pravidla pro `public/`

- [ ] Nikdy nepushujte tajnosti: žádné private keys, mnemonics, hesla, interní IP kromě veřejného `62.171.141.136:8444` a `rpc.zionterranova.com:8443`.
- [ ] Nepushujte cesty jako `/Users/yeshuae/Projects/2.9.6/` nebo osobní adresáře do `public/`.
- [ ] Nepushujte deploy konfigurace, systemd env files, nginx configs, fail2ban jails.
- [ ] Po každé změně v `V31/` kódu nebo dokumentaci, která se dotýká MIT-safe částí, proveďte subtree sync.
- [ ] Postup:
  1. Commit do `origin` (private) včetně změn v `V31/`.
  2. `git subtree push --prefix=public public main`
  3. Ověřte, že public commit obsahuje pouze MIT-safe soubory.

### 7.2 Co je MIT-safe pro V31

- Kód `V31/` (L1 core, L2 multichain, pool, miner, DAO skeleton).
- Dokumentace, whitepaper, LICENSE, README.
- `Cargo.toml` a build skripty bez secrets.
- Public contract addresses a RPC endpoint, které jsou určeny k publikování.

Co **není** MIT-safe:
- Konfigurace serveru, deploy runbooky s interními cestami, osobní IP adresy.
- Cokoliv v `ZION_OS/`, `edge-deploy/`, `scripts/` (kromě explicitně vybraných public build skriptů).

---

## 8. Bezpečnostní incidenty a ponaučení

Následující incidenty jsou shrnuty z kořenového `/Users/yeshuae/Projects/2.9.6/AGENTS.md`. Slouží jako ponaučení pro provoz V31.

### 8.1 Incident 2026-07-19 — SSH IPv6-only a fail2ban ban

**Průběh:**

- Po rebootu naslouchal `sshd` pouze na IPv6 (`[::]:2222`) kvůli chybnému `ssh.socket.d/override.conf` (`ListenStream=2222` bez explicitní IP → systemd `BindIPv6Only=ipv6-only`).
- IPv4 SSH vracel `Connection refused` a root heslo bylo ztraceno.
- Obnova probíhala přes Contabo panel reset root hesla, nalezení IPv6 `2a02:c207:2342:5821::1` přes `dig AAAA vmi3425821.contaboserver.net` a připojení `ssh -6 -p 2222 root@2a02:c207:2342:5821::1`.
- `override.conf` byl opraven na `0.0.0.0:2222` a `[::]:2222` a přidán `port22.conf` pro port `22`.
- Souběžně fail2ban jail `zion-p2p` (maxretry=50/10min, bantime=24h) zabanoval IPv4 `109.81.31.210` (Mac) kvůli rychlým P2P connect/disconnect lokálního backup nodu na porty `8333`/`8334`. Výsledek: REJECT na všechny porty pro IPv4 — SSH, web, RPC přestaly přes IPv4 fungovat; IPv6 fungovalo.

**Ponaučení:**

- [ ] SSH musí naslouchat explicitně na `0.0.0.0:2222` **a** `[::]:2222` v `ssh.socket.d/override.conf` a `port22.conf`.
- [ ] Žádné root heslo v rutinním provozu; pokud se resetuje, uložit do 1Password.
- [ ] `ignoreip` v `/etc/fail2ban/jail.d/zion-p2p.conf` musí být aktuální **před** spuštěním lokálního backup node.
- [ ] Při rychlém P2P reconnectu může fail2ban zabanovat IPv4 — vždy existuje fallback `ssh -6 -p 2222 root@2a02:c207:2342:5821::1`.
- [ ] Používejte klíčovou autentizaci a vypněte root password login v `/etc/ssh/sshd_config` (`PermitRootLogin prohibit-password` nebo `no`).

### 8.2 Incident 2026-07-20 — Chyba v block retention

**Průběh:**

- V `/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/bin/node.rs:179` byla chyba:
  ```rust
  if config.block_retention > 0 { rt.set_block_retention(...) }
  ```
- Tento `> 0` guard přeskočil volání `set_block_retention(0)`, takže `ChainState` zůstal na defaultu `DEFAULT_BLOCK_RETENTION=1000`.
- Všechny uzly ořezávaly historii na posledních 1000 bloků i přes `ZION_BLOCK_RETENTION=0` v env.
- Oprava: odstraněn guard, volání `rt.set_block_retention(config.block_retention)` se provede vždy.
- Následek: bloky `0` až `~10913` byly trvale ztraceny, protože žádná záloha s plnou historií neexistovala. Od fixu (výška `~10914+`) se všechny bloky uchovávají.

**Ponaučení:**

- [ ] Nikdy nepředpokládejte, že `0` je neplatná hodnota pro konfiguraci; explicitně nastavujte vždy.
- [ ] Testujte defaulty: `cargo test` musí ověřit, že `block_retention=0` skutečně zakáže pruning.
- [ ] Env proměnná musí být propagována a ověřena logem při startu (`ZION_BLOCK_RETENTION=0`).
- [ ] Zálohy musí obsahovat plnou historii DB; po každé změně retention ověřte `PRAGMA page_count` a `PRAGMA freelist_count`.
- [ ] Před každým hard-forkem / mainnet resetem vytvořte cold zálohu a ověřte její integritu.

---

## 9. V31-specific coding rules

V31 je aktivní mainnet-track workspace. Tato pravidla zajišťují, že zůstane čistý, testovaný a bezpečný.

### 9.1 Workspace a přesměrování kódu

- [ ] Všechny nové funkce, refaktoringy a mainnet-track změny patří do `/Users/yeshuae/Projects/2.9.6/V31/`.
- [ ] V3 se neupravuje, pokud to není kritický hotfix pro produkční Edge.
- [ ] Pokud je potřeba backport z V31 do V3, vytvořte samostatný commit a dokumentujte důvod v `StatusV3.md`.
- [ ] Nepřidávejte žádné “náhodné” změny do `AuXpow/`, `ZionDex/`, `APP&WEB/`, `ZION_OS/` — pouze pokud je úkol explicitně zasáhne.

### 9.2 Testovací brána

- [ ] Před každým PR nebo merge do `V31/` spusťte `cargo test` přímo v `/Users/yeshuae/Projects/2.9.6/V31/`.
- [ ] Všechny workspace testy musí projít. Žádné `--ignored` skipnutí bez odůvodnění.
- [ ] Při změnách v `zion-core` ověřte `EkamDeeksha` unit testy (mine/verify + nonce-search stress) i integrační testy.
- [ ] Při změnách v `zion-pool` ověřte rate limiting reconnect stormu.
- [ ] Při změnách v `zion-miner` ověřte `ZION_STREAM3_FORCE_COIN` a disabled-coin chování.
- [ ] Při změnách v `zion-multichain` ověřte HTLC SQLite persistenci a ZionDex intent engine (`cargo test -p zion-multichain`, `cargo clippy -p zion-multichain`).

### 9.3 Závislosti a verze

- [ ] Nepřidávejte závislosti, které jsou mladší než 7 dní od vydání. Výjimka: bezpečnostní patch od důvěryhodného autora po explicitním schválení.
- [ ] Zakázány jsou plovoucí verzní rozsahy (`>= 0.1`, `*`, `~` mimo patch). Používejte přesné verze s lock file.
- [ ] `Cargo.lock` v `V31/` musí být commitnutý a validní. Po každé změně závislostí spusťte `cargo update` pouze pro konkrétní crate a ověřte diffové změny.
- [ ] Před nasazením nové závislosti proveďte audit `cargo audit` a `cargo tree` pro detekci duplicate / vulnerable crates.
- [ ] Rust edition a toolchain musí odpovídat `rust-toolchain.toml` nebo `V31/rust-toolchain` (pokud existuje).

### 9.4 Bezpečnost kódu

- [ ] Nenosťte secrets do zdrojáků; používejte proměnné prostředí.
- [ ] Všechny RPC endpointy a stratum message handling musí mít timeouty a rate limiting.
- [ ] P2P message validation musí být defenzivní — neočekávejte validní data od peerů.
- [ ] Kanonický `EkamDeeksha` PoW musí být otestován napříč reprezentativními výškami (stress nonce search); historická V3 validace zůstává pokrytá v `v3_compat` testech.
- [ ] Každá změna v `zion-dao` skeletonu musí být doplněna bezpečnostním review, než se zapne na mainnetu.

### 9.5 Dokumentace a status

- [ ] Při každé změně portu, RPC, nebo služby aktualizuj tento `V31/AGENTS.md` a `/Users/yeshuae/Projects/2.9.6/StatusV3.md`.
- [ ] Při každém incidentu založte záznam v kořenovém `AGENTS.md` nebo `StatusV3.md` a sem zkopírujte ponaučení.
- [ ] Všechny TODO a FIXME v kódu musí mít issue nebo `AGENTS.md` poznámku, aby nezůstávaly zapomenuty před Mainnet Alpha.

---

## 10. Kontrolní seznam pro operátory před nasazením V31

- [ ] Aktuální `OPERATOR_IPS` jsou v `ignoreip` a firewall allowlistu.
- [ ] `sshd` naslouchá na `0.0.0.0:22`, `0.0.0.0:2222`, `[::]:22`, `[::]:2222`.
- [ ] Root login zakázán / klíčový; root heslo uloženo v 1Password (pokud existuje).
- [ ] Node RPC `127.0.0.1:9443` není veřejně dosažitelný; nginx `8443` má IP allowlist.
- [ ] P2P porty `8333/8334` mají whitelisted peery a `fail2ban` `zion-p2p` jail.
- [ ] Pool stratum `8444` veřejný a funkční.
- [ ] `cargo test` prošlo v `/Users/yeshuae/Projects/2.9.6/V31/`.
- [ ] Zálohovací skripty `/Users/yeshuae/Projects/2.9.6/ZION_OS/infra/scripts/backup-edge.sh` a `sync-edge-backups.sh` jsou nastaveny a testovány.
- [ ] Žádné secrets nejsou v commitu; `public/` subtree audit proveden.
- [ ] Block retention je explicitně nastaveno a ověřeno logem při startu nodu.

---

## 11. Odkazy a zdroje pravdy

- Kořenový provozní soubor: `/Users/yeshuae/Projects/2.9.6/AGENTS.md`
- Status a topologie: `/Users/yeshuae/Projects/2.9.6/StatusV3.md`
- V31 workspace: `/Users/yeshuae/Projects/2.9.6/V31/`
- V3 produkční workspace: `/Users/yeshuae/Projects/2.9.6/V3/`
- Backup skripty: `/Users/yeshuae/Projects/2.9.6/ZION_OS/infra/scripts/backup-edge.sh`, `/Users/yeshuae/Projects/2.9.6/ZION_OS/infra/scripts/sync-edge-backups.sh`
- fail2ban config: `/etc/fail2ban/jail.d/zion-p2p.conf`
- SSH socket drop-ins: `/etc/systemd/system/ssh.socket.d/`
- Server: `62.171.141.136` (Contabo), IPv6 `2a02:c207:2342:5821::1`
- RPC: `rpc.zionterranova.com:8443` → `127.0.0.1:9443`
- Pool: `62.171.141.136:8444`

---

**Verze:** 2026-07-30 V31 Mainnet Alpha

## 12. Edge V31 deploy notes (2026-08-05)

- `V31/deploy/deploy-edge.sh` still references stale `zion-edge-*` units and an obsolete `--bin zion-bridge` target; manual deploy is currently more reliable.
- Working manual procedure:
  1. `rsync` local `V31/` to `/opt/zion` on the Edge.
  2. On Edge: `. /root/.cargo/env && cd /opt/zion/V31 && sed -i '/"cli",/d;/"smoke",/d' Cargo.toml` (these members are not needed on Edge).
  3. Build with `nohup cargo build -p zion-core -p zion-pool -p zion-miner -p zion-dao -p zion-multichain --release >/tmp/v31-build.log 2>&1 </dev/null &`.
  4. `chown -R zion:zion /opt/zion/V31/target/release` and `systemctl restart zion-v31-node zion-v31-multichain zion-v31-pool zion-v31-dao zion-v31-miner`.
- For SSH to Edge, prefer IPv6 with `ControlMaster` + `ControlPersist` and `ServerAliveInterval` to avoid `Connection refused` from `fail2ban`/rate-limiting during rapid deploy commands:
  ```
  Host zion-v6
      HostName 2a02:c207:2342:5821::1
      User root
      Port 2222
      IdentityFile ~/.ssh/zion-edge-post-wipe-2026-07-29
      IdentitiesOnly yes
      ControlMaster auto
      ControlPath ~/.ssh/control-%r@%h:%p
      ControlPersist 10m
  ```
**Autorita:** Provozní pravidla pro Devin a operátory. Jakýkoliv rozpor s kořenovým `AGENTS.md` řešte aktualizací obou souborů; tento soubor má přednost pro V31, kořenový `AGENTS.md` pro historii a globální topologii.
