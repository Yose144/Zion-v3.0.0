# AGENTS.md — website-v2.9 (app.zionterranova.com)

Pravidla pro agenty (Devin, Copilot, WARP) pracující na veřejném ZION webu.

> **Služba:** `app.zionterranova.com` — Next.js 16.2.9, běží jako systemd `zion-website.service` na Edge (`62.171.141.136`), WorkingDirectory `/opt/zion/APP&WEB/website-v2.9`, proxy na `127.0.0.1:3000`.
> **Intro hub:** `zionterranova.com` — statický `public/maintenance.html`, nasazen v `/var/www/maintenance/maintenance.html`, servírovaný systémovým nginxem (ne Next.js).
> **OASIS Web:** `oasis.zionterranova.com` — samostatná aplikace v `/var/www/oasis/`.

---

## 1. Build & Deploy

```bash
# Build (lokálně)
cd APP&WEB/website-v2.9 && npm run build

# Deploy na Edge
rsync -az --delete -e "ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29" \
  src .next public package.json next.config.ts tsconfig.json \
  postcss.config.mjs tailwind.config.ts \
  zion-new:/opt/zion/APP\&WEB/website-v2.9/

# Oprávnění (pokud rsync zachoval lokální ownera)
ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 zion-new \
  "chown -R zion:zion '/opt/zion/APP&WEB/website-v2.9'"

# Restart služby
ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 zion-new "systemctl restart zion-website"

# Intro hub deploy (jen maintenance.html)
scp -i ~/.ssh/zion-edge-post-wipe-2026-07-29 \
  APP\&WEB/website-v2.9/public/maintenance.html \
  zion-new:/var/www/maintenance/maintenance.html
```

**Pozor:** `npm install --omit=dev` na Edge vynechá dev dependencies. Pokud `next.config.ts` importuje dev-only balíčky (např. `@next/bundle-analyzer`), je potřeba je doinstalovat na Edge: `npm install @next/bundle-analyzer`.

---

## 2. Public Content Rules — CO NEZVEŘEJŇOVAT

Tento web je **veřejný** — vidí ho investoři, uživatelé, novináři, konkurence. Platí stejná pravidla jako pro `public/` subtree (viz root `AGENTS.md` §"Rules for public/ edits").

### Zakázané v public copy (news, download page, banner, intro hub):

1. **Interní architektura** — nezveřejňovat názvy interních engine, modulů, crate názvů, názvy souborů, cesty v kódu. Příklad čeho se vyvarovat:
   - ❌ "Miner běží s Trinity engine v backendu"
   - ❌ "UI ukazuje jen ZION stream"
   - ❌ "backend používá crate AuXpow"
   - ✅ "Miner podporuje GPU i CPU těžbu současně"
   - ✅ "Těžba na jedno kliknutí"

2. **Interní verze a plány** — nezveřejňovat interní milestone kódy (např. "3.0.7 All Green", "3.0.8 Full Stack Stable") pokud nejsou schválené pro public roadmap. Roadmap stránka (`/roadmap`) je source of truth pro veřejné milestone.

3. **Server infrastruktura** — žádné IP adresy (kromě veřejného RPC `62.171.141.136`), interní hostname, SSH porty, cesty na serveru (`/opt/zion/...`), systemd service názvy, Docker image size.

4. **Soukromá data** — žádné privátní klíče, mnemonics, GPG klíče, hesla, API tokeny.

5. **Interní názvy** — `V31`, `V3.1 workspace`, `ZionStart`, `PoC-lab`, `HiranV2.x`, `edge-deploy` jsou interní. V public copy používat pouze veřejné názvy: ZION, Trinity Miner, Desktop Miner, OASIS, ZION Liquidity.

6. **Technické detaily implementace** — nezveřejňovat knihovny použité v kódu (Three.js, framer-motion, atd.) v news článcích. V OASIS článcích lze zmínit vizuální koncept, ale ne interní strukturu kódu.

### Co JE v pořádku v public copy:

- Feature popisy (GUI mining, vestavěná peněženka, dashboard)
- Podporované platformy a formáty (Windows, macOS, Linux, AppImage, DEB, DMG, EXE, ZIP)
- GitHub release linky
- CTA (Stáhni, spusť, těž)
- Veřejné milestone z `/roadmap`
- Ecosystem popisy (L1–L6, OASIS, Marketplace, DeFi, Bridge, DAO)

---

## 3. News Articles (NewsFeed.tsx)

Při psaní novinek do `src/components/NewsFeed.tsx`:

- **Tone:** profesionální, stručný, pro veřejnost. Žádný interní žargon.
- **Struktura:** title (1 věta), summary (2–4 věty), tag, date, href.
- **Neodhalovat:** jak miner funguje interně, jaké crate/engine používá, jaká je interní architektura UI vs backend.
- **Odkaz:** vždy na veřejnou stránku nebo GitHub release.
- **CS + EN:** vždy obě jazyky.

---

## 4. Download Page (download/page.tsx)

- Tlačítka pro dostupné platformy = `zion-button-primary` (zlatý gradient).
- Tlačítka pro nedostupné platformy = `zion-button-secondary` + "Coming Soon" label.
- Nezveřejňovat interní build procesy, cross-compile targety, Cargo feature flagy.

---

## 5. Intro Hub (maintenance.html)

- Statický HTML soubor, neprochází Next.js buildem.
- Deploy = scp přímo na Edge, žádný build potřeba.
- ZION theme design system viz `docs/3.0.3/ZIONTHEME.md` — gold→purple→cyan gradient, rainbow accent per karta, glow shadows.
- Footer menu: 5 sloupců s per-column accent bar (Cyan, Amber, Emerald, Teal, Pink).

---

## 6. ZION Theme (design reference)

Viz `docs/3.0.3/ZIONTHEME.md` pro kompletní design system:
- Core colors: Gold `#ffd700`, Purple `#9333ea`, Cyan `#06b6d4`, Blue `#1e3a8a`
- Komponenty: `.zion-rainbow-card`, `.zion-section`, `.zion-button-primary`, `.zion-kicker`, `.zion-cta-banner`
- Per-card accent přes `--rc` CSS variable (RGB triplet)
- Radius MD `1.2rem` (buttons), Radius LG `1.65rem` (panels)
- Shadow glow: `0 0 42px rgba(147,51,234,0.28)`

---

## 7. Verification před deploy

Před nasazením na Edge vždy:
1. `npm run build` — musí projít bez chyb (106 static pages)
2. Zkontrolovat, že v upraveném copy nejsou interní detaily (viz §2)
3. Po deploy ověřit: `curl -s -o /dev/null -w '%{http_code}' https://app.zionterranova.com/<page>` = 200
4. Pro intro hub: `curl -s -o /dev/null -w '%{http_code}' https://zionterranova.com/` = 200
