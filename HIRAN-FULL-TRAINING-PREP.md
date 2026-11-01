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
| Datové zásoby | 🟡 částečně | viz §3 — messages formát ready, coverage slabé |
| Archiv | ✅ | EDGE `/opt/zion/hiran/` = `adapters/`, `base/`, `datasets/` |

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

## 3. Dataset — jádro přípravy (teď největší leverage)

Současný stav: 3056 párů `curriculum-v2.1` (messages, fungoval) + 1495 párů
curriculum (právě převedeno do messages) + 30 buddhism. **Pokrytí je úzké** —
v2.1 je hlavně persona + CLI basics; curriculum jsou doc-dumpy.

### Coverage map — co Hiran musí znát (cíl ~8–15k párů)

| Zdroj | Obsah → typ párů | Stav |
|---|---|---|
| `V3/` craty (zion-core, pool, miner, agent, ai, wallet, bridge, cli) | docstrings + pub API → „co dělá X", „jak použiju Y", Rust idiom | ✅ 886 párů (`v3_crates.jsonl`) — `build_v3_curriculum.py`; 533 items + 42 CLI (vč. subcommandů) + workspace/layers; ~½ docované API |
| `V3/docs/*.md` | CLI guide, deploy, architektura → Q&A | 🟡 curriculum doc-dumpy → přepsat do reálných otázek |
| `docs/3.2/REPORTS/*.md` | **ops paměť**: v3-tx CLI bug, anchor design, deploy pasti (fail2ban, sharp, next lock), mining duty | ✅ 400 párů (`ops.jsonl`) — `build_ops_curriculum.py`, 76 reportů |
| `AGENTS.md` + `apps/*/AGENTS.md` | topologie, rozhodnutí, „pasti" | 🔲 |
| `infra/RUNBOOK.md` | EDGE/EDGE2/nodes, služby, porty | 🔲 |
| `canon/` (knihy, brand) | lore → maitreya flavor | 🟡 malý dataset |
| Ops historie session (git log + deploy skripty) | „jak se nasazuje X", rollbacky | 🔲 |
| Replay general | ~20 % obecných českých instruction párů (anti-forgetting) | 🔲 **povinné** — jinak se opakuje degradace z §7 reportu |

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

- [ ] Dataset ≥8k párů, messages, replay mix, dedup, held-out oddělen
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
