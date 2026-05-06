# Záloha Hiranyagarbha v1 (`zion-expert`) z produkčního Ollama serveru

**Účel:** mít lokální kopii starého fine-tunovaného modelu **v1** před plnou náhradou za Hiran v2 / v2.1 — pro regression testy, srovnání kvality a případný rollback inference.

**Nevkládej** celé GGUF ani celý `.ollama/models` adresář do gitu — GitHub limit ~100 MB; drž zálohu mimo repo nebo v Releases/LFS.

---

## 1. Kde dnes web čeká Ollama

V repozitáři je výchozí URL pro Next.js proxy (`APP&WEB/website-v2.9/src/app/api/ai-chat/route.ts`):

- `OLLAMA_API_URL` — pokud není v `.env`, fallback je `http://91.150.160.38:11764`
- modelový tag: **`zion-expert`**

Skutečný host se může lišit od starších dokumentů („Praha“ / staré IP v historických MD). **Vždy ověř** na produkci, který stroj Ollama skutečně obsluhuje (viz krok 2).

---

## 2. Ověření na serveru (SSH)

```bash
# Zvol uživatele a host dle tvé konfigurace (zion.toml deploy / vlastní inventář)
ssh -i ~/.ssh/zion_hetzner_key root@<OLLAMA_HOST>

# Seznam modelů Ollama
ollama list

# Detail a Modelfile (důležité pro obnovu)
ollama show zion-expert
ollama show zion-expert --modelfile > /tmp/zion-expert-v1.Modelfile
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

Z lokálního počítače (vytvoř si cílovou složku mimo git, nebo použij gitignorovaný `scripts/finetune/exports/`):

```bash
mkdir -p ~/backups/zion-expert-v1-$(date +%Y%m%d)

# Modelfile (text)
scp -i ~/.ssh/zion_hetzner_key root@<OLLAMA_HOST>:/tmp/zion-expert-v1.Modelfile \
  ~/backups/zion-expert-v1-$(date +%Y%m%d)/

# Celý Ollama models store (může být několik GB — ověř du -sh na serveru)
rsync -avz --progress -e "ssh -i ~/.ssh/zion_hetzner_key" \
  root@<OLLAMA_HOST>:/root/.ollama/models/ \
  ~/backups/zion-expert-v1-$(date +%Y%m%d)/ollama-models/
```

Cesty na serveru uprav podle `ollama` user home a výstupu `docker inspect` pokud jde o kontejner.

---

## 5. Lokální obnova (kontrola)

```bash
# Pokud máš zkopírované blobs+manifests do ~/.ollama/models/ (záloha uživatelského layoutu)
ollama list
ollama run zion-expert "Krátký test ZION"

# Nebo z Modelfile + GGUF na cestě z něj uvedené v řádku FROM
ollama create zion-expert-v1-backup -f ~/backups/.../zion-expert-v1.Modelfile
```

---

## 6. Souvislosti v repu

- Upgrade plán Hiranyagarbhy: [`HIRANYAGARBHA_UPGRADE_PLAN.md`](../../HIRANYAGARBHA_UPGRADE_PLAN.md)
- Koncept v2.1: [`Hiran_v2.1.md`](../../Hiran_v2.1.md)
- Fine-tune pipeline / GGUF: [`scripts/finetune/README.md`](../../scripts/finetune/README.md), [`gpuVast.md`](../../gpuVast.md)

---

*Při změně produkční IP nebo portu aktualizuj `OLLAMA_API_URL` v prostředí webu a tento runbook.*
