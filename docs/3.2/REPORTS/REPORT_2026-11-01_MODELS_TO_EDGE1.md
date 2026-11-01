# REPORT — Modely Hirana přesunuty z EDGE2 na EDGE1 (2026-11-01)

> **TL;DR:** `/opt/zion/hiran-models` na EDGE2 držel **12 GB** modelů, z toho **6,1 GB** používal
> jen osiřelý `llama-server` na `:8010` (unit `zion-hiran-maitreya` = `disabled`, gateway na 8010
> vůbec nemíří). Osiřelý proces zabit, tři soubory přeneseny na **EDGE1** (md5 shoda 3/3),
> z EDGE2 smazány. **EDGE2 124 → 118 GB (65 % → 62 %)**, EDGE1 95 → 100 GB (66 % → 70 %).

## 1. Co kde bylo

| Soubor | Velikost | Kdo to používal |
|---|---:|---|
| `hiran-v2.3mini-Q5_K_M.gguf` | 5,5 G | **`zion-hiran-inference.service`** (:8002, CPU fallback pro ai-chat) — **zůstává na EDGE2** |
| `Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf` | 5,4 G | osiřelý `llama-server` :8010 (ruční spuštění 11:32, LoRA test) |
| `hiran-lora-vast.gguf` | 321 M | tentýž osiřelý proces (`--lora-scaled`) |
| `hiran-core-lora-ep1.gguf` | 321 M | žádná unita (tréninkový artefakt) |

`zion-hiran-maitreya.service` je `disabled` a `inactive`, přesto na `:8010` běžel `llama-server`
(pid 4025267) — proces přežil stop unitu. `/etc/zion/hiran-models.json` (routing gatewaye) obsahuje
**0** zmínek o `8010` → žádný alias na něj nemíří, takže zabití nic nerozbilo.

## 2. Provedení

1. `kill 4025267` → `:8010` volný, EDGE2 RAM used 5 757 → 5 757 MB (avail 6,2 G).
2. EDGE1 si soubory **pull-la** z EDGE2 (`rsync -a`, klíč `/etc/zion/keys/edge2-probe`),
   6,40 GB, 15 min při ~6,4 MB/s.
3. **md5 shoda** všech tří (obě strany stejné):
   - `Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf` = `7a9dd5ff…f6aa`
   - `hiran-lora-vast.gguf` = `42cf6508…f732`
   - `hiran-core-lora-ep1.gguf` = `a16ac00f…20a9`
4. Teprve po shodě `rm` na EDGE2.

## 3. Stav po přesunu

| | EDGE2 | EDGE1 |
|---|---|---|
| Disk `/` | **118 G (62 %)** — bylo 124 G (65 %) | **100 G (70 %)** — bylo 95 G (66 %) |
| `/opt/zion/hiran-models` | 5,5 G (jen v2.3mini) | 12 G (všechny 4) |
| Volno | **75 G** | 45 G |

Kontroly po zásahu: `zion-hiran-inference` **active**, `:8002/health` **200**;
`zion-hiran-gateway` **active**, `:8007/v1/models` **200**.

## 4. Meze

- **Duplicita:** `hiran-v2.3mini` leží na obou boxech (md5 `98c10305…` shodné). Na EDGE2 **musí**
  zůstat, protože ho lokálně načítá `zion-hiran-inference` (:8002, fallback když je operátorské PC
  vypnuté). EDGE1 má kopii jako sklad. Uvolnit dalších 5,5 G by šlo jen vypnutím fallbacku.
- **LoRA na 8010 už neběží** — pokud ji někdo bude chtít znovu testovat, musí se spustit ručně
  (unit je `disabled` a gateway ji neroutuje). Modely jsou na EDGE1 v `/opt/zion/hiran-models/`.
- **Transfer 6,4 MB/s** mezi Contabo boxy — při dalších velkých přesunech počítej ~15 min / 6 GB.
- EDGE1 je 4 jádra / 8 GB RAM a inference tam **nepoběží** (Llama 8B Q5 potřebuje ~5 GB + kontext);
  soubory jsou tam jako sklad, ne jako runtime.
