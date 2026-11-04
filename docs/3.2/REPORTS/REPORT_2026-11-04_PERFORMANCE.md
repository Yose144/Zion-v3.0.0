# REPORT 2026-11-04 — Výkon napříč appkami (assety, cache, Vánoce)

**Zadání (👤):** „optimalizuj všechny apps na max performance, pak udělej report a push na git."
**Rozsah:** `apps/website-v2.9` (app.), `apps/MarketPlace` (market.), `apps/IntroPage` (apex), `apps/nirvana`, `apps/OasisWeb`, `apps/pool-ui`.
**Metoda:** měřeno na živých URL (`curl -D`), ne odhadem.

---

## 1. Největší nález — statické assety se revalidovaly při každém přechodu

Produkční hlavičky **před** změnou:

| URL | Cache-Control |
|---|---|
| `app…/images/home/christmas-kingdom.webp` | *žádná hlavička* (Next posílal `no-cache`) |
| `market…/vanoce/hero/zion-pass-wide.webp` | `public, max-age=0` |
| `zionterranova.com/images/market-open.webp` | `no-cache` |

Prohlížeč tedy musel u **každé** stránky znovu ověřovat každý obrázek — u homepage se to týká 9 slajdů slideru + karet + novinek. `/_next/static/*` přitom `immutable` už měl, takže problém byl jen v obrázcích.

**Změna (nginx, EDGE2):** nová `location` s regexem na obrázky/fonty ve všech třech vhostech:

```nginx
location ~* \.(webp|avif|png|jpe?g|gif|svg|ico|woff2?|ttf|otf|mp4|webm)$ {
    proxy_pass http://127.0.0.1:3000;   # app; market má :3100, apex servíruje z disku
    proxy_hide_header Cache-Control;    # Next posílá no-cache — přepisujeme
    add_header Cache-Control "public, max-age=604800" always;
    access_log off;
}
```

**Proč 7 dní a ne `immutable`:** sezónní edice přepisují **stejná jména** souborů (dnes `christmas-kingdom.webp`). `immutable` by u klienta zamkl starý obrázek na rok. 7 dní + ETag revalidace = rozumný kompromis.

**Ověřeno živě:** všechny tři domény vrací u obrázků `public, max-age=604800`; HTML zůstává `no-cache`/`s-maxage=60`.

---

## 2. Rekomprese obrázků (bez změny cest, tedy bez zásahu do kódu)

Prošel jsem JPEGy nad 250 kB a překomprimoval **na místě** (stejný název → nemusí se měnit DB ani JSX):

| Skupina | Před | Po |
|---|---|---|
| `textures/*.jpg` (planety, 2× web + nirvana) | 4,7 MB | 2,1 MB |
| `milkyway-eso-4k.jpg` (pozadí oblohy, 4k → 2560 px) | 3,0 MB | 0,7 MB |
| MarketPlace produktové fotky + `rasta-hero` | 3,6 MB | 2,0 MB |
| Web loga + hero stránek (bodhi-lanka, golden-republic…) | 2,9 MB | 1,4 MB |
| **Celkem** | **22,2 MB** | **9,2 MB** |

Úspora **12,9 MB**; největší jednotlivý skok `milkyway-eso-4k.jpg` **3 042 → 699 kB** (4× menší, na obloze nepoznat).

---

## 3. Mrtvá váha — 26,4 MB originálů, které web nepoužívá

Web má u velkých motivů **`.webp` varianty** a ty také používá (`/images/te-piko-ora/hero.webp`). Originální PNG/JPG (často 2,5–3,3 MB) zůstaly na disku a **nikde se na ně neodkazuje**.

Smazáno 15 souborů (**26,4 MB**): `te-piko-ora`, `nova-amerika`, `dharma-temple`, `genesis-garden`, `amenti`, `kailash`, `maria-del-camino`, `bodhi-lanka`, `golden-republic-bohemia` — vždy `hero`/`concept-og` originál s existujícím `.webp` siblingem.

**Kontrola, že nic nespadlo:** 10 stránek (`/terranova/*`, `/l5-free-world`), 38 obrázků, **0× 404**.

---

## 4. Vánoční balíček ZION_APP_CHRISTMAS_2026

27 WebP (q78, method 6) nasazeno do `apps/website-v2.9/public/images/**`; všechny **ověřeny SHA256 proti `manifest.json`** lokálně i přes HTTP. Karta ZION Archive dostala pevný `aspect-[16/9]` — dřív `lg:h-full` + `object-cover` ořezával krajní postavy širokého motivu.

---

## 5. Co jsem změřil a nechal být (a proč)

- **`/_next/static/*`** už `max-age=31536000, immutable` — není co řešit.
- **gzip** běží na všech třech doménách (`content-encoding: gzip`). Brotli by ušetřil ~15 % navíc, ale vyžaduje modul v nginx — mimo „appky".
- **`apps/IntroPage/public/legacy|portfolio` (86 MB JPEG)** — archivní galerie, které se z hlavní stránky nenačítají. Rekomprese by ubrala kvalitu historickým fotkám bez užitku pro uživatele; **nedotčeno**.
- **`apps/nirvana` textury** jsou rekomprimované v repu, ale nasadí se až s nejbližším `deploy-nirvana.sh` (samostatný deploy s proto-checkem; nemíchal jsem ho do této dávky).
- **JS bundle** — bez zásahu. Snižovat first-load JS znamená měnit importy komponent (dynamic importy, odstranění závislostí) a to je změna chování, ne optimalizace assetů; na tuhle dávku příliš rizikové.

---

## 6. Ověření

- `app.zionterranova.com` 200, `market.zionterranova.com` 200, `zionterranova.com` 200.
- `website-v2.9`: `next build` ✓ (compiled 22,6 s), `tsc` čistý.
- `MarketPlace`: `next build` ✓, smoke po deployi OK (`/api/health` healthy, `/api/shop/products` odpovídá).
- Live velikosti: `milkyway 699 kB` (bylo 3 042), `2k_mars 287 kB` (bylo 733), `rasta-hero 285 kB` (bylo 800), `heart2012 668 kB` (bylo 933).

---

## 7. Zálohy a rollback

- nginx: `/etc/nginx/backups/*.bak-assetcache-<ts>` (3 vhosty), `nginx -t` před reloadem.
- Web: `/opt/zion/APP&WEB/website-v2.9/.next/standalone.before-20261104T203815Z`.
- Market: standardní deploy rollback (`deploy-marketplace.sh` drží předchozí artefakt).
- Smazané originály jsou v git historii (`git log --diff-filter=D -- <cesta>`).
