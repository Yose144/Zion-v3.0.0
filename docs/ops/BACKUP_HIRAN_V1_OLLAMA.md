# Záloha Hiranyagarbha v1 z produkčního Ollama serveru (`zion-expert` vs `hiranyagarbha-v1`)

**Účel:** mít lokální kopii starého fine-tunovaného modelu **v1** před plnou náhradou za Hiran v2 / v2.1 — pro regression testy, srovnání kvality a případný rollback inference.

**Nevkládej** celé GGUF ani celý `.ollama/models` adresář do gitu — GitHub limit ~100 MB; drž zálohu mimo repo nebo v Releases/LFS.

---

## 0. Ověřený zdroj (květen 2026)

Na hostiteli **`root@91.98.122.165`** (`hostname`: **Zion2**, SSH klíč `~/.ssh/zion_hetzner_key`) běží Ollama s modelem **`hiranyagarbha-v1:latest`** (cca **5.7 GB** v blobu `sha256-c8fd1ad3719…`). Reference zálohy v tomto repu je gitignorovaný strom **`HiranV2.1/lineage/v1-ollama-prague/`** (kompletní store); textové kopie metadat jsou též v **`HiranV2.1/curriculum/meta/`**.

Deploy konfigurace (`zion.toml`) zmiňuje `default_server = "prague"` — SSH alias **`Host prague`** v lokálním `~/.ssh/config` nemusí existovat; **vždy ověř** skutečné IP/hostitele a `ollama list` před kopírováním.

---

## 1. Kde dnes web čeká Ollama

V repozitáři je výchozí URL pro Next.js proxy (`APP&WEB/website-v2.9/src/app/api/ai-chat/route.ts`):

- `OLLAMA_API_URL` — pokud není v `.env`, fallback je `http://91.150.160.38:11764`
- modelový tag ve fallbacku: **`zion-expert`**

Ta IP může být jiný endpoint (NAT, reverse proxy, jiný uzel) než stroj se samotným Ollama datastore; **nemusí platit**, že SSH na `91.150.160.38:22` doběhne. Na některých instalacích se v1 tag liší (**`zion-expert`** vs **`hiranyagarbha-v1`**). **Vždy ověř** na produkci (`ollama list`), který host a tag používáš pro zálohu.

---

## 2. Ověření na serveru (SSH)

```bash
# Zvol uživatele a host dle tvé konfigurace (zion.toml deploy / vlastní inventář).
# Příklad ověřeného hostitele se v1 pod názvem hiranyagarbha-v1: root@91.98.122.165 (Zion2).
ssh -i ~/.ssh/zion_hetzner_key root@<OLLAMA_HOST>

# Seznam modelů Ollama
ollama list

# Detail a Modelfile (důležité pro obnovu) — nahraď <MODEL_TAG> hodnotou z výpisu výše (např. zion-expert nebo hiranyagarbha-v1)
ollama show <MODEL_TAG>
ollama show <MODEL_TAG> --modelfile > /tmp/v1.Modelfile
```

Pokud běží Ollama v **Dockeru**:

```bash
docker ps | grep -i ollama
docker exec -it <container> ollama list
```

Hledej volume nebo mount, kde jsou blobs (typicky cesta s `models` uvnitř kontejneru nebo bind na hostitele).

---

## 3. Co zálohovat

| Artefakt | Proč |
|----------|------|
| **Modelfile** | Obnovíš stejný `FROM` + parametry + SYSTEM |
| **Adresář modelů Ollama** | Shrnuté `sha256` blobs + manifesty — kompletní offline kopie |
| Volitelně **samostatný `.gguf`**, pokud Modelfile odkazuje na konkrétní soubor na disku | Jednodušší přenos bez celého Ollama store |

Na Linuxu (nativní Ollama pod rootem) bývá kořen:

- `/root/.ollama/models/`

nebo (systemd / jiný user):

- `~/.ollama/models/`

Struktura obvykle:

- `manifests/` — JSON s vrstvami modelu
- `blobs/` — skutečná data vah

---

## 4. Stáhnout na lokální Mac (příklad)

Z lokálního počítače (vytvoř si cílovou složku mimo git, nebo použij gitignorovaný `HiranV2.1/lineage/` — např. vnoř složku k datům jako `…/lineage/v1-remote-${DATE}/`):

```bash
DEST=~/backups/ollama-v1-$(date +%Y%m%d)
mkdir -p "$DEST"

# Modelfile (text) — nejdřív ho na serveru vygeneruj (viz krok 2) nebo přepiš přímo:
# ssh ... 'ollama show <MODEL_TAG> --modelfile' > "$DEST/v1.Modelfile"

scp -i ~/.ssh/zion_hetzner_key root@<OLLAMA_HOST>:/tmp/v1.Modelfile "$DEST/"  # pokud jsi použil /tmp výše

# Celý Ollama models store (může být několik GB — ověř du -sh na serveru)
rsync -avz --partial --progress -e "ssh -i ~/.ssh/zion_hetzner_key -o StrictHostKeyChecking=accept-new" \
  root@<OLLAMA_HOST>:/root/.ollama/models/ \
  "$DEST/ollama-models/"
```

Cesty na serveru uprav podle `ollama` user home a výstupu `docker inspect` pokud jde o kontejner.

---

## 5. Lokální obnova (kontrola)

```bash
# Pokud máš zkopírované blobs+manifests do ~/.ollama/models/ (záloha uživatelského layoutu)
ollama list
ollama run <MODEL_TAG> "Krátký test ZION"

# Nebo z uloženého Modelfile + GGUF na cestě z něj uvedené v řádku FROM
ollama create v1-local-backup -f ~/backups/.../v1.Modelfile
```

---

## 6. Souvislosti v repu

- Upgrade plán Hiranyagarbhy: [`HIRANYAGARBHA_UPGRADE_PLAN.md`](../../HIRANYAGARBHA_UPGRADE_PLAN.md); **operativní plán v2.1:** [`PLAN_v2.1.md`](../../HiranV2.1/PLAN_v2.1.md)
- Koncept v2.1: [`Hiran_v2.1.md`](../../HiranV2.1/Hiran_v2.1.md)
- Fine-tune pipeline / GGUF: [`HiranV2.1/finetune/README.md`](../../HiranV2.1/finetune/README.md), [`gpuVast.md`](../../HiranV2.1/gpuVast.md)

---

*Při změně produkční IP nebo portu aktualizuj `OLLAMA_API_URL` v prostředí webu a tento runbook.*
