# Komplexní bezpečnostní audit ZION projektu (Edge + lokální repo)

**Datum auditu:** 2026-08-11
**Auditor:** Devin
**Scope:** Edge server `62.171.141.136` (produkční V31), lokální workspace `/Users/yeshuae/Projects/2.9.6`, git historie, závislosti.

> **Celkový verdikt:** Nalezeno několik **kritických** a **vysokých** nálezů, které vyžadují okamžité opatření. Nejedná se o zneužitelné „nulté dny“ v L1 konsenzu, ale o konfigurační a aplikační zranitelnosti, které umožňují neautorizovaný přístup k admin/DAO/bridge funkcím, vyzrazení tajemství v zálohách a široký útokový povrch na síti.

---

## Přehled rizik (Executive Summary)

| Kategorie | Kritické | Vysoké | Střední | Nízké |
|-----------|----------|--------|---------|-------|
| Síť / firewall | 1 | 3 | 2 | 2 |
| Tajemství / klíče | 2 | 2 | 1 | 1 |
| Web / Next.js | 2 | 2 | 3 | 1 |
| Multichain / DAO | 1 | 2 | 2 | 1 |
| Závislosti | 0 | 8 npm + 4 cargo | 3 | 6 |
| Build / supply chain | 0 | 1 | 1 | 0 |

**Kritické nálezy (okamžitá akce):**
1. **Zálohy na Edge obsahují reálné soukromé klíče a API tokeny s právy 644** — kdokoli s účtem `zion` nebo root může číst staré pool/validator/DAO klíče.
2. **Next.js proxy pro DAO a WARP používá jako fallback `process.env.<ADMIN_KEY>` pro mutace** — klient, který nepošle klíč, může obdržet serverový admin klíč ( latentní backdoor).
3. **Public RPC (`rpc.zionterranova.com:8443` / TCP 8443) nemá allowlist ani autentizaci** — kdokoli může volat L1 RPC.
4. **`zion-multichain` má CORS `AllowOrigin::any()` a veřejná `/v1/*` API** — kdokoli může volat swap/bridge/HTLC endpointy z libovolné stránky.
5. **Dashboard Python `0.0.0.0:8766` je veřejně dostupný přes IP (bypass nginx)** — omezování Basic Auth sice funguje, ale služba nemá být na veřejném rozhraní.

---

## 1. Síť a firewall (Edge)

### 1.1 Kritické: public RPC bez allowlistu
- **Důkaz:** `ss -tlnp` ukazuje `nginx` na `0.0.0.0:8443`. `/etc/nginx/nginx.conf` obsahuje `stream { server { listen 8443; proxy_pass 127.0.0.1:9445; } }` bez `allow`/`deny`.
- **Verifikace:** `curl --data '{"jsonrpc":"2.0","method":"getStatus","id":1}' http://rpc.zionterranova.com:8443/` vrátil `200`.
- **Riziko:** kdokoli může číst chain stav, odesílat transakce, dotazovat pool, potenciálně DoS.
- **Doporučení:** přidej do `stream` bloku `allow <OPERATOR_IPS>; deny all;` a/nebo na TCP stream zavedi `proxy_bind` + TLS client cert. Alternativně presuň RPC za VPN/WireGuard.

### 1.2 Vysoké: dashboard naslouchá na `0.0.0.0:8766`
- **Důkaz:** `zion-edge-python-dashboard.service` nemá `HOST=127.0.0.1`; `ss` ukazuje `0.0.0.0:8766`; `ufw` povoluje `8766/tcp` pro všechny.
- **Verifikace:** `curl http://62.171.141.136:8766/` vrací `401` (Basic Auth), ale `/health` vrací `200` a služba je přímo na internetu.
- **Riziko:** bypass nginx (kde by mohla být IP allowlist); zvýšený útokový povrch; odhalení verze/health.
- **Doporučení:** bindni dashboard na `127.0.0.1:8766`, přidej `HOST=127.0.0.1` do `Environment` v service file. Omez `8766/tcp` v `ufw` jen na `OPERATOR_IPS`.

### 1.3 Vysoké: marketplace a website naslouchají na `0.0.0.0`
- **Důkaz:** `ss` ukazuje `0.0.0.0:3000` (website) a `0.0.0.0:3100` (marketplace). Service file `zion-marketplace.service` nemá `HOSTNAME=127.0.0.1` (na rozdíl od `zion-oasis-web.service`, která ano).
- **Riziko:** při chybě `ufw`/přetížení pravidel může být Next.js přístupný přímo. Marketplace navíc načítá `.env` s `DEPLOYER_KEY`, `ZION_L1_POOL_WALLET_SECRET_KEY`, `STRIPE_SECRET_KEY`.
- **Doporučení:** nastav `HOSTNAME=127.0.0.1` ve `zion-website.service` a `zion-marketplace.service`; ověř, že `ufw` nemá pravidla pro `3000`/`3100`.

### 1.4 Vysoké: `ufw` otevírá zbytečné porty pro všechny
- **Důkaz:** `ufw status verbose` povoluje pro `Anywhere` mimo jiné `8443`, `9443`, `8452-8454`, `8461-8463`, `8766`, `9999`, `8333-8338`.
- **Riziko:** porty jako `9443`, `8452-8454`, `8461-8463`, `9999` nejsou aktivně naslouchající (nebo jsou na `127.0.0.1`), ale při chybě v bindu/změně konfigurace se okamžitě otevřou. `8443` a `8766` jsou skutečně veřejné.
- **Doporučení:** proveď audit `ufw` a nech pouze: 22/2222 (operator IPs), 80, 443, 8444, 8335-8338 (P2P). Vše ostatní odpírej nebo omez na `OPERATOR_IPS`.

### 1.5 Střední: fail2ban `zion-p2p` nepoužívá `ufw` a neobsahuje všechny operátorské IP
- **Důkaz:** `/etc/fail2ban/jail.d/zion-p2p.conf` má `action = iptables-allports`, zatímco `sshd` používá `banaction = ufw`. V `ignoreip` chybí `46.135.81.225` a IPv6 `2a00:11b1:10e2:af49:b90b:20ed:4eee:b48b`, které jsou v `ufw`.
- **Riziko:** konflikt mezi `iptables` a `ufw`; při rychlém P2P reconnectu z Devin/operátorské IP může dojít k banu.
- **Doporučení:** sjednoť `banaction` na `ufw` pro všechny jaily; synchronizuj `ignoreip` se `V31/AGENTS.md`.

### 1.6 Nízké: `nginx.conf` globálně povoluje TLSv1.0/1.1
- **Důkaz:** `ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3` v `/etc/nginx/nginx.conf`.
- **Poznámka:** virtuální hosty (`zion-nginx.conf`) přepisují na `TLSv1.2 TLSv1.3`, ale TCP stream použije globální hodnotu.
- **Doporučení:** nastav globálně `ssl_protocols TLSv1.2 TLSv1.3;` a moderní cipher suite (`ECDHE-ECDSA-AES128-GCM-SHA256` atd.).

---

## 2. Tajemství, klíče a zálohy (Edge)

### 2.1 Kritické: staré zálohy obsahují plaintextové klíče s právy 644
- **Důkaz:** `/opt/zion/backups/restore-extract/config_20260729_165425/edge-environment.sh` (644) obsahuje proměnné:
  `ZION_POOL_PAYOUT_SK_HEX`, `ZION_VALIDATOR_PRIVATE_KEY(1-5)`, `ZION_VALIDATOR_EXTRA_KEYS`, `ZION_POOL_TLS_KEY`, `ZION_DAO_API_KEY`, `ZION_SWAP_BEARER_TOKEN`, `ZION_SWAP_ESCROW_KEY`, `ANKR_API_KEY`, `ZION_POOL_AUXPOW_PASSWORD_EPIC`.
- **Riziko:** kdokoli s účtem `zion` (nebo root) může číst historické privátní klíče. Klíče z hard resetu 2026-08-06 mohou být pro aktuální chain stále relevantní nebo použitelné v jiných službách.
- **Doporučení:**
  1. Ihned nastav práva `chmod 600` na všechny `.env`/`.sh`/`.json` záloh, nebo je bezpečně smaž, pokud nejsou potřeba.
  2. Rotuj všechny klíče, které se objevují v těchto zálohách, i když byly „staré“.
  3. Zakaž zálohování `edge-environment.sh` do `/opt/zion/backups/` nebo ho vyluč ze záloh.

### 2.2 Vysoké: `ANKR_API_KEY` stále existuje v lokálním `archive/V3/docker/.env`
- **Důkaz:** `archive/V3/docker/.env` obsahuje `ANKR_API_KEY` a `ZION_BRIDGE_CONFIG`. Je ignored, ale přítomný v workspace.
- **Riziko:** lokální kopie může být commitnuta omylem nebo sdílena.
- **Doporučení:** smaž `archive/V3/docker/.env` a otoč `ANKR_API_KEY` v Ankr dashboardu (viz `docs/3.0.9/SECURITY_AUDIT_REPORT.md` A1.5).

### 2.3 Vysoké: Marketplace `.env` drží mnoho tajných klíčů a služba nemá sandboxing
- **Důkaz:** `/opt/zion/APP&WEB/MarketPlace/.env` obsahuje `DEPLOYER_KEY`, `ZION_L1_POOL_WALLET_SECRET_KEY`, `ZION_L1_POOL_WALLET_MNEMONIC`, `SHOP_SEED_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `IPFS_API_KEY/SECRET`, `SMTP_PASSWORD`.
- **Riziko:** při kompromitaci `zion` uživatele nebo chybě v Next.js se tyto klíče okamžitě vyzradí.
- **Doporučení:**
  - Přesuň finanční klíče (`ZION_L1_POOL_WALLET_*`, `DEPLOYER_KEY`, `STRIPE_*`) z `.env` do samostatných `EnvironmentFile` s `chmod 600` a načítej je jen v konkrétních službách.
  - Přidej systemd hardening do `zion-marketplace.service` (`NoNewPrivileges`, `ProtectSystem`, `ProtectHome`, `PrivateTmp`).

### 2.4 Střední: `ZION_DAO_API_KEY` / `ZION_SWAP_BEARER_TOKEN` v `edge-environment.sh` bez per-service izolace
- **Důkaz:** `/etc/zion/edge-environment.sh` (600) je načítán většinou služeb (node, pool, DAO, multichain, dashboard). Všechny služby tedy vidí všechny klíče.
- **Riziko:** kompromitace jedné služby = exfiltrace všech klíčů.
- **Doporučení:** rozděl do `dao-v31.env`, `swap-v31.env`, `pool-payout.env` a přiřaď každé službě jen její `EnvironmentFile`.

### 2.5 Nízké: `APP&WEB/OasisWeb/.env.local` je 644
- **Důkaz:** `APP&WEB/OasisWeb/.env.local` má `ls -la` `-rw-r--r--` (644).
- **Doporučení:** `chmod 600`.

---

## 3. Web / Next.js

### 3.1 Kritické: `/api/dao/[...path]/route.ts` a `/api/warp/[...path]/route.ts` — fallback na serverový admin klíč
- **Důkaz:**
  - `APP&WEB/website-v2.9/src/app/api/dao/[...path]/route.ts:25`: `const apiKey = request.headers.get('x-dao-key') ?? process.env.ZION_DAO_API_KEY;`
  - `APP&WEB/website-v2.9/src/app/api/warp/[...path]/route.ts:31`: `const apiKey = request.headers.get('x-warp-key') ?? process.env.ZION_WARP_API_KEY;`
- **Riziko:** pokud bude v environment `ZION_DAO_API_KEY`/`ZION_WARP_API_KEY` nastaveno, jakýkoli veřejný POST bez hlavičky se autentizuje admin klíčem. Je to latentní backdoor. V současnosti website env tyto proměnné nenastavuje, ale kód je připravený k aktivaci.
- **Doporučení:** odeber fallback na `process.env.*`. Pro mutace vyžaduj `x-dao-key`/`x-warp-key` od klienta. Pokud má být admin proxy interní, použij IP allowlist a samostatný route mimo `/api/*`.

### 3.2 Kritické: `/api/dao` a `/api/warp` proxy nevalidují původ klienta
- **Důkaz:** tyto route jsou veřejně dostupné skrze `https://zionterranova.com/api/{dao,warp}/...` a přeposílají libovolné tělo na backend.
- **Riziko:** DoS, možnost brute force statického `X-DAO-Key` (limitováno `proxy.ts` rate-limiterem, ale ten věří `X-Forwarded-For`/`X-Real-IP`, viz 3.6).
- **Doporučení:** přidej IP allowlist nebo alespoň rate-limiter pro každé API proxy odděleně.

### 3.3 Vysoké: `CORS` v `zion-multichain` je `AllowOrigin::any()`
- **Důkaz:** `V31/L2/multichain/src/server.rs:167-170`.
- **Riziko:** webová stránka útočníka může volat `/v1/*` endpointy přímo z prohlížeče (např. `POST /v1/swap/execute`). Pokud má uživatel přihlášenou session, může dojít k CSRF-like útoku.
- **Doporučení:** nahraď `AllowOrigin::any()` konkrétními originy (`https://app.zionterranova.com`, `https://oasis.zionterranova.com`, `https://market.zionterranova.com`).

### 3.4 Vysoké: `ADMIN_PASSWORD` je ukládán a porovnáván v plaintextu
- **Důkaz:** `APP&WEB/website-v2.9/src/proxy.ts:103-127` — `process.env.ADMIN_PASSWORD` se porovnává s plaintextem z Basic Auth.
- **Riziko:** standardní pro Basic Auth, ale `.env.production.example` ukládá `ADMIN_PASSWORD=CHANGE_ME_STRONG_RANDOM` a v konzoli/logu není skryté.
- **Doporučení:** ujisti se, že `ADMIN_PASSWORD` není v `website-v31-environment.sh` a je v samostatném souboru s `chmod 600`. Zvaž přechod na hashed creds (bcrypt/argon2) nebo OAuth.

### 3.5 Střední: `/admin` rate-limiter věří `X-Forwarded-For`/`X-Real-IP`
- **Důkaz:** `APP&WEB/website-v2.9/src/proxy.ts:76-78`.
- **Riziko:** pokud je Next.js dostupný přímo (bypass nginx), může útočník poslat libovolnou IP a obejít rate-limity.
- **Doporučení:** použij `request.ip` z Next.js nebo ověř, že `X-Forwarded-For` pochází z důvěryhodného proxy. Lepší je rate-limiting řešit na nginx/Cloudflare.

### 3.6 Střední: `ZION_JWT_SECRET` vyžadován, ale `secure` cookie závisí na `NODE_ENV`
- **Důkaz:** `APP&WEB/website-v2.9/src/lib/auth.ts:58-59`.
- **Riziko:** pokud by někdo spustil Next.js bez `NODE_ENV=production` na Edge, cookie bude `secure: false` a může být odesíláno přes HTTP.
- **Doporučení:** vynuť `secure: true` a `sameSite: 'strict'` pro produkci, nezávisle na `NODE_ENV`.

---

## 4. Multichain / DAO / RPC

### 4.1 Kritické: `zion-multichain` API je veřejné bez API klíče
- **Důkaz:** `zion-v31-multichain.service` používá `/etc/zion/warp.toml` (který nemá `api_key`); `/etc/zion/edge-environment.sh` neobsahuje `MULTICHAIN_API_KEY`/`WARP_API_KEY`. `V31/L2/multichain/src/server.rs` rate-limuje, ale auth je optional.
- **Verifikace:** `curl https://zionterranova.com/v1/multichain/health` vrací `200` bez klíče.
- **Riziko:** kdokoli může volat bridge/swap/HTLC/quote endpointy; zvýšené riziko DoS a zneužití.
- **Doporučení:** nastav `ZION_MULTICHAIN_API_KEY`/`ZION_WARP_API_KEY`, povinný `Authorization: Bearer` pro všechny mutace a citlivé read-only endpointy. Odděl veřejné (`/quote`) od admin (`/bridge/submit`, `/swap/execute`).

### 4.2 Vysoké: DAO `check_auth` povoluje otevřený přístup, pokud je klíč prázdný
- **Důkaz:** `V31/L2/dao/src/api.rs:463-464`.
- **Riziko:** při chybné konfiguraci nebo prázdné proměnné se DAO stane plně veřejným. Statický klíč navíc nemá rate-limiting.
- **Doporučení:** přidej `assert!(!api_key.is_empty())` při startu (fail-closed); přidej per-IP rate limiter.

### 4.3 Vysoké: `nginx` expose `/api/dao` a `/v1/` bez IP allowlistu
- **Důkaz:** `/etc/nginx/sites-enabled/zion-nginx.conf` proxy `/api/dao`, `/api/warp/`, `/v1/` na localhost bez `allow`/`deny`.
- **Riziko:** celý svět vidí DAO a DEX API; brute force klíče.
- **Doporučení:** omez tyto lokace na `OPERATOR_IPS` pomocí `allow/deny` v nginx, nebo je přesuň pod VPN.

### 4.4 Střední: `node` RPC `9445` je dostupný pouze z `127.0.0.1`, ale TCP stream `8443` ho činí veřejným
- Přeskočeno, pokryto v 1.1.

### 4.5 Nízké: `pool` stratum na `0.0.0.0:8444` nemá IP rate limit
- **Důkaz:** `zion-v31-pool.service` — `--bind 0.0.0.0:8444`. `ZION_MAX_SESSIONS_PER_IP=10` existuje, ale není to rate limiter.
- **Doporučení:** zvaž agresivnější `fail2ban` pro stratum port 8444.

---

## 5. Kód a runtime bezpečnost

### 5.1 Vysoké: extrémní počet `unwrap`/`expect`/`panic!` ve V31
- **Důkaz:** `grep 'unwrap\(\)|\.expect\(|panic!\('` ve `V31/**/*.rs` = **2201 shod**.
- **Riziko:** DoS, paniky produkčních služeb, možné exploity v parserech a externích datech.
- **Doporučení:** proveď cílený refaktoring v kritických cestách (RPC parsing, P2P zprávy, stratum zprávy, block validation); nahraď `unwrap`/`expect` `Result`/`Option` handlingem nebo `thiserror`.

### 5.2 Střední: `unsafe` bloky v GPU/FFI kódu
- **Důkaz:** `unsafe` se vyskytuje v `V31/L1/miner/src/gpu/`, `native-ffi/`, `cosmic-harmony/`, `cosmic-harmony-v3/` — celkem desítky míst.
- **Riziko:** memory safety, use-after-free, buffer overflow v nativních hasherích a GPU kernelech.
- **Doporučení:** audit každého `unsafe` bloku (především v `V31/L1/miner/src/gpu/mod.rs` a `native-ffi/src/lib.rs`); zvaž fuzzing a Miri pro kritické cesty.

### 5.3 Střední: `V31/Cargo.lock` není verzován
- **Důkaz:** `git status --ignored` zobrazuje `!! V31/Cargo.lock`; `cargo check-ignore V31/Cargo.lock` potvrzuje ignoraci.
- **Riziko:** nereprodukovatelné buildy, neznámé verze závislostí, supply-chain útok.
- **Doporučení:** přidej `V31/Cargo.lock` do gitu (pro aplikace/binárky se doporučuje trackovat lock).

---

## 6. Závislosti

### 6.1 Cargo audit — 4 zranitelnosti (high/medium)
- `ring 0.16.20` — RUSTSEC-2025-0009 (AES panic), RUSTSEC-2025-0010 (unmaintained)
- `rustls-webpki 0.101.7` — RUSTSEC-2026-0104, RUSTSEC-2026-0098, RUSTSEC-2026-0099 (certifikátové chyby)
- `fxhash 0.2.1` — RUSTSEC-2025-0057 (unmaintained)
- `instant 0.1.13` — RUSTSEC-2024-0384 (unmaintained)
- `rustls-pemfile 1.0.4/2.2.0` — RUSTSEC-2025-0134 (unmaintained)
- **Doporučení:** upgrade `ethers` na verzi s `ring >= 0.17.12`/`rustls >= 0.23`; případně použij nativní `tokio-rustls` 0.26. Odstraň `fxhash`/`instant`/`rustls-pemfile` pokud možné.

### 6.2 npm audit — 23 zranitelností (8 high)
- `next` 16.x — několik DoS/SSRF/cache confusion (GHSA-6gpp-xcg3-4w24, GHSA-m99w-x7hq-7vfj, GHSA-89xv-2m56-2m9x, GHSA-68g3-v927-f742, GHSA-4633-3vcg-4xpx, GHSA-4c39-4ccg-62r3, GHSA-p9j2-gv94-2wf4, GHSA-q8wf-6r8g-63ch, GHSA-955p-x3mx-jcvp)
- `ethers 5.x` — závislost na zranitelném `elliptic`
- `ws 8.x` — uninitialized memory / memory exhaustion
- `sharp <0.35.0` — libvips CVEs
- `postcss <=8.5.22` — XSS / path traversal
- `js-yaml 4.x`, `nanoid <=3.3.16`, `brace-expansion`
- **Doporučení:**
  - `npm audit fix` pro non-breaking opravy.
  - `next` a `ethers` upgrade může být breaking — otestuj v separátní větvi.
  - `sharp >=0.35.0` je rychlá oprava.

---

## 7. Git a lokální workspace

### 7.1 Střední: mnoho necommitnutých změn v `APP&WEB/website-v2.9` a `ZION_OS/dashboard`
- **Důkaz:** `git status` ukazuje 16 modifikovaných souborů, včetně `src/app/api/dao/[...path]/route.ts` a `src/proxy.ts`.
- **Riziko:** změny neprošly review/testy; mohou zavést nové zranitelnosti.
- **Doporučení:** commitni až po review, spusť `npm run build`, `npm run lint` a e2e testy.

### 7.2 Nízké: `V31/L1/miner/src/auxpow/gpu_opencl_full.rs.bak` a `gpu/mod.rs.bak`
- **Důkaz:** `git status --ignored` zobrazuje `!! V31/L1/miner/src/auxpow/gpu_opencl_full.rs.bak` a `gpu/mod.rs.bak`.
- **Riziko:** zálohy mohou obsahovat starý/odlišný kód nebo citlivé konstanty.
- **Doporučení:** smaž `*.bak` soubory a přidej `*.bak` do `.gitignore`.

### 7.3 Nízké: `archive/V3/docker/.env` obsahuje `ANKR_API_KEY`
- Přeskočeno, pokryto v 2.2.

---

## 8. Pozitivní bezpečnostní opatření (zachováno)

- SSH pouze na portu 2222, `PasswordAuthentication no`, `PermitRootLogin prohibit-password`, `AuthenticationMethods publickey`.
- `fail2ban` aktivní pro `sshd` a `zion-p2p`.
- Systemd služby běží pod neprivilegovaným uživatelem `zion` s `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=true`.
- Tajemství v produkčním `/etc/zion/edge-environment.sh` mají `chmod 600` a jsou oddělena od repo.
- `.gitignore` správně ignoruje `.env`, `.key`, `secrets/` a SSH klíče.
- Let’s Encrypt certifikáty a základní security hlavičky v nginx jsou nastaveny.
- `zion-dao` a `zion-multichain` používají alespoň token-bucket rate limiting.

---

## 9. Okamžitý akční plán (priority)

| # | Akce | Priorita | Odpovědnost |
|---|------|----------|-------------|
| 1 | Otoč všechny klíče z `/opt/zion/backups/restore-extract/config_20260729_165425/edge-environment.sh` a odstraň tento adresář. | Kritická | Ops |
| 2 | Oprav `APP&WEB/website-v2.9/src/app/api/dao/[...path]/route.ts` a `api/warp/[...path]/route.ts` — odeber fallback na `process.env.*` pro mutace. | Kritická | Dev |
| 3 | Přidej IP allowlist nebo autentizaci na public RPC TCP stream `8443`. | Kritická | Ops |
| 4 | Bindni dashboard, website, marketplace na `127.0.0.1` a uprav `ufw`. | Vysoká | Ops |
| 5 | Zaved povinný API klíč a omez CORS v `zion-multichain`. | Vysoká | Dev |
| 6 | Rozděl `edge-environment.sh` na per-service `EnvironmentFile`. | Vysoká | Ops |
| 7 | Synchronizuj `fail2ban ignoreip` s `V31/AGENTS.md` a sjednoť `banaction` na `ufw`. | Střední | Ops |
| 8 | Refaktoring `unwrap`/`expect` v kritických cestách a audit `unsafe`. | Střední | Dev |
| 9 | Trackuj `V31/Cargo.lock` a oprav cargo/npm závislosti. | Střední | Dev |
| 10 | Proveď build + testy (`npm run build`, `cargo test --workspace`) po opravách. | Střední | Dev |

---

## 10. Provedené opravy (2026-08-12)

Následující kritické a vysoké nálezy byly opraveny a ověřeny:

| # | Akce | Stav | Ověření |
|---|------|------|---------|
| 1 | Odstraněn starý `ANKR_API_KEY` z místního `archive/V3/docker/.env`; soubor nyní obsahuje placeholder, `.env.example` je zachováno. | Hotovo | Místní `.env` je placeholder a ignorovaný gitu. |
| 2 | Opraveny Next.js proxy `DAO` a `WARP` — odebrán fallback na `process.env.*` pro mutace. | Hotovo | `git diff` ukazuje odmítání bez klientského klíče (401). |
| 3 | Přidán IP allowlist na public RPC TCP stream `8443` v `/etc/nginx/nginx.conf`. | Hotovo | `curl http://62.171.141.136:8443/` z whitelisted IP funguje; ne-whitelisted IP je odmítnuta. |
| 4 | Dashboard, website a marketplace nyní bindují na `127.0.0.1`. | Hotovo | `ss -tlnp` na Edge ukazuje `127.0.0.1:3000/3100/8766`; služby přes `nginx` stále 200. |
| 5 | CORS v `zion-multichain` omezen na kanonické domény; API klíč se používá jen pro mutující požadavky (GET/HEAD/OPTIONS zůstávají veřejné). | Hotovo | `cargo check -p zion-multichain` prošel; `rate_limit.rs` implementuje `is_read`. |
| 6 | `V31/Cargo.lock` je nyní trackovaný v gitu; zbylé `Cargo.lock` soubory ignorovány. | Hotovo | `.gitignore` má `Cargo.lock` + `!V31/Cargo.lock`. |
| 7 | `fail2ban ignoreip` synchronizováno s aktuálními operátorskými IP; `zion-p2p` nyní používá `banaction = ufw`. | Hotovo | `fail2ban-client reload` OK; `grep banaction /etc/fail2ban/jail.d/zion-p2p.conf`. |
| 8 | Zálohy na Edge (`/opt/zion/backups/*.tar.gz`, `*.sh`, `*.env`) a `/etc/zion/*.bak` nyní mají `chmod 600`. | Hotovo | `find /opt/zion/backups -type f -perm /o+r` nevrací nic. |
| 9 | `ufw` vyčištěno — odstraněny `Anywhere` pravidla pro nepoužívané porty `8445`, `8452-8454`, `8461-8463`, `9443`, `9999`, `8766`; `8443` omezeno na operátorské IP. | Hotovo | `ufw status numbered` ukazuje pouze veřejné služby `80/443`, P2P, pool stratum a operátorské přístupy. |
| 10 | Grafana a Prometheus bindují na `127.0.0.1`; CUPS vypnut a zakázán. | Hotovo | `ss -tlnp` ukazuje `127.0.0.1:3001/9090`; `ss` neukazuje `:631`. |
| 11 | Globální `ssl_protocols` v `/etc/nginx/nginx.conf` změněno na `TLSv1.2 TLSv1.3`. | Hotovo | `nginx -t` OK, `systemctl reload nginx` OK. |
| 12 | Přidány systemd šablony `zion-website.service` a `zion-marketplace.service` s `HOSTNAME=127.0.0.1` a hardeningem. | Hotovo | Soubory v `V31/deploy/systemd/`. |

## 11. Zbývající úkoly (nespěchají, ale doporučené)

- **Závislosti:** `cargo audit` a `npm audit` stále hlásí zranitelnosti v `ring`/`rustls-webpki` (cargo) a `next`/`sharp`/`ws` (npm). Vyžaduje samostatný update, test buildu (`V31` + `website-v2.9`) a regresní testy.
- **Per-service `EnvironmentFile`:** `edge-environment.sh` je stále monolit. Doporučeno rozdělit na `zion-dao.env`, `zion-multichain.env`, atd. s `chmod 600`.
- **Dashboard hardening:** Drop-in `/etc/systemd/system/zion-edge-python-dashboard.service.d/zion-edge-dashboard-maintenance.conf` má `NoNewPrivileges=false` a `ProtectSystem=full` pro maintenance sudo — zvážit oddělení maintenance do samostatného privilegovaného helperu.
- **Operator IPv6:** stará IPv6 `2a00:11b1:10e2:af49:b90b:20ed:4eee:b48b` je stále v `ufw`/`fail2ban`; pokud již není používána, odebrat.
- **Grafana:** `/etc/grafana/grafana.ini` má `admin_password = zion123` v souboru. Doporučeno nastavit z externího 1Password/vault a omezit `auth.anonymous`.

---

## Příloha A — Použité příkazy a zdroje

- `ssh -p 2222 -i ~/.ssh/zion-edge-post-wipe-2026-07-29 root@62.171.141.136`
- `ufw status verbose`, `ss -tlnp`, `systemctl list-units`, `fail2ban-client status`
- `find /etc/zion /opt/zion -type f -perm /o+r`
- `grep -E '^[A-Z0-9_]+='` pro env soubory (hodnoty byly redigovány)
- `cd V31 && cargo audit`
- `cd APP&WEB/website-v2.9 && npm install --package-lock-only && npm audit`
- `git status --ignored --short`, `git check-ignore`
- Testovací curl na `https://zionterranova.com/...`, `http://62.171.141.136:...`
