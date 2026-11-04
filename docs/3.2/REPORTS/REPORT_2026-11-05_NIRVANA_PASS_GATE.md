# Nirvana — ZAP pas odemyká celou aplikaci (bezpečnostní fix)

**Datum:** 2026-11-05 · **Závažnost:** vysoká (paywall obejitelný) · **Stav:**
opraveno a nasazeno (`proto 26`).

## 1. Co bylo špatně

Brána `PassGate` byla jen na `/` a serverová kontrola jen na `/present/*`.
Všechno ostatní bylo **volně dostupné**:

| Route | Stav před |
|---|---|
| `/mars`, `/venus`, `/mercury`, `/earth` | 200 bez pasu |
| `/park`, `/saturn`, `/avatars`, `/hiran` | 200 bez pasu |
| `/multiplayer` | 200 bez pasu (a server pustil i `join`) |
| `/` | brána (jediné chráněné místo) |

Navíc herní HUD (`GameHud`) a chat (`ChatDock`) byly v layoutu **mimo**
bránu, takže na zamčené stránce svítila lišta s přepínáním her a chat.
Stačilo kliknout — a člověk byl ve hře. Přesně to uživatel nahlásil.

## 2. Oprava

**`src/middleware.ts` — jedna brána pro celou aplikaci.**
Bez cookie `zion_nirvana_pass` jde každý dokument na `/?next=<původní cesta>`.
Výjimky: `/` (samotná brána — bez téhle výjimky vznikl redirect na sebe),
`/api/pass`, statické assety a lokální render audit
(`ZION_RENDER_AUDIT=1` + hlavička `x-render-audit: 1`; v produkci se
nenastavuje).

**`app/layout.tsx` — `PassGate` obaluje všechny stránky** a **`GameHud`
i `ChatDock` jsou až za ní**. Na zamčené stránce tedy není ani odkaz do hry.

**Po odemčení se člověk vrací tam, kam šel** (`?next=` → `router.replace`),
takže pozvánka do místnosti nekončí na bráně. Cíl se přijímá jen jako
interní cesta (`/…`, ne `//evil.com`).

**Multiplayer je taky za pasem.** Web kryje middleware, ale vlastní
WebSocket klient by se dostal do hry přímo — proto net služba ověřuje
cookie při `join` a bez ní vrací `pass_required`. Verdikt se cachuje 60 s;
`unreachable` (orákulum mlčí) se chová jako middleware (cookie existuje),
aby výpadek EDGE2 nevyhodil rozehrané hráče.

## 3. Co to rozbilo (a jak je to vyřešené)

- **Audity a E2E** jezdily bez pasu. Teď potřebují jedno z:
  `NIRVANA_AUDIT_HEADER=1` proti lokální instanci s `ZION_RENDER_AUDIT=1`,
  nebo `NIRVANA_PASS_COOKIE=ZAP-…` s opravdovým kódem.
- **Deploy smoke check** čekal `/api/oasis/worlds` 200 — ta je teď za
  branou. Kontrola místo toho ověřuje `/api/pass` (200) a `/mars` (307):
  tím se testuje **nasazení brány**, ne jen že web žije.
- **Serverové testy** netu mají `NIRVANA_NET_REQUIRE_PASS=0`, protože
  nemají cookie.

## 4. Ověření

| Test | Výsledek |
|---|---|
| live, bez cookie | `/mars`, `/venus`, `/mercury`, `/earth`, `/park`, `/saturn`, `/avatars`, `/hiran`, `/multiplayer`, `/present/amenti` → **307** na bránu; `/` → 200 |
| live, prohlížeč bez pasu | `/earth` → `/?next=%2Fearth`, brána, **HUD 0**, chat **0**, odkazů na hry **0** |
| live, zfalšovaná cookie | middleware pustí (200), ale klientská brána zamkne — tlačítko arény **0** |
| live, WS bez pasu | `join tanks` → **`pass_required`** |
| lokálně, audit hook | `/mars` 200, hra se vykreslí; **mobile audit PASSED**, **first-world E2E VŠE OK** |
| deploy smoke | `/` 200, textury 200, `/api/pass` 200, `/mars` 307 |

## 5. Meze

- **Validní pas v prohlížeči jsem netestoval** — nemám ZAP kód. Ověřená je
  cesta „bez pasu" a „zfalšovaný pas"; cesta „platný pas" stojí na stejném
  `/api/pass`, který web používá od 31. 10.
- Middleware kontroluje **přítomnost** cookie, ne platnost (Edge nesmí na
  každý request volat orákulum). Platnost řeší klientská brána, `/api/pass`
  a net služba. Kdo si cookie zfalšuje, nedostane obsah ani hru, ale
  **HTML dokument se vyrenderuje** — Next posílá RSC payload i pro zamčené
  děti. Pro skutečné „server-side only" by musela být brána v každém
  layoutu nebo v middleware s voláním orákula (dražší).
- `ZION_RENDER_AUDIT=1` v produkci **nesmí** být nastavené — jinak by
  stačilo poslat hlavičku. Je to stejný hook, jaký používá
  `scripts/ops/audit-project-scenes.py`.
