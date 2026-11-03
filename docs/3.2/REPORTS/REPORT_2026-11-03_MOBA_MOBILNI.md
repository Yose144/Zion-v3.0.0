# Report — MOBA: mobilní vrstva (F19, 2026-11-03)

> **Zadání:** „rozšiřujeme dál na Mobile Legends úroveň".
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Deployed:** net (proto 17) · app (stejný den)

## 1. Co Mobile Legends dělá hratelným palcem

Tři věci, které nám chyběly:

| | MLBB | U nás před F19 | Po F19 |
|---|---|---|---|
| **Battle spell** | Flicker/Retribution/Heal na vlastním tlačítku | žádný | **Flicker** (V / ⚡, 6 m, 60 s) |
| **Míření** | auto-aim na blízkého nepřítele | tap na zem | **snapAim** do 8 m (jen na dotyku) |
| **Nákup** | doporučený build, jeden ťuk | ruční výběr z 21 itemů | karta **Doporučeno** |

## 2. Implementace

- **Flicker** je serverová schopnost (`useBattleSpell`): posun na bod do 6 m,
  cooldown 60 s, efekt v sim. Klient posílá jen bod — stejně jako ward/sentry.
  Boti ho používají na útěk, takže hráč nemá nefér výhodu.
- **Auto-aim** je čistě klientský: `snapAim(heroes, team, x, z, 8)` vrátí
  nejbližšího živého **nepřítele** k bodu. Zapíná se jen na dotyku
  (`autoAim={coarse}`); v online se bere ze snapshotu, takže přes mlhu
  nepomůže.
- **Rychlý nákup**: karta „Doporučeno" s dalším itemem podle archetypu
  (agresivní: čepel → boty → skok → aegis…, podpůrný: aegis → bariéra…,
  kontrolní: boty → bariéra…).
- HUD: tlačítko Flickeru s odpočtem; dotyk má tlačítko ⚡ vedle wardu a sentry.

## 3. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **183/183** (6 nových: skok 6 m, cooldown, snapAim s mrtvým/nepřítelem/mimo dosah) |
| `npx tsc --noEmit` (app i net) | čistý |
| live | `/net/health` → **proto 17** |

## 4. Meze

- **Jeden battle spell** (Flicker), ne volba ze tří jako v MLBB.
- **Auto-aim jen na hrdiny**, ne na miniony (záměr: minioni se dorážejí ručně).
- **Doporučený build je pevný**, ne adaptivní podle situace.
- **Bez quick-chatu, emote wheelu a MVP obrazovky** — to je sociální vrstva,
  samostatná práce.
- **Flicker nemá cílení přes zeď** (sim je 2D bez kolizí, takže „projde" vždy).

## 4b. Recall (dodatečně, F20)

Channel **4 s**, klávesa **B** / tlačítko ↩ na dotyku. Dokončení teleportuje
hrdinu do základny; **přerušuje ho pohyb, kouzlo, útok i jakýkoli zásah** —
rozhoduje sim, takže se nedá recallovat při útěku. HUD má odpočet i průběh
channelu. Boti recall nepoužívají (pohyb by ho hned zrušil).

Testy: moba-sim **189/189** (6 nových). První běh testu „rušilo monstrum" —
hrdina stál v táboře; správné chování, špatné místo v testu.

## 5. Co dál

1. **Volba battle spellu** před zápasem (Flicker / Heal / Purify).
2. **Quick chat + emotes** (radiální menu).
3. **MVP obrazovka** po zápase (nejvíc dmg/gold/heal).

---

**Souvisí:** `apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — mobilní vrstva ·
commit `a1625f3b8` · plán `docs/3.3/MOBA-PRVNI-SVET-PLAN.md`
