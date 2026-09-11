# Umělá gravitace na stanici ZION Issobella

> *„Prostředí, ve kterém žijeme, se musí přizpůsobit nám, ne opačně.“*

Tento dokument popisuje návrh **umělé gravitace** pro orbitální stanici ZION Issobella. Cílem je umožnit dlouhodobý lidský pobyt ve vesmíru bez zdravotních následků mikrogravitace a zároveň vytvořit unikátní výzkumné prostředí s více úrovněmi gravitace.

---

## 1. Proč umělá gravitace?

Mikrogravitace má vážné zdravotní dopady:

- Ztráta svalové hmoty a kostní hmoty (až 1–2 % kostní hmoty za měsíc).
- Tekutinové posuny — otok obličeje, zrakové změny (VIIP syndrom).
- Kardiovaskulární deconditioning.
- Poruchy spánku, imunity a metabolismu.
- Psychické zátěži z dlouhodobého pobytu v uzavřeném prostředí.

Umělá gravitace je **nejefektivnější dlouhodobá countermeasure**. Měla by být součástí stanice, nikoli luxusem.

---

## 2. Fyzika rotující gravitace

Při rotačním pohybu vzniká odstředivé zrychlení:

```
a = ω² × r

g_eff = (ω² × r) / g₀

kde:
  a     = odstředivé zrychlení (m/s²)
  ω     = úhlová rychlost (rad/s)
  r     = poloměr (m)
  g₀    = 9,81 m/s² (zemská gravitace)
```

| Cílové g | Poloměr r (m) | Otáčky za minutu (RPM) | Δg mezi hlavou a nohama (při 2 m výšce) |
|----------|---------------|------------------------|------------------------------------------|
| 1,0 g    | 100           | 3,0                    | ~0,04 g (4 %) |
| 0,5 g    | 100           | 2,1                    | ~0,02 g (4 %) |
| 0,38 g   | 100           | 1,9                    | ~0,015 g (4 %) |
| 1,0 g    | 200           | 2,1                    | ~0,02 g (2 %) |
| 0,38 g   | 200           | 1,3                    | ~0,008 g (2 %) |

> **Pravidlo:** nižší RPM = menší Coriolisovy efekty, menší motion sickness a menší gradient mezi hlavou a nohama.

---

## 3. Designové možnosti

### 3.1 Variant A — Velký rotační torus (Von Braun styl)

- **Poloměr:** 100–250 m.
- **RPM:** 1,3–3,0 (podle cílového g).
- **Obvodní rychlost:** 40–100 m/s.
- **Výhody:** nejstabilnější, nejnižší Coriolis, možnost 1,0 g zóny, přirozené bydlení.
- **Nevýhody:** velká hmotnost, složitá konstrukce, docking u těžiště.
- **Příklad:** Von Braunův koncept 76 m průměru, 3 patra, 80 lidí (1950s). Issobella by mohla být 200+ m průměru.

### 3.2 Variant B — Malá centrifuga pro posádku

- **Poloměr:** 10–20 m.
- **RPM:** 6–12.
- **Použití:** krátkodenní cvičení, spánek, rehabilitace.
- **Výhody:** kompaktní, levnější, rychlá integrace.
- **Nevýhody:** vysoký Coriolis, nepříjemný dlouhodobý pobyt, nutnost přechodu do mikrogravity.

### 3.3 Variant C — Tether — counterweight systém

- **Princip:** dva moduly spojené lanem, rotují kolem společného těžiště.
- **Poloměr:** 50–500 m (délka lana / 2).
- **Výhody:** minimální konstrukční hmotnost, flexibilní délka, jednoduchá stabilizace.
- **Nevýhody:** složité docking, dynamické namáhání lana, riziko přetržení.

### 3.4 Variant D — Hybrid (doporučeno pro Issobella)

- **Hlavní torus** pro bydlení a sociální život (0,38 g — Mars-like).
- **Centrifuga pro cvičení** (1,0 g, 20 min denně).
- **Mikrogravity lab** u těžiště pro vědu.
- **Tether záloha** pro rozšiřování stanice.

---

## 4. Doporučená konfigurace pro Issobella v1.0

| Parametr | Hodnota | Důvod |
|----------|---------|-------|
| **Hlavní torus** | 200 m průměr (r=100 m) | Dostatečně nízké RPM (~2,1 pro 0,5 g) |
| **Cílové g v toru** | 0,38 g (Mars) pro dlouhý pobyt; 0,16 g (Měsíc) pro experimenty | Snížení hmotnosti, zdravý pobyt, příprava na Mars/Měsíc |
| **Rehabilitační centrifuga** | r=12 m, 1,0 g, 12 RPM | Cvičení a návratová příprava |
| **Mikrogravity lab** | U těžiště trusu | Volný pád pro vědu |
| **Rychlost roztočení** | 0,1 → 1,0 RPM za 24 h | Postupná adaptace posádky |
| **Stabilizace** | Základní rotace + CMG / magnetická torquers | ADCS pro přesné zastavení/otočení |

---

## 5. Konstrukční výzvy

### 5.1 Rotující spoje a těsnění

- Hernetické spojení rotujícího a ne-rotačního dílu.
- Ložiska s minimálním třením a vysokou životností.
- Přenos energie, vody, dat skrze rotující hranici (slip rings / bezdrátové napájení / optické vlákna).
- Pohlcení vibrací mezi rotačním torusem a vědeckými moduly.

### 5.2 Docking a EVA

- Docking se provádí v centrální (ne-rotační) části.
- Přechod mezi rotujícím a ne-rotujícím prostředím přes promáčknutí (rotující manlock).
- EVA v mikrogravitaci u těžiště; výstup do toru zakázán při rotaci.

### 5.3 Sluneční energie a radiace

- Solární panely umístěné na trusu, který se může otáčet nezávisle na slunci (nebo torus otáčet, panely stabilizovat).
- Radiace: torus umístěn uvnitř trusu / stíněn palivovými nádržemi + polymerovým stíněním.

### 5.4 Mikrometeority a degradační faktor

- Torus chráněn Whipple shielding.
- Pravidelná inspekce robotickou rukou.
- Modulární výměna segmentů.

---

## 6. Lidské faktory a psychologie

- **Coriolis efekt:** pohybující se objekty se zdají „odbočovat“. Vysoké RPM zhoršují adaptaci.
- **Gravity gradient:** rozdíl g mezi hlavou a nohama může způsobovat závratě, zvláště při rychlých pohybech.
- **Adaptace:** většina lidí si zvykne na < 3 RPM během dní. Cíl Issobella: < 2,5 RPM v hlavním toru.
- **Děti a vývoj:** 0,38 g může být pro děti unikátní výzkumná zóna (růst kostí, svalů, smyslového vývoje). Etické schválení a monitoring jsou klíčové.
- **Sociální design:** „vesměrná vesnice“ — zóny pro práci, jídlo, hygienu, volný čas, spánek, stejně jako v Saljut/OASIS konceptech.

---

## 7. Výzkumný program

| Fáze | Rok | Cíl |
|------|-----|-----|
| 0 | 2026–2030 | Zemní testování centrifug (animals, analogové mise) |
| 1 | 2030–2035 | LEO test — malá centrifuga na satelitu / modulu |
| 2 | 2037–2040 | Návrh toru pro Issobella, materiály, simulace |
| 3 | 2042–2045 | Výroba segmentů, integrace s kvantovým motorem |
| 4 | 2048–2050 | Spin-up stanice, první dlouhodobá osádka v 0,38 g |
| 5 | 2050+ | Víceúrovňové g zóny, výzkum vývoje dětí, bioregenerace |

---

## 8. Bezpečnostní principy

1. **Postupné roztočení:** 0 → cílová rychlost během 24–72 hodin.
2. **Emergency despin:** možnost okamžitého zastavení rotace za < 15 minut.
3. **Redundance ložisek a motorů:** dvojité / trojitě zálohované systémy.
4. **Těsnění a havarijní uzávěry:** automatické uzavření rotujících spojů při depressurizaci.
5. **Lékařská pohotovost:** 0-g ošetřovna u těžiště, evakuační loď připojena k ne-rotačnímu portu.

---

## 9. Souvislost s kvantovým motorem

- Kvantový motor může sloužit k **momentum management** — kompenzaci krouticích momentů od rotace a orbitálního manévrování.
- Iontový / plazmový motor může pomoci udržovat orbitu a rotaci bez velkých nádrží.
- Vysokofrekvenční konfigurace kvantového motoru může být testována v mikrogravitaci u těžiště, mimo torus.

---

## 10. Otevřené otázky

1. Jaký poloměr toru je optimální pro 0,38 g a < 2,5 RPM?
2. Jak rychle se lidský organismus adaptuje na 0,38 g po letech v 1,0 g?
3. Jaké jsou dlouhodobé účinky 0,38 g na děti a jejich vývoj?
4. Jak nejlépe izolovat vědecké laboratoře od vibrací rotujícího toru?
5. Jaký je optimální poměr bydlení v 0,38 g a denního cvičení v 1,0 g?

---

## 11. Související dokumenty

- [`Architektura.md`](Architektura.md) — celková architektura stanice
- [`Kvantovy_Motor.md`](Kvantovy_Motor.md) — kvantový motor
- [`Lidske_Faktory.md`](Lidske_Faktory.md) — lidské faktory a zdraví
- [`Histori.md`](Histori.md) — historické inspirace (Von Braun, ISS, Freedom)

---

> *„Stanice se musí otáčet, aby lidé nemuseli ztrácet to, co je lidmi činí — zdraví, sílu a pohodlí.“*
