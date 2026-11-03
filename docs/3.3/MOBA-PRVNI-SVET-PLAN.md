# PRVNÍ SVĚT — plán „úplné MOBA" (2026-11-03)

> **Stav:** hra existuje (3 linky, vlny, věže, Nexy, uzly L5, 4 kouzla, mlha,
> 3 itemy, 2v2–5v5 online, boti). Tenhle plán říká, **co ještě chybí, aby to
> byla úplná MOBA**, v jakém pořadí to dělat a co z toho mění protokol.
>
> **Zdroje (proč zrovna tohle):**
> - [Liquipedia — Dota 2 Mechanics](https://liquipedia.net/dota2/Mechanics) — kompletní seznam systémů (gold, items/recipes, courier, creeps, wards, runes, vision, day/night, deny, buyback)
> - [Liquipedia — Gold](https://liquipedia.net/dota2/Gold) — pasivní zlato, reliable/unreliable, ztráta při smrti, buyback vzorec, gold z věží
> - [ReplayDojo — Dota 2 Mechanics](https://www.replaydojo.com/dota2/mechanics) — XP, deny (50 % XP), Roshan, runy
> - [Wikipedia — Dota 2](https://en.wikipedia.org/wiki/Dota_2) — last hit, sdílení zlata, runy, Roshan
> - [LoL Wiki — Turret](https://wiki.leagueoflegends.com/en-us/Turret) — vrstvení věží (outer → inner → inhibitor), plating, respawn
> - [LoL Wiki — Summoner's Rift](https://wiki.leagueoflegends.com/en-us/Summoner%27s_Rift) + [objectives guide](https://games.gg/league-of-legends/guides/league-of-legends-beginners-guide-summoners-rift-objectives/) — inhibitory (super minioni, respawn 5 min), drak/baron buffy, recall

---

## 1. Kde jsme dnes (kód, ne dojem)

| Systém | Dnes | Standard | Mezera |
|---|---|---|---|
| Linky | 3 rovné linky, minioni jdou po ose | 3 linky s terénem, bushe, řeka | střední |
| Minioni | 3 / 24 s, cíl = nepřítel v dosahu, jinak pochod | 3 jakostní typy (melee/ranged/siege), aggro pravidla, super minioni | velká |
| Věže | 2 / linka + Nexa, ochrana vnější→vnitřní→Nexa | 3 vrstvy + inhibitory, plating, respawn | střední |
| Zlato | jen za zabití (minion 24, hrdina 180, tábor 45–175, uzel 70) | pasivní příjem, last hit, deny, assist, věže, bounty runy | **velká** |
| XP | jen zabiják, level 1–15, +6 % dmg / level | XP radius (sdílení), levely per úroveň kouzel | **velká** |
| Kouzla | 4slotová sada, **pevná síla** | úrovně kouzel (skill points / auto-rank), scaling | **velká** |
| Itemy | 3 (Čepel, Aegis, Sandály), 1 slot = 1 item | 6 slotů, komponenty + recepty, neutrální itemy, prodej | **velká** |
| Jungle | 8 táborů, buffy za zabití, respawn | stacking, runy, boss s Aegis | střední |
| Vidění | mlha (hrdina 14 m…), bez wardů | wardy / sentry, trinket, den-noc | střední |
| Smrt | respawn 6 s + 1,2 s × level | scaling, buyback, ztráta unreliable gold | střední |
| Objek tivy | uzly L5 (vlastní mechanika) | drak/baron/Roshan s týmovým buffem | střední |
| Meta | KDA v HUD, konec podle Nexy/času | scoreboard, GPM/XPM, pozápasový souhrn, obtížnost botů | malá–střední |

**Co je naše a zůstává:** uzly L5 (převzetí = +5 % dmg + vidění), 11 škol kouzel
s vlastní mechanikou, kánon avatarů. Nic z toho se „standardem" nenahrazuje.

---

## 2. Fáze (pořadí je záměrné — každá je hratelná sama o sobě)

### F1 — Ekonomika a postup *(hotovo 2026-11-03, protokol 8)*
Sim + HUD; **mění snapshot → protokol 8**.

- **Pasivní zlato** 2/s (120/min) — bez něj hráč, který prohrává linku, nemá cestu zpět.
- **XP radius 14 m:** zabiják dostane 100 %, spojenci v okruhu 50 %.
- **Deny:** vlastní minion pod 50 % HP jde dorazit; nepřítel nedostane zlato a jen 50 % XP.
- **Assist zlato:** spojenci v okruhu 14 m dostanou 40 % odměny za hrdinu.
- **Ztráta zlata při smrti:** 10 % (strop 200) — smrt musí něco stát.
- **Zlato za věž:** 120 tým + 60 dorazivšímu; **minioni útočí na věže**, takže linka tlačí i bez hrdiny.
- **Úrovně kouzel:** automatické (Q/W/E na 1/4/7/10, R na 6/11/15), síla +22 % za stupeň. Žádné skill pointy — malá hra, HotS model; klient si stupeň spočítá z levelu, takže se neposílá.
- **HUD:** XP bar, zlato, KDA, stupně kouzel.
- **Boti nakupují** podle školy Q (agresivní → čepel, podpůrné → aegis) — jinak by pasivní zlato zvýhodnilo jen člověka.

*Ověřeno: `moba-sim.mjs` 77/77 (12 nových), tsc čistý, live net `proto 8`.*

### F2 — Itemy a obchod *(hotovo 2026-11-03, protokol 9)*
6 slotů, **14 itemů** (6 základních + 8 složených), recepty (komponenty se
spotřebují, platí se rozdíl), prodej za 60 %, efekty damage/armor/HP/mana/
speed/regen/vision. **Protokol:** nová id itemů + zpráva `sell` → 8 → 9.
Opraveno: server multiplayeru zprávu `buy` vůbec nezpracovával.

*Ověřeno: moba-sim 92/92, net moba test 22/22 (buy+sell proti serveru).*

### F3 — Mapa a terén *(hotovo 2026-11-03, protokol 10)*
**Bushe** (8 keřů — jednotka v nich není vidět, dokud se nepřiblížíš na 3,4 m),
**řeka** (vizuál ve středu, nezpomaluje), **třetí věž + inhibitor** v každé
lince (18 věží + 6 inhibitorů + 2 Nexy), super minioni po pádu inhibitoru
a jeho respawn po 5 minutách. **Protokol:** `kind: 'inhibitor'` a `super`
u minionů → 9 → 10.

*Ověřeno: moba-sim 105/105 (13 nových), E2E proti produkci.*

### F4 — Objektivy a runy *(hotovo 2026-11-03, protokol 11)*
**Runy** (bounty +120 zlata / haste +35 % speed / power +30 % dmg) na dvou
místech každé 2 minuty; **boss (Prastarý strážce)** v řece — 3200 HP, respawn
8 min, +14 % HP a +8 % dmg za minutu zápasu, zabití dá 250 zlata, 220 XP
a **Aegis** (jednorázové vzkříšení na 60 % HP, smrt se nepočítá).
Navíc **stupňování kouzel**: mana +15 % a cooldown −7 % za stupeň (stejné
funkce v sim i HUD). **Protokol:** `runes`, `boss`, `aegis` → 10 → 11.

*Ověřeno: moba-sim 119/119 (14 nových), E2E proti produkci.*

### F5 — Vidění a smrt *(hotovo 2026-11-03, protokol 12)*
**Ward** (spotřební item 150 zlata, max 3, klávesa G / tlačítko na dotyku,
vidění 10 m na 90 s) — vidí jen vlastní tým a funguje i proti bushům.
**Buyback** (200 + 50×level, návrat na 60 % HP do základny, cooldown 180 s).
**Respawn scaling** 5 s + 1,5 s × level. **Protokol:** `ward`, `buyback`,
`wards` ve snapshotu → 11 → 12.

*Ověřeno: moba-sim 133/133 (14 nových).*

### F6 — Meta a kvalita *(hotovo 2026-11-03, protokol 13)*
**Scoreboard** (Tab / tlačítko Σ): Lv, K/D, zlato, GPM, XPM, poškození,
léčení — dvě tabulky týmů, tvůj řádek zvýrazněný. Stejné tabulky i na
obrazovce vítězství. **Obtížnost botů** easy/normal/hard: mění jen rozhodování
(přesnost, kadence, ochota ustoupit), nikdy poškození. **Protokol:** `damage`
a `healing` ve snapshotu → 12 → 13.

*Ověřeno: moba-sim 140/140 (7 nových), E2E scoreboard.*
Replay/spectate a den-noc zůstávají jako volitelné nad rámec F6.

---

## 2b. F7 — aktivní itemy *(hotovo 2026-11-03, protokol 14)*

Nad rámec původních šesti fází: **čtyři aktivní itemy** (Skok, Bariéra,
Léčivý prach, Příval) na klávesách **1–6**. Server rozhoduje o cooldownu
i efektu, snapshot nese `itemCooldowns`, klik na slot posílá stejnou
syntetickou klávesu (dotyk bez druhého vstupu).

## 2c. F8 — talent strom *(hotovo 2026-11-03, protokol 15)*

Dvě volby za zápas (**10.** a **15.** úroveň) podle archetypu kouzel
(agresivní / podpůrný / kontrolní), každá ze dvou možností: poškození, HP,
rychlost, vidění, mana, síla kouzel, regenerace. Efekty se sčítají stejně
jako itemy; boti si volí sami. **Protokol:** `talent`, `talents`,
`talentPending` → 14 → 15.

## 3. Co záměrně neděláme

- **Courier** — u 5v5 s krátkým zápasem nemá co řešit; obchod v základně stačí.
- **Stromy a ničení terénu** — vyžaduje skutečný terrain engine (three mesh + kolize).
- **Iluze, stacking táborů, creep blocking** — příliš jemná mechanika na 8minutový zápas.
- **Day/night** — jen pokud bude vidění potřeba dál ladit (F6, volitelné).

---

## 4. Pravidla, která platí pro každou fázi

1. **Sim je jeden modul** (`core/moba/sim.ts`) — klient i server. Nová mechanika
   jde tam, ne do druhé kopie v `MobaOnline`.
2. **Čísla, která klient potřebuje, posílá snapshot.** Klient nikdy nepočítá
   zásah ani cenu — jen kreslí (výjimka: predikce pohybu).
3. **Změna snapshotu = bump `PROTO_VERSION` a deploy net → app.**
4. **Test v `test/moba-sim.mjs` je součástí každé fáze** — bez něj se pravidla
   rozejdou se sítí.
5. **Nová mechanika musí být vidět v HUD** — co hráč nevidí, jako by nebylo.

---

*Souvisí: `apps/nirvana/AGENTS.md` § PRVNÍ SVĚT · `docs/3.2/REPORTS/REPORT_2026-11-02_PRIVNI_SVET_MLHA.md`*
