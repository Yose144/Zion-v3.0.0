# Hiran FULL Training — příprava (strategie 2026-11-01)

> **Rozhodnutí 👤:** současné adaptéry = archiv na EDGE, **žádný produkční deploy**.
> 8B model nestačí — další fáze je plnohodnotný trénink na větší kartě.
> Hiran má znát **celý ZION komplexně**. Tenhle dokument = příprava, co udělat
> teď (levné), aby budoucí run na drahé kartě stál za to.

## 1. Co už je připravené

| Věc | Stav | Kde |
|---|---|---|
| Base model | ✅ stažen | EDGE `/opt/zion/hiran/base/` (fp16 15 GB + Q5_K_M gguf) |
| Pipeline | ✅ ověřena E2E | `Hiran/2.3/v21-legacy/finetune/finetune_lora.py` — **+ fix messages/instruction schématu a diversity guard** (sync na rigu) |
| Runtime | ✅ ověřen | `llama-server -m base.gguf --lora[-scaled] adapter.gguf` na EDGE2 (b11065) |
| Validace | ✅ protokol | `docs/3.2/REPORTS/hiran-smoke-prompts.json` (8 held-out promptů, base-vs-adapter, scale sweep) |
| Datové zásoby | ✅ v1 kompletní | viz §3 — **train 7 106 / eval 379**, messages, dedup, replay 21 % |
| Archiv | ✅ | EDGE `/opt/zion/hiran/` = `adapters/`, `base/`, `datasets/` (+`datasets/dist/`) |

## 2. Sizing — co „FULL training" reálně znamená

Poctivě: **plný fine-tune 8B na 24 GB kartu nejde** (AdamW = ~4× velikost modelu
v paměti: 8B fp16 váhy 16 GB + grad 16 GB + optim stavy 64 GB ≈ 96+ GB).
Varianty na pronajaté GPU:

| Karta | Cena ~ | Co unese | Pozn. |
|---|---|---|---|
| RTX 3090/4090 **24 GB** | $0.15–0.25/h | QLoRA ≤13B; full-FT ~1–2B | = zatím co máme, jen rychleji |
| A6000/L40 **48 GB** | $0.4–0.7/h | **QLoRA 70B** (tight); full-FT ~7B jen s 8bit optim + offload | sweet spot cena/výkon |
| A100/H100 **80 GB** | $1–2.5/h | **QLoRA 70B pohodlně**; full-FT 8B s DeepSpeed/8bit optim (~65 GB) | „plnohodnotný" tier |
| 2× A100 80 GB | $2.5–5/h | full-FT ≤13B, QLoRA 70B+ | když jedna karta nestačí |

**Doporučení:** A100 80 GB → **QLoRA/LoRA na větším modelu** (Qwen2.5-32B/72B-Instruct
nebo Llama-3.3-70B) nad bohatým datasetem. Větší base + dobrá data >> full-FT malého
modelu na málo datech. Full-FT 8B má smysl až jako druhý stupeň, když data ukážou,
že LoRA kapacita je úzké hrdlo.

## 3. Dataset — v1 hotový (2026-11-01)

**`Hiran/2.3/dist/` = finální artefakty** (taky na EDGE `datasets/dist/`):

| Soubor | Párů | Určení |
|---|---|---|
| `hiran-full-train.jsonl` | **7 106** | trénink — messages, globálně dedup (162 dup out) |
| `hiran-heldout-eval.jsonl` | **379** | held-out eval — 5 % per-source, **nikdy do tréninku** |

Složení train (per-source, eval odečten):
v2.1 curriculum 2 764 · **replay (bactrian cs) 1 520 = 21 %** · zion_core 856 ·
v3_crates 842 · ops (REPORTS) 380 · cross_domain 329 · kb (AGENTS/RUNBOOK/V3-docs) 182 ·
zion_advanced 181 · foundation 41 · rag_synthesis 11 · (buddhism 19 = duplikáty v2.1).

**Buildery** (`Hiran/2.3/data/`): `convert_to_messages.py` (schéma fix),
`build_ops_curriculum.py` (REPORTS→Q&A), `build_v3_curriculum.py` (docstringy+CLI),
`build_replay.py` (Bactrian-X cs→messages, EN-artefakt filtry), `merge_full_dataset.py`
(merge+dedup+eval split, seed 42 reprodukovatelné).

### Coverage map — stav po v1

| Zdroj | Stav |
|---|---|
| `V3/` craty docstringy + CLI | ✅ 886 (`v3_crates.jsonl`) |
| `V3/docs/*.md` + `AGENTS.md` + `infra/RUNBOOK.md` | ✅ 191 (`kb.jsonl`) — RUNBOOK topologie, V3 docs, AGENTS pasti |
| `docs/3.2/REPORTS/*.md` ops paměť | ✅ 400 (`ops.jsonl`) |
| Replay general čeština ~20 % | ✅ 1 600 (`replay.jsonl`) — Bactrian-X cs, filtrované |
| `canon/` lore | 🟡 19 buddhism (v rámci v2.1) — rozšířit až s maitreya fází |
| V3 docs → *přepsané* reálné otázky | 🔲 v2 — teď doc-driven Q&A, ne příběhové |
| Ops historie git/deploy | 🔲 v2 — částečně pokryto ops+kb |

### Co je v2 rozšíření (až bude karta)

- Cíl 8–15k: přidat ~2–6k párů — doc-dumpy curriculum přepsat na souvislé odpovědi
  (teď jsou faktické, ale těžkopádné), více V3 docs, canon lore, git ops.
- Replay škálovat s korpusem (pomer ~20–25 % držet).
- Eval set držet oddělený — při v2 merge *znovu* použít `merge_full_dataset.py`
  se stejným seedem + nové zdroje přidat (stará eval množina zůstane disjoint).

### Pipeline pravidla (z tvrdých lekcí)

1. **Jen `messages` formát** — konvertor `Hiran/2.3/data/convert_to_messages.py`
   (instruction/output → messages + dedup) už existuje a proběhl na všech
   curriculum souborech → `*-messages.jsonl` na EDGE `datasets/`.
2. **Odpověď = skutečná odpověď**, ne doc-dump: přepsat „Explain X: <dump>"
   na otázku + souvislou odpověď (generátor s rubric, ne kopírovka odstavců).
3. **Held-out eval set ~5 %** — oddělený podle témat (nikdy do tréninku);
   eval na curriculum splitu = měří memoraci, ne generalizaci (důkaz: run 1
   eval 0.284 vs. smoke výsledek).
4. **Diversity guard + schema check** — už v `finetune_lora.py` (fail-fast).
5. **Replay mix** — obecné české páry zamíchané přímo do datasetu.

## 4. Checklist před zapnutím drahé karty

- [x] Dataset messages, replay mix (21 %), dedup, **held-out oddělen** — 7 106/379 v `dist/` (v2 rozšíření k 8–15k = nice-to-have, ne blocker)
- [ ] Výběr base modelu (licence! Llama-3.3-70B je gated → HF token; Qwen je pohodlnější)
- [ ] Smoke run na existujícím rigu (30 párů) → ověřit pipeline s novým datasetem
- [ ] Rig: volný disk ≥40 GB (base ~40 GB pro 32B / ~140 GB pro 70B → příp. přes
      huggingface cache čištění), `finetune_lora.py` aktuální verze syncnuta
- [ ] Budget: 70B QLoRA ≈ 4–8× pomalejší než 8B → odhad hodin × cena; mining
      koexistence reálná jen při ≤50 % GPU util
- [ ] Rollback plán: checkpoint každých 50 kroků → rsync na EDGE (disk rigu hlídat!)

## 5. Co zůstává z minula (👤 fronta)

- `zion-miner` na rigu: pořád vypnutý → restart `vastctl launch zion --duty 28`
- Disk rigu ~1,6 GB — před dalším runem vyčistit `outputs/` a staré checkpointy
- `hiran-maitreya` alias zůstává `mockup:true` (žádný deploy — viz strategie nahoře;
  DRAFT unit na EDGE2 zůstává jako reference pro runtime `--lora-scaled`)
- EDGE dostupnost: fail2ban banuje po sérii SSH — mezi spoji pauzovat / batchnout

Související: `docs/3.2/REPORTS/REPORT_2026-11-01_HIRAN_VAST_TRAINING.md` (§7 validace,
§8 null-run), `AIhiran.md` (inventura), `VAST-HIRAN-TRAINING-PLAN.md` (run 1 detail).
