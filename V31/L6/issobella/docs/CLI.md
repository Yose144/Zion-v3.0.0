# CLI Reference — `zion issobella`

> Příkazová řádka pro správu L6 vrstvy a interakci s `zion-issobella` daemonem.

---

## Připojení

Výchozí URL: `http://127.0.0.1:8097`

Daemon musí běžet (systemd `zion-v31-issobella.service` nebo `cargo run -p zion-issobella`).

---

## Příkazy

### Status a parametry

```bash
zion issobella status
zion issobella params
```

### Mise

```bash
# Výpis všech misí
zion issobella missions

# Filtrování podle statusu
zion issobella missions --status planning
zion issobella missions --status launched

# Detail mise
zion issobella mission <id>

# Vytvoření mise
zion issobella create-mission \
  --name "LEO Observatory" \
  --type observatory \
  --budget-zion 50000000 \
  --description "Optická observatoř na LEO." \
  --orbit-altitude-km 550 \
  --target-launch-date "2042-01-01" \
  --funding-address zion1...

# Označení mise jako launched
zion issobella launch-mission <id>

# Obecný přechod stavu (planning, approved, launched, operational, completed, cancelled)
zion issobella update-status <id> --status approved
zion issobella update-status <id> --status operational

# Výdaj z rozpočtu mise
zion issobella spend <id> 1000000 \
  --tx-hash <txid> \
  --recipient zion1... \
  --satellite-count 4

# Odeslání mise k schválení DAO
zion issobella submit-to-dao <id>

# Pozorování konkrétní mise
zion issobella mission-observations <id>
```

### Výzkumné návrhy

```bash
# Výpis návrhů
zion issobella proposals
zion issobella proposals --status submitted

# Detail návrhu
zion issobella proposal <id>

# Vytvoření návrhu
zion issobella create-proposal \
  --title "Quantum Sensor Array" \
  --requested-budget 10000000 \
  --researcher "Dr. N. Tesla" \
  --institution "ZION Research" \
  --abstract-text "Kvantový senzor pro detekci gravitačních vln."

# Schválení / zamítnutí s volitelnou poznámkou
zion issobella approve-proposal <id> --note "Schváleno DAO."
zion issobella reject-proposal <id> --note "Nedostatečná metodologie."
```

### Pozorování

```bash
# Výpis pozorování
zion issobella observations
zion issobella observations --mission-id <id>

# Záznam nového pozorování
zion issobella create-observation \
  --mission-id <id> \
  --observation-type "optical" \
  --data-url "https://..." \
  --metadata "json metadata" \
  --recorded-at "2026-09-11T12:00:00Z" \
  --published
```

### Fond a výdaje

```bash
# Zůstatek L6 fondu
zion issobella balance

# Seznam výdajů
zion issobella disbursements
```

### Hiran AI

```bash
# Stav Hiran AI bridge
zion issobella hiran-health

# Ohodnocení mise Hiranem
zion issobella hiran-evaluate \
  --name "LEO Observatory" \
  --description "Optická observatoř na LEO." \
  --budget-zion 50000000

# Analýza výzkumného návrhu Hiranem
zion issobella hiran-analyze \
  --title "Quantum Sensor Array" \
  --abstract-text "Kvantový senzor pro detekci gravitačních vln."

# Návrh satelitní topologie
zion issobella hiran-optimize \
  --nodes "sat-1" --nodes "sat-2" --nodes "sat-3" \
  --constraints "max-latency 100ms, 3 redundance"

# Generování záznamu deníku
zion issobella hiran-mission-log \
  --mission-name "LEO Observatory" \
  --event "První světelné spektrum exoplanety zachyceno." \
  --timestamp "2026-09-11T12:00:00Z"
```

---

## Stavy misí

Povolené přechody:

- `planning` → `approved` / `launched` / `cancelled`
- `approved` → `operational` / `cancelled`
- `launched` → `operational` / `cancelled`
- `operational` → `completed` / `cancelled`

## Stavy návrhů

- `submitted` → `under_review` / `approved` / `rejected`
- `under_review` → `approved` / `rejected`
- `approved` → `funded`

---

## Chyby a řešení

| Chyba | Příčina | Řešení |
|-------|---------|--------|
| `Issobella unreachable` | Daemon neběží | `cargo run -p zion-issobella` nebo `systemctl start zion-v31-issobella` |
| `Not found` | Špatné ID | Zkontroluj `zion issobella missions` |
| `Invalid mission status transition` | Nepovolený přechod | Použij povolený cílový stav |
| `Insufficient funds` | Výdaj přesahuje rozpočet nebo zůstatek fondu | Zkontroluj `zion issobella balance` |
| `Hiran ... failed` | Hiran AI není povolen | Nastav `ISSOBELLA_HIRAN_ENABLED=true` |

---

*Viz [`V31_SOFTWARE.md`](V31_SOFTWARE.md) pro úplný popis HTTP API.*
