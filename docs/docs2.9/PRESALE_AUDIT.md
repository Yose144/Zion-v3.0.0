# PRESALE & V2 E‑SHOP Audit

**Datum:** 2025-12-16
**Autor:** GitHub Copilot

## Cíl auditu
- Rychle ověřit, že V2 e‑shop a presale flow fungují (košík → checkout → platba → potvrzení objednávky). ✅
- Najít a zdokumentovat kritické chyby, bezpečnostní rizika a chybějící testy. ⚠️
- Navrhnout opravy s prioritami a postupem nasazení do test prostředí. 🔧

---

## Rozsah
- Frontend: `public_html/V2/` (všechny šablony, JS: `shop.js`, `checkout.js`, `presale.js` a závislosti)
- Backend/API: `public_html/api/` (endpoints pro vytváření objednávek, faktur, platební brány, refundy)
- Úložiště objednávek/invoices: `public_html/orders/`, `public_html/invoices/` a případné DB/flatfile
- Integrace plateb: ověřit sandbox/prod nastavení v `.env` nebo `public_html/V2/api/config.php`
- Testovací skripty: `tests/` (přidat chybějící testy pro presale)

---

## Rychlá kontrolní (smoke) checklista
- [ ] Je frontend dosažitelný přes lokální server (php -S nebo static server)?
- [ ] Zobrazuje se produktová stránka a lze vložit položky do košíku? (`shop.js`, `cart.js`)
- [ ] Checkout: odesílá se požadavek na `api/create-order.php` (nebo obdobu)?
- [ ] Platební brána: existuje sandbox konfigurace a funguje testovací tok (test card/token)?
- [ ] Presale pravidla: existuje cap limit, whitelist, časové okno a validace na serveru? (`presale.js`, `presale-info`)
- [ ] Po úspěšné platbě vzniká řádek v `orders/` nebo je vytvořena faktura v `invoices/`?
- [ ] Existují základní logy na serveru (PHP errors, application logs)?
- [ ] JS console: žádné kritické error funkce při przechodu presale tokem

---

## Detailní auditu: kroky
1. Příprava prostředí
   - Zkopírovat aktuální repozitář do test prostředí / běžet lokálně.
   - Spustit lokální HTTP server pro V2: `php -S 127.0.0.1:8000 -t public_html/V2`
   - Zkontrolovat `public_html/V2/api/.env` nebo `config.php` pro testovací klíče.

2. Reprodukce uživatelských toků (manuálně)
   - Vložit položky do košíku, přejít na checkout, validovat presale pravidla (limit per wallet/email), dokončit platbu se sandbox kartou.
   - Ověřit reakce API (HTTP status, response body) a server logs.

3. Automatizované smoke testy (skripty)
   - Přidat skript `tests/e2e_presale_smoke.sh`:
     - Start server
     - Simulovat CREATE_ORDER (curl POST)
     - Simulovat platební callback (curl POST do `api/payment-callback.php`)
     - Ověřit vytvoření order/faktury
   - Doporučení: později portovat do Playwright/Playtest pro UI e2e.

4. Debugging checklist (pokud něco nefunguje)
   - Zkontrolovat konzoli JS (Chrome devtools) — chyby, neprovedené volání
   - Ověřit síťová volání: správné URL, CORS, očekávané payloady
   - Zkontrolovat server-side PHP error log (`error_log`, `logs/`)
   - Ověřit oprávnění pro zápis do `orders/` a `invoices/` (souborový systém)
   - Ověřit validace na serveru (číslo zásob, presale cap, whitelist)
   - Pokud platební brána nevrací callback: ověřit dostupnost veřejného endpointu a signaturu

5. Testovací případy k doplnění
   - Unit testy pro `api/create-order.php` (validace vstupu, presale checks)
   - Integration test: simulovat platební callback a ověřit stav order a faktury
   - E2E: UI purchase flow

---

## Prioritizace oprav
1. P0 (stop-sale): chyby které znemožňují nákup nebo vytváření orderů
2. P1: platební callback/y failing (payments not recorded)
3. P2: presale rules enforcement (caps, whitelist)
4. P3: UX a drobné chyby (notifikace, emaily)

---

## Bezpečnost & nasazení
- Nikdy testovat platby v produkčním režimu (použijte sandbox API klíče). 🔒
- Před nasazením oprav na produkci spustit e2e smoke + regression testy.
- Mít rollback plán (backup `orders/` a DB snapshot) před nasazením.

---

## Logy a monitoring
- Doporučit přidat jednoduchý log pro `api/create-order.php` a `api/payment-callback.php` s úrovní INFO/ERROR.
- Přidat alert: počet neúspěšných checkoutů za 10 minut > X → paging.

---

## Nutné přístupy pro debugování
- Testovací platební klíče (sandbox)
- Přístup k testnímu/dokovací instanci serveru (SSH) nebo k logům
- E‑mail test accounty / whitelist entries (pokud presale používá whitelist)

---

## Požadované výstupy auditu (co budu předkládat)
- Seznam chyb s prioritami (P0–P3) a konkrétním kroky k opravě
- Patch/PRy s opravami a testy
- E2E smoke skript a CI workflow

---

## Implementované rychlé opravy (P0) — stav
- Přidán konfigurační flag `PRESALE_ENABLED` (default: false) a `PRESALE_WHITELIST` v `V2/api/config.php`.
- Přidána canonical cena `PRESALE_TOKEN_PRICE` (0.008 EUR/token) a front-end `presale.js` aktualizován.
- Přidána server-side validace, která ověřuje, že `priceEur` → `tokens` odpovídá canonical ceně (`presale-order.php`).
- `wallet-ledger.php` nyní podporuje ochranu pomocí `WALLET_LEDGER_API_KEY` (hlavička `X-API-Key`) a zápis do logu pro neautorizované pokusy.
- Přidány helpery `presale-utils.php` a základní testy `tests/test_presale_utils.py` (PHP-based check).  

Tyto změny jsou malé, bezpečné a připravené pro review a nasazení do test prostředí. Další krok: napsat integrace testy a spustit e2e smoke.

---

## Další kroky (následující 48 hodin)
1. Spustit manuální smoke (repro) a nahrát zjištění (bug list). ⏱️
2. Implementovat P0 opravy a unit/integration testy. 🧪
3. Nasadit do test prostředí a spustit e2e smoke. 🚀

---

> Poznámka: Pokud chcete, mohu pokračovat okamžitě s prvním krokem: spustím lokální PHP server a pokusím se reprodukovat checkout/presale flow a nahrát první chybové reporty.
