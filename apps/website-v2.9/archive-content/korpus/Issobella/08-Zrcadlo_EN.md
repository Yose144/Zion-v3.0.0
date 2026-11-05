# ISSOBELLA — Chapter 8: The mirror
## Mirror · L4 ↔ L6 / web — how the station shows itself to people, and where exactly the mirror ends

> *"A mirror that lies is worse than no window at all."*

---

## The Story

The pilgrims once asked Korma: *"When the station does not fly yet, how is it that people see it?"*

Korma led them into a small room where pictures hung on the wall — a sketch of the ring, a table of years, a list of books to read. *"This is a mirror,"* he said. *"It shows what people are to think — and it must show properly, otherwise it lies."*

He pointed to the first picture. *"Here the station is drawn on the page `/l6-issobella`. You see: an orbit of four hundred to five hundred and fifty kilometres, a ring with artificial gravity, a quantum laboratory. But look at what stands next to the picture — *Vision*. Not *Building*. Not *Done*. Vision. A word that tells the truth."*

He pointed to the second picture — the table of years. *"Two thousand and thirty: a laboratory on Earth. Thirty-three: a demonstrator. Thirty-five: a small satellite. Forty-five: station components. Whoever reads the years carefully sees: this is not a flight schedule. It is a road that is still being walked."*

And then he pointed to the third picture — the list of documents. *"And here is the most honest mirror: the library. The architecture of the station, the quantum motor, artificial gravity, human factors, history. Whoever wants to can read exactly what we read. A mirror does not hide its sources."*

*"And where does the mirror end?"* asked the newcomer.

*"Where it would have to lie. If it showed a module in orbit — it lies, there is none. If it showed a balance being spent — it lies, the fund does not spend. If it claimed the quantum motor works — it lies, it is a hypothesis. The mirror ends exactly where the truth ends — and a well-built mirror writes that boundary on its edge, so that no one overlooks it."*

---

## What it means

**Issobella already lives — but only as a mirror.** Not in orbit, but in three places where a person can look at it properly:

**The web `/l6-issobella`** (`apps/website-v2.9/src/app/l6-issobella/page.tsx`) — the public page of the layer. It shows:
- the orbit of 400–550 km and the station modules (Quantum Motor Bay, artificial gravity, research library) — marked **Vision**,
- the roadmap 2030 → 2033 → 2035 → 2045+ — marked **planned / vision**,
- the premine card: 2.5 billion ZION, time-lock block 144 000, admin multisig 3-of-3 + DAO vote,
- document cards leading into the catalogue.

**The catalogue `/docs`** — serves the whole research bundle: `l6-readme`, `l6-architecture`, `l6-quantum-motor`, `l6-artificial-gravity`, `l6-human-factors`, `l6-history` — all mapped to `apps/website-v2.9/public/docs/l6/*.md` (a mirror of `L6data/`).

**The dashboard** — an operator view: the L6 tracker (fund balance, metrics) in `ZION_OS/dashboard/app.py` and the public `MissionControlDashboard`. Read-only — the dashboard shows the fund, but the fund does not spend.

**OASIS** — the L4 layer holds "crystalline worlds"; L6 is so far reflected there only as a story and a direction, not as an operational world.

**The boundary of the mirror** is therefore sharp and readable: the web says *vision*, the catalogue says *research*, the dashboard says *fund*. Nowhere is it claimed that it *flies*. Where the story of the mirror tries to cross the boundary, we repair the mirror — not the truth.

---

## Anchor of truth — verifiable facts

| Image / claim | State | Anchor |
|---|---|---|
| The public page `/l6-issobella` exists, showing the station as a vision (400–550 km, AG, a quantum laboratory) | **LIVE** | `apps/website-v2.9/src/app/l6-issobella/page.tsx` (copy "Vize 2035+/2040+", the premine card) |
| The roadmap 2030 → 2035 → 2045+ on the web | **LIVE** (as a displayed horizon) | `page.tsx` (timeline items `planned`/`vision`) |
| The `L6data/` documents served in the `/docs` catalogue as `l6-*` | **LIVE** | `apps/website-v2.9/src/app/docs/page.tsx` (mapping `l6-*` → `apps/website-v2.9/public/docs/l6/*.md`); the files themselves in `apps/website-v2.9/public/docs/l6/` |
| The premine card: 2.5 bn, lock 144 000, multisig 3-of-3 + DAO | **LIVE** | `page.tsx` (`genesisPremineAmount`, `genesisPremineDesc`); `v3_compat.rs` |
| The dashboard shows L6 metrics (fund, tracker) | **LIVE** (an operator view) | `StatusV3.md` 2026-08-23; `ZION_OS/dashboard/app.py` |
| The L6 world in OASIS | **BUILDING / HORIZON** | OASIS holds L4 worlds; L6 has no operational world of its own in `worlds.ts` |
| "The station exists / flies" | **INVALID CLAIM** | No module in orbit; a horizon of 2040+ |

---

*"A well-built mirror writes the boundary of truth on its edge, so that no one overlooks it."*

**Navigation:** [← Chapter 7: The watcher at the edge](./07-Hlidac-Na-Okraji.md) · [Chapter 9: The pilgrim's way →](./09-Cesta-Poutnika.md)
