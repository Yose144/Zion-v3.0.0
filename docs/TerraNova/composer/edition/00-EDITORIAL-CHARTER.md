# Redakční charta — Composer unified edition

**Účel:** Jedna sada pravidel pro práci v adresáři [`composer/`](../README.md), aby šlo rozlišovat **kanon**, **nástroje** a **literární vedlejší světy**.

---

## 1. Kánon čtyř knih

Pořadí svazků projektu ZION je stabilní:

1. Genesis  
2. Kvantová Revoluce  
3. Ekam Deeksha  
4. **Terra Nova** *(tato kniha)*

Terra Nova uzavírá linii převodem idejí do obyvatelného světa — viz FINAL README.

---

## 2. Tři roviny pravdy (editorial tagging)

Každý odstavec nebo blok má mít čtenáři srozumitelnou **vrstvu** (jak už drží ORG i webové meta):

| Označení | Význam |
|----------|--------|
| 🟢 **REALITA** | Ověřitelný provoz / artefakt existuje (runtime, deployment, měřitelný výsledek). |
| 📋 **ROADMAP** | Záměr v čase — závisí na financích, lidské kapacitě a konsenzu. |
| 🌟 **HORIZONT** | Dlouhá budoucnost — civilizační směr bez závazného termínu. |

Pravidlo: nemíchat vrstvy v jedné větě bez značení — viz kritiku v [`12-PLAN-KNIHY.md`](../../12-PLAN-KNIHY.md).

---

## 3. Kanonickle soubory vs paralelní světy

| Oblast | Platnost |
|--------|----------|
| [`FINAL/*.md`](../../FINAL/) | Primární próza knihy pro markdown kanál a pro stitch `edition/Full.md`. |
| [`FINAL/en/`](../../FINAL/en/) | Oficiální anglický paralelní kanál stejné struktury. |
| [`gemini/`](../../gemini/), [`ORG/TerraNova-CTENARSKA-EDICE.md`](../../ORG/TerraNova-CTENARSKA-EDICE.md) | Inspirace / alternativní řez — merge jen **redakčním rozhodnutím** a PR. |
| Kořenové „legacy“ `.md` v [`docs/TerraNova/`](../../) | Historické nebo rozštěpené návrhy — neurčují automaticky stitch. |

---

## 4. Provozní stitch

- Po každé úpravě kapitoly ve **FINÁLU** přegenerujte stitch:

  ```bash
  bash docs/TerraNova/composer/scripts/build-full-md.sh     # Czech → edition/Full.md
  bash docs/TerraNova/composer/scripts/build-full-en-md.sh   # English → edition/Full-en.md
  ```

- [`FINAL/Full.md`](../../FINAL/Full.md) může žít paralelně jako starší export — Composer bere za autoritu **jednotlivé soubory** podle [`MANIFEST.md`](../MANIFEST.md).

---

## 5. Backlog obsahu (ne blokující Composer)

Z [`12-PLAN-KNIHY.md`](../../12-PLAN-KNIHY.md) plyne mimo jiné:

- Sladění textu s aktuální produkční topologií (např. Prague-only kde platí).
- Jedna ekonomická pravda kolem humanitárního a Issobella podílu podle runtime parametrů.
- Kontrola že NVIDIA / Proroctví přílohy sedí jako přílohy, ne jako „náhodná“ hlavní kapitola.

Composer tyto úkoly **nesřeďuje automaticky** — pouze drží jedno místo, kde je stitch předvídatelný.

---

*Jay Guru Datta · Composer charter*
