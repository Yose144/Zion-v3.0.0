# Transliterace jmen v OASIS kánonu — stav a pravidlo

> **Stav: 2026-11-05** · měřeno na **404 publikovaných profilech** (`apps/website-v2.9/public/data/oasis/profiles/`)
> a na **205 kánonech** (`docs/docs2.9/ZION_OASIS/SACRED_TRINITY/`).
> Tento dokument je podklad pro jazykovou korekturu — **ne** návod na slepou náhradu.

---

## 1. Pravidlo

| Text | Přepis | Příklad |
|---|---|---|
| **anglický** (`*.en.md`) | IAST / anglický úzus | Krishna, Vishnu, Shiva, Rama, Sita, Lakshmi, Sarasvati, Hanuman, Ganesha, Radha, Arjuna |
| **český** (`*.cs.md`) | český přepis | Krišna, Višnu, Šiva, Ráma, Síta, Lakšmí, Sarasvatí, Hanumán, Ganéša, Rádhá, Ardžuna |

Mantry a názvy děl zůstávají v původním znění v obou jazycích (`Hare Krishna Maha-Mantra`,
`Bhagavad Gita`, `Shikshashtaka`), stejně jako názvy souborů a odkazy.

---

## 2. Naměřeno (2026-11-05)

### Anglické profily — **čisté** ✅

| český tvar | výskytů | anglický tvar | výskytů |
|---|---:|---|---:|
| Krišna | 0 | Krishna | 345 |
| Višnu | 0 | Vishnu | 36 |
| Šiva | 0 | Shiva | 19 |
| Ráma | 0 | Rama | 68 |
| Lakšmí | 0 | Lakshmi | 38 |
| Hanumán | 0 | Hanuman | 59 |
| Rádhá | 0 | Radha | 95 |
| Ardžuna | 0 | Arjuna | 104 |
| Síta | **0** (bylo 38) | Sita | 14 |

**Opraveno 2026-11-05:** „Síta" se dostala do **17 anglických pramenů** (59 výskytů) — v EN
profilech zůstalo 0, v CS zůstává „Síta" správně (26×).

### České profily — **smíšené napříč soubory, ale konzistentní uvnitř** 🟡

| český tvar | výskytů (souborů) | anglický tvar | výskytů (souborů) |
|---|---:|---|---:|
| Krišna | 83 (13) | Krishna | 122 (8) |
| Ráma | 36 (18) | Rama | 18 (3) |
| Lakšmí | 7 (3) | Lakshmi | 31 (5) |
| Sarasvatí | 29 (7) | Sarasvati | 8 (2) |
| Ardžuna | 59 (8) | Arjuna | 4 (4) |
| Rádhá | 54 (3) | Radha | 18 (1) |
| Višnu | 7 (5) | Vishnu | 18 (5) |
| Šiva | 6 (5) | Shiva | 11 (3) |
| Ganéša | 5 (3) | Ganesha | 1 (1) |
| Dattatréja | 1 (1) | Dattatreya | 21 (2) |
| Orákulum | 14 (5) | Oracle | 9 (4) |
| Džagannáth | 8 (1) | Jagannath | 5 (1) |

**Klíčové zjištění:** v **jednom souboru** se oba tvary míchají jen výjimečně (2 soubory:
`40.cs.md`, `48.cs.md` u Oracle/Orákulum — tam jde o kombinaci českého jména postavy
a anglické technické fráze „AI Oracle"). Jinak je **každý soubor vnitřně konzistentní**; mix je
mezi soubory. Čtenář to pozná při přeskakování profilů, ne v jednom textu.

---

## 3. Proč to nejde opravit automaticky

1. **Skloňování** — náhrada základního tvaru rozbije zbytek věty: `Krišna → Krishna`, ale
   `s Krišnou` / `Krišny` zůstane. Vznikne horší mix než dnes.
2. **Mantry a názvy děl** — `Hare Krishna` se nesmí „počeštit" na `Hare Krišna`.
3. **Odkazy a názvy souborů** — `[42_SRI_DATTATREYA.md](42_SRI_DATTATREYA.md)`; náhrada
   v cíli odkazu rozbije cestu (řešeno filtrem řádků s `.md`, ale je to další riziko).
4. **Citace** — anglické citáty v českých textech mají mít anglický přepis.

Proto se 2026-11-05 sjednotily jen **jednoznačné případy** (obecné jméno `kapa` malým písmem
v EN, `Síta → Sita` v EN) a zbytek je na rozhodnutí editora.

---

## 4. Doporučený postup korektury

1. **Rozhodnout jeden tvar na termín** pro CS (doporučení: český přepis — `Krišna`, `Višnu`,
   `Šiva`, `Ráma`, `Síta`, `Lakšmí`, `Sarasvatí`, `Ganéša`, `Hanumán`, `Rádhá`, `Ardžuna`,
   `Dattatréja`, `Džagannáth`, `Kálí`; `Orákulum` pro postavu z Matrixu) a pro EN (IAST).
2. **Skript se slovníkem tvarů** (i skloňovaných): `Krišna/Krišny/Krišnu/Krišnou` atd. —
   náhrada jen celých slov, s výjimkou řádků obsahujících `.md` a bloků s mantrou.
3. Po zásahu: `node apps/website-v2.9/scripts/check-oasis-i18n.mjs` (musí dát 0) a
   `grep -c "Krišna" *.en.md` (musí dát 0).
4. Regenerovat `node scripts/gen-oasis-avatars.mjs` a nasadit profily (hot-file + restart
   `zion-website`), viz `PLAN_OASIS_AVATAR_I18N.md` §5.

**Ověřovací příkazy (bez nich se do korektury nepouštěj):**

```bash
cd apps/website-v2.9/public/data/oasis/profiles
# české tvary v anglických textech (musí být 0)
grep -c "Krišna\|Višnu\|Šiva\|Ráma\|Síta\|Lakšmí\|Hanumán\|Ganéša" *.en.md | grep -v ":0"
# anglické tvary v českých textech (informativní — dnes smíšené)
grep -c "\bKrishna\b\|\bRama\b\|\bLakshmi\b" *.cs.md | grep -v ":0"
```
