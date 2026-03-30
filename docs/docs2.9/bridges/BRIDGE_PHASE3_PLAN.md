# BRIDGE PHASE 3 PLAN – PoW Share Validation (Placeholder Layer)

## 🎯 Cíl
Zavést unifikovanou validační vrstvu pro shares (PoW kandidáty), která:
- Oddělí protokol (Stratum / CryptoNote JSON submit) od samotné hash validace
- Umožní postupný přechod z placeholder implementace → reálné RandomX / CryptoNight hashing
- Poskytne statistiky (accepted, rejected, důvody) a připraví metrické háčky

## 🧱 Architektura
```
Miner -> (Stratum / CryptoNote) -> MiningPool -> ShareValidator -> (bridge data / template) -> Výsledek
```
Komponenty:
- MiningPool: orchestrace příjmu shares + přidání do statistik
- ShareValidator (interface): `validate(input) => result`
- PlaceholderShareValidator: syntetický hash + porovnání s target
- Budoucí RandomX/CryptoNight modul: nahradí placeholder implementaci beze změny API

## 🔌 Rozhraní (z `validator.ts`)
```ts
interface ShareValidationInput {
  jobId?: string;
  nonce: string;
  data: string;
  target?: string;
  difficulty?: number;
  address?: string | null;
  algorithm?: string;
}
interface ShareValidationResult {
  valid: boolean;
  meetsTarget: boolean;
  hash: string;
  effectiveDifficulty: number;
  targetUsed: string;
  reason?: string;
  elapsedMs: number;
}
```

## ✅ Co je implementováno v této fázi
- PlaceholderShareValidator (syntetický FNV-like hash → expand 256-bit)
- ENV přepínače:
  - `POW_VALIDATION_ENABLED`
  - `POW_PLACEHOLDER_TARGET`
- Napojení do: `handleSubmit` (Stratum) a `handleCryptoNoteSubmit`
- Logika tracking: accepted / rejected + `reason`
- Rejected důvody: `low_difficulty`, `malformed_nonce`, `malformed_data`, `validator_error`, `basic_invalid`

## ❗ Omezení Placeholderu
- Neprovádí skutečný RandomX / CryptoNight výpočet
- Nepočítá skutečný target vs difficulty podle kryptografických standardů
- Lexikografické porovnání hash < target je jen hrubý model
- EffectiveDifficulty = (leading zeros * 1000) – pouze orientační číslo

## 🔮 Roadmapa PoW vrstvy
| Fáze | Popis | Poznámky |
|------|-------|----------|
| 3A | Placeholder (dokončeno) | Validace pipeline, API stabilita |
| 3B | Externí worker (CLI) | Spouštění nativního nástroje přes child_process |
| 3C | Native addon (N-API) | Vlastní modul pro RandomX hashing |
| 3D | Multi-algo dispatcher | randomx / cryptonight / kawpow adaptér |
| 3E | Performance tuning | Batch validace, thread pool |

## 🔐 Bezpečnostní poznámky
- Reálná validace musí zabránit „nonce flooding“ → rate limit / fronta
- Přidat anti-DOS: max pending validations
- Track hash rate vs reported miner difficulty (pozor na cheating)

## 📊 Budoucí metriky (Prometheus)
- `zion_pool_validation_total{result="accepted|rejected"}`
- `zion_pool_validation_reason_total{reason="low_difficulty"}`
- `zion_pool_validation_duration_ms_bucket` (histogram)

## 🧪 Smoke Test Návrh
1. Spustit core s `POW_VALIDATION_ENABLED=true`
2. Připojit test miner (mock)
3. Odeslat několik shares s různými nonces
4. Ověřit že rejected počet roste při změně target na přísnější

## 🔄 Přechod na reálný RandomX
Příprava: 
- Vyextrahovat `data` z reálného `blockhashing_blob`
- Vložit nonce na správný offset (CryptoNote template format)
- Hash = randomx_hash(blob) → big-endian/LE normalizace → target porovnání

## 🧩 Další Integrace
Po dokončení PoW validace lze bezpečně přidat:
- Automatické přepočty difficulty (varDiff) podle časování shares
- Odeslání „block candidate“ do bridge při diff >= network difficulty

---
_Log vytvořen: 2025-09-29 (Bridge Phase 3 Plan)_
