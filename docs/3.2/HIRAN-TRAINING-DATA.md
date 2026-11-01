# Hiran — tréninková data (EDGE1)

> **Kanonický dokument pro `/opt/zion/hiran`.** Tato data **neexistují nikde jinde**:
> base model ve fp16, konvertovaný gguf, **natrénované LoRA adaptery** a datasety.
> Base model jde stáhnout z HuggingFace, **adaptery a datasety ne** — ty jsou výsledkem
> tréninku na pronajatém GPU (vast.ai). **Nikdy je nemaž, nepřesouvej a nepřepisuj**
> bez manifestu a bez potvrzení, že existuje ověřená záloha.

- **Host:** EDGE1 `62.171.141.136` (vmi3425821), IPv6 `2a02:c207:2342:5821::1`
- **Cesta:** `/opt/zion/hiran`
- **Velikost:** ~23 GB / 94 souborů
- **Stav zálohy:** do 2026-11-01 **žádná** — jediná kopie na EDGE1 (viz §4)

---

## 1. Co tam je

| Cesta | Velikost | Co to je |
|---|---:|---|
| `base/fp16/` | **15 G** | Llama 3.1 8B Instruct ve fp16 — 4 shardy `model-0000{1..4}-of-00004.safetensors`, `model.safetensors.index.json`, `tokenizer.json`, `tokenizer_config.json`. Vstup pro trénink (fp16 = to, co se načítá do traineru). |
| `base/gguf/` | **5,4 G** | `Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf` — kvantovaná konverze pro inferenci (md5 `7a9dd5ff…`, byte-identical s kopií v `/opt/zion/hiran-models/`). |
| `adapters/run1-vast/` | **956 M** | Výstup tréninku run 1: `hiran-lora-vast.gguf` (335 M, LoRA pro llama.cpp) + `hiran-adapter.tgz` (313 M, surový adapter balík). |
| `adapters/run2-core-null/` | **1,5 G** | Výstup tréninku run 2: `hiran-core-lora-ep1.gguf` (335 M) + `safetensors-ep2-adapter_model.safetensors` (335 M) + metadata. |
| `datasets/` | **33 M** | Trénovací data: `dist/` (hotové jsonl), `builders/` (skripty, které je generují), 18× `.jsonl`, 20× `.json`. |

Typy souborů: 20× json, 18× jsonl, 11× metadata, 11× lock, 8× safetensors, 8× py, 3× gguf, 2× pt, 3× jinja.

## 2. Proč to nemůže zmizet

- **Adaptery** (`*.gguf`, `*adapter_model.safetensors`) jsou jediný hmotný výsledek tréninku —
  regenerace = znovu pronajmout GPU, znovu projet data, jiné výsledky (nedeterministické).
- **Datasety** v `dist/` jsou kurátorované corpus soubory; `builders/` je umí znovu sestavit jen
  pokud existují vstupní zdroje, což není garantované.
- **fp16 base** je sice veřejný model, ale 15 GB re-download je čas a riziko (a bez něj nejde
  navázat na existující adaptery bez ověření, že jde o stejnou revizi).

## 3. Manifest — otisk dat

Skript: `infra/scripts/hiran-training-manifest.sh` → nasazený jako
`/opt/zion/scripts/hiran-training-manifest.sh`.

```bash
# na EDGE1 (spočítá sha256 všech souborů, ~1–3 min na 23 GB)
bash /opt/zion/scripts/hiran-training-manifest.sh
#   -> /opt/zion/hiran/MANIFEST.sha256   (formát sha256sum, cesty relativní)
```

**Aktuální manifest (2026-11-01 21:35 CET):**

| | |
|---|---|
| Souborů | **94** |
| Velikost dat | **22,72 GiB** |
| Výpočet | 283 s |
| `MANIFEST.sha256` | 11 228 B, sha256 `1acce5f62720d0f317829d23016b3d034e175f62b9c0b5fde494e8ece46092a1` |

Počty po adresářích: `base/fp16` 15 G / 33 souborů · `base/gguf` 5,4 G / 5 ·
`adapters/run1-vast` 956 M / 9 · `adapters/run2-core-null` 1,5 G / 21 · `datasets` 33 M / 26.

Ověření (na serveru i po obnovení na node PC):

```bash
cd /opt/zion/hiran && sha256sum -c MANIFEST.sha256
```

Manifest **nikdy nehashuje sám sebe** (jinak by nešel reprodukovat). Pokud se změní jakýkoli
soubor, manifest se musí přepočítat — jinak `sha256sum -c` oprávněně zaplane.

## 4. Záloha na node PC

Data jsou 23 GB, takže rsync celého stromu (ne tar) — jde přerušit a navázat, a manifest
se ověřuje po souborech.

**Z node PC (pull z EDGE1):**

```bash
mkdir -p ~/backups/hiran
rsync -avP --partial --info=progress2 \
  -e "ssh -p 2222 -i ~/.ssh/zion-edge-post-wipe-2026-07-29" \
  root@62.171.141.136:/opt/zion/hiran/ ~/backups/hiran/
```

Když IPv4 zlobí (fail2ban), použij IPv6:

```bash
rsync -avP --partial --info=progress2 -6 \
  -e "ssh -p 2222 -i ~/.ssh/zion-edge-post-wipe-2026-07-29" \
  root@[2a02:c207:2342:5821::1]:/opt/zion/hiran/ ~/backups/hiran/
```

**Ověření na node PC:**

```bash
cd ~/backups/hiran && sha256sum -c MANIFEST.sha256
# musí projít 94/94; jakýkoli FAILED = kopie je špatná, zopakuj rsync
# a zkontroluj, že manifest dorazil celý:
sha256sum MANIFEST.sha256   # 1acce5f62720d0f317829d23016b3d034e175f62b9c0b5fde494e8ece46092a1
```

**Kolik to potrvá:** 22,72 GiB; při ~5 MB/s (tak jede EDGE1↔EDGE2) ~80 min, při 20 MB/s ~20 min.
`--partial` umí navázat po přerušení — klidně to pusť opakovaně, rsync přeskočí hotové soubory.

**Obnova (server z node PC), až bude potřeba:**

```bash
# z node PC, pozor na --delete: nejdřív bez něj, ať se nic nesesype
rsync -avP --partial \
  -e "ssh -p 2222 -i ~/.ssh/zion-edge-post-wipe-2026-07-29" \
  ~/backups/hiran/ root@62.171.141.136:/opt/zion/hiran/
# pak na EDGE1: cd /opt/zion/hiran && sha256sum -c MANIFEST.sha256
```

## 5. Pravidla

1. **Nikdy nespouštěj `rm` nad `/opt/zion/hiran`** (ani „jen fp16", ani „jen gguf").
   Base model sice jde stáhnout znovu, adaptery a datasety ne.
2. **Nepřesouvej soubory mezi `base/`, `adapters/`, `datasets/`** — tréninkové skripty
   mají cesty zafixované; po každém zásahu přepočítej manifest.
3. **Nepřepisuj adaptery** novým tréninkem na stejné jméno — nový run patří do nového
   `adapters/runN-…/`.
4. Po každém úspěšném tréninku: přepočítat manifest **a** dotáhnout na node PC.
5. Tento strom **není** v `backup-edge.sh` (ten jede SQLite+configy, ~470 MB). 23 GB se
   zálohuje zvlášť tímto postupem.

## 6. Otevřené body

- Po první záloze na node PC zvážit, jestli `hiran/` nepřidat do off-site syncu
  (`ZION_OS/infra/scripts/sync-edge-backups.sh`), aby se záloha nedělala ručně.
- Duplicita: `hiran-models/Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf` je **byte-identical**
  s `hiran/base/gguf/…` (md5 `7a9dd5ff…`). Nechat `base/gguf/` (tréninkové), u `hiran-models/`
  rozhodnout po záloze.
