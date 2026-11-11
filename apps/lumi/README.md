# Lumi — e-shop a marketing

Samostatný web pro dřevěné lampiony **Lumi**. Prodávajícím je **Omnity.One s.r.o.**, značka Lumi je oddělená od ZION: žádné tokeny, žádné peněženky, žádné NFT. Cílem je prodat produkt a příběh, ne kryptoměnu.

- **Doména:** `https://lumi.zionterranova.com` (konfigurovatelné přes `NEXT_PUBLIC_SITE_URL`)
- **Port:** 3200 (Next.js), na serveru za nginx
- **Databáze:** vlastní SQLite (`/opt/zion/data/lumi/lumi.db`), oddělená od ZION MarketPlace
- **Jazyky:** čeština (primární), angličtina, němčina
- **Platby:** bankovní převod s QR (SPD), dobírka, volitelně Stripe karta
- **Doprava:** Zásilkovna (výdejní místo / adresa), osobní odběr

## Co je hotové

| Oblast | Stav |
|---|---|
| Marketing | homepage, kolekce, detail produktu, příběh, průvodce sestavením, svatby, firmy, FAQ, kontakt, doprava, právní stránky |
| Prodej | košík, pokladna, bankovní QR, dobírka, Stripe (env-gated), sklad, množstevní ceny (B2B poptávka) |
| Obsah | 6 produktů (Lumi 2, Mini, Kit, sada 3, personalizace, dárkové balení), cs/en/de |
| 3D | skutečný model `lumi-2.glb` (meshopt) s click-to-load prohlížečem |
| Bezpečnost | prohlášení o ohni + digitální podpis u zboží se svíčkou, serverová validace |
| E-maily | potvrzení objednávky (cs/en/de), notifikace adminovi, odeslání, poptávky, newsletter |
| Admin | `/admin` — objednávky, poptávky, ceny/sklad, faktura k tisku |
| SEO | metadata, OG, JSON-LD, sitemap, robots |

## Lokální vývoj

```bash
cd apps/lumi
cp .env.example .env
# DŮLEŽITÉ: v .env nastav absolutní DATABASE_URL, např.
#   DATABASE_URL=file:/Users/vas/projekty/2.9.6/apps/lumi/prisma/lumi.db
# Relativní cesta se v CLI a za běhu resolvuje od jiného místa.
npx prisma generate --schema prisma/schema.prisma
npx prisma db push --schema prisma/schema.prisma
npm run dev          # http://localhost:3200
```

První načtení `/api/products` naplní prodejní řádky z katalogu. Ruční seed:

```bash
curl -X POST -H "Authorization: Bearer $LUMI_SEED_TOKEN" http://localhost:3200/api/seed
```

### Kde co je

```
src/app/                 routy (marketing, košík, admin, API)
src/components/          UI komponenty
src/data/catalog.ts      produkty — obsah, ceny, sklad, specifikace
src/data/site.ts         navigace, homepage, patička
src/data/pages.ts        svatby, firmy, příběh, průvodce, kontakt, FAQ, doprava
src/data/legal.ts        obchodní podmínky, soukromí, reklamace
src/lib/                 DB, e-maily, faktura, QR, admin session, fire safety
prisma/schema.prisma     SQLite schéma (Product, Order, Inquiry, Subscriber, Setting)
public/images/           fotky (převzaté z MarketPlace / heros)
public/models/lumi-2.glb 3D model
public/downloads/        návod k sestavení (PDF)
deploy/                  systemd unit, nginx vhost, deploy skript
```

### Změna produktu

1. Uprav `src/data/catalog.ts` (texty, fotky, specifikace).
2. Cenu a sklad měň v `/admin` → Produkty (nebo seedem pro nový produkt).
3. Nový produkt: přidej do `PRODUCTS`, spusť `POST /api/seed` (vytvoří chybějící řádky, existující nepřepíše).

### Ceny a pravidla

- Ceny jsou **konečné**, Omnity.One není plátce DPH (`COMPANY.vatPayer = false`).
- Doprava zdarma od 1 500 Kč (`LUMI_FREE_SHIPPING_FROM`).
- Dobírka +45 Kč (`LUMI_COD_FEE_CZK`), vypne se nastavením 0.
- Množstevní slevy pro B2B jsou v `VOLUME_DISCOUNTS` (jen pro poptávky, košík je neaplikuje).

### Fire safety

`src/lib/fire-safety.ts` je jediný zdroj pravdy pro text, který zákazník podepisuje. Při jakékoli změně věty **bumpni `FIRE_CONSENT_VERSION`** — jinak by u objednávek zůstal podpis pod jiným zněním. Server validuje stejnou funkcí jako klient, takže vypnutý JavaScript nic neobejde.

## Platby

### Bankovní převod (výchozí)

Objednávka vrátí QR kód (Czech QR Platba / SPD) a variabilní symbol. Stav se překlopí na `paid` ručně v `/admin` (nebo napojením bankovního watcheru, viz roadmap).

### Stripe karta (volitelné)

Nastav `STRIPE_SECRET_KEY` a `STRIPE_WEBHOOK_SECRET`. Webhook:

```
POST https://lumi.zionterranova.com/api/stripe/webhook
eventy: checkout.session.completed, checkout.session.async_payment_succeeded
```

Bez klíčů se karta v pokladně vůbec nenabízí (`/api/capabilities`).

### Dobírka

Povolená, dokud je `LUMI_COD_FEE_CZK > 0`. Příplatek se počítá server-side.

## E-maily

SMTP přes `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`. Bez SMTP se e-maily **nezahodí**: zapíšou se do logu a objednávka vznikne. Odesílatel `LUMI_EMAIL_FROM`, admin `LUMI_ADMIN_EMAIL`.

## Admin

`/admin` je chráněné uživatelským jménem (`LUMI_ADMIN_USER`, výchozí `admin`), heslem (`LUMI_ADMIN_PASSWORD`) a podepsanou cookie (`LUMI_SESSION_SECRET`, min. 16 znaků). Bez hesla a secretu je admin vypnutý (fail-closed). Session platí 12 hodin, cookie je `httpOnly` + `SameSite=Lax`, mutace navíc kontrolují `Origin`.

## Deploy na EDGE1 (web)

### Jednorázově

```bash
# 1) Adresář a data
ssh zion-v6 'mkdir -p "/opt/zion/APP&WEB/Lumi" /opt/zion/data/lumi && chown -R zion:zion /opt/zion/data/lumi'

# 2) Env (nikdy v gitu)
ssh zion-v6 'install -m 600 /dev/null /etc/zion/lumi.env'
# vyplň podle .env.example, DATABASE_URL=file:/opt/zion/data/lumi/lumi.db

# 3) systémd
scp apps/lumi/deploy/systemd/zion-lumi.service zion-v6:/etc/systemd/system/
ssh zion-v6 'systemctl daemon-reload && systemctl enable zion-lumi'

# 4) dočasný HTTP vhost pro ACME (plný vhost odkazuje na cert, který ještě není)
ssh zion-v6 'cat > /etc/nginx/sites-available/lumi.zionterranova.com.conf <<EOF
server {
  listen 80;
  server_name lumi.zionterranova.com;
  location /.well-known/acme-challenge/ { root /var/www/html; }
}
EOF
ln -sf /etc/nginx/sites-available/lumi.zionterranova.com.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx'

# 5) certifikát (webroot; účet Let's Encrypt už na serveru je)
ssh zion-v6 'certbot certonly --webroot -w /var/www/html -d lumi.zionterranova.com --non-interactive --agree-tos'

# 6) plný vhost z repa
scp apps/lumi/deploy/nginx/lumi.zionterranova.com.conf zion-v6:/etc/nginx/sites-available/
ssh zion-v6 'nginx -t && systemctl reload nginx'
```

> `lumi.zionterranova.com` dnes řeší wildcard DNS na **EDGE1** (62.171.141.136), proto se deployuje tam. Pokud se DNS přesune na EDGE2, dej `LUMI_EDGE_HOST=zion-edge2` a stejným způsobem zopakuj vhost/cert na EDGE2.

### Každý deploy

```bash
# první nasazení (adresář na serveru ještě není):
LUMI_FIRST_DEPLOY=1 ZION_SKIP_NPM_CI=1 bash apps/lumi/deploy/deploy-lumi.sh

# běžný deploy:
ZION_SKIP_NPM_CI=1 bash apps/lumi/deploy/deploy-lumi.sh
```

Skript: build → rsync → `prisma generate` + `db push` na serveru → restart → seed → smoke (`/`, `/api/health`, `/api/products`, `/_next/static/*`).

### Kontaktní údaje

Telefon je volitelný (`LUMI_PHONE`). Bez něj se v kontaktu vůbec nezobrazí — placeholder číslo je horší než žádné.

### Prisma poznámka

Schema má **custom output** `src/generated/prisma`. V monorepu je jeden `node_modules`, takže generování do výchozího `.prisma/client` by přepsalo klienta MarketPlace. Deploy proto kopíruje vygenerovaného klienta i do `.next/standalone/src/generated/prisma`.

## Roadmap (navržené další kroky)

1. **Napojení Zásilkovny API** — výběr výdejního místa z mapy místo ručního textu.
2. **Bankovní watcher** — automatické párování plateb podle variabilního symbolu (stejný pattern jako `zion-l1-watcher` v MarketPlace).
3. **Route-based i18n** (`/en`, `/de`) — lepší SEO pro export; dnes je jazyk klientský.
4. **Katalog PDF** pro svatební koordinátory a firmy (generovat z `src/data/catalog.ts`).
5. **Fotky reálných zákazníků a recenze** — až budou první objednávky; nic falešného.
6. **Etsy / Fler / SAShE** — exportní kanály, viz `heros/Lumi/Lumi.txt`.
7. **Faktura PDF** — dnes tisknutelné HTML (bez Chrome na serveru).
8. **Překlady do dalších jazyků** — struktura `Localized` je připravená.

## Co záměrně není

- Žádné ZION logo, tokeny, peněženky ani seed phrases (na rozdíl od MarketPlace).
- Žádné falešné recenze ani „akce" bez reálného základu.
- Žádné reklamní cookies.
