# 9.B6 — Public copy sync s mapou v3.3

**Datum:** 2026-10-31 · **Verdikt: PASS po drobném syncu**

## Audit povrchů

| Povrch | Stav |
|---|---|
| `/roadmap` nirvana sekce | ✅ čte `NIRVANA_WORKSTREAMS` ze shared lib; honest disclaimers (Beta ≠ Stable, launch TBD, G8 run → /g8); `updated` bumpnuto 26.→31.10 (cs+en) |
| `nirvana-roadmap.ts` | ✅ 6 workstreams = veřejná horizon vrstva charteru (identity→orchestration→intent chain + oasis/earth/science parallel); header nyní cituje kanonický plán `NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md` (vlny/brány = interní DoD, ne copy) |
| `/zion-archive#plan-v33` (PlanPanel) | ✅ goal/acceptance/prerequisite per workstream, dependency chain vizuál, release-gate box „jen s důkazem", prereq strip → `/roadmap` + `/g8` |
| Link integrity | ✅ všech 6 `chapterSlug` existuje v `books/nirvana.ts` (06–11); `layerHref` = validní routy (/market, /l3-hiran, /l4-oasis, /l5-free-world, /l6-issobella) |

## Rozporů nalezeno: 0 strukturálních

Workstreams mapují na charter Mise Amenti (stejný zdroj jako kanonický plán);
interní vlny W0–W6 / brány KS-1…9 záměrně **nejsou** veřejný obsah — public copy
ukazuje cíle + acceptance, ne operativní DoD. To odpovídá záměru mapy.

## Změny

- `nirvana-roadmap.ts`: header komentář — explicitní citace kanonického plánu
  + dovysvětlení, že KS/V33 brány jsou interní DoD.
- `/roadmap`: `updated` 26. 10. → 31. 10. (cs + en) — odrazuje dnešní revizi.

**Deploy:** pending — drobná změna (komentář + datum), jde s příštím web deployem.
