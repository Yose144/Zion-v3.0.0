# ZION Repo Binary Cleanup Candidates

**Datum:** 30. března 2026  
**Účel:** oddělit živé web a desktop assets od historických archivů a build artefaktů, které zbytečně nafukují git historii

---

## 1. Shrnutí

Aktuální repo už bylo očištěno od GGUF modelových blobů, ale git historie je stále výrazně nafouknutá staršími archivy, release balíky a build artefakty.

Nejbližší bezpečný cleanup v `HEAD`:

- přestat trackovat `APP&WEB/website-v2.9/next-build-only.tar.gz`

Další fáze pro history rewrite:

- velké legacy archivy v `Zion-2.9.5-main.zip`
- historické release binárky v `Zion-2.9.5-main/2.9-History/releases/`
- historické externí miner balíky v `Zion-2.9.5-main/2.9-History/external/`
- historické balíky v `Zion-2.9.5-main/2.9.5Public/releases/`

---

## 2. Bezpečné kandidáty k odstranění z HEAD

### A. Website build artefakt

| Cesta | Velikost | Důvod |
|------|----------|-------|
| `APP&WEB/website-v2.9/next-build-only.tar.gz` | ~14 MB | build výstup, nenašla se žádná živá reference v kódu ani deploy flow |

Poznámka:

- v repu je zmíněný jen historicky v audit dokumentaci, ne jako runtime závislost
- je vhodné ponechat ho lokálně mimo git, pokud ho někdo ještě používá pro ruční debug buildů

---

## 3. Kandidáti pro další history rewrite

Tyto položky nejsou potřeba pro běh aktuálního V3 mainnet tracku ani pro živý website/dashboard stack, ale jsou v historii velmi drahé.

### A. Legacy root snapshoty a archivy

| Cesta | Velikost | Doporučení |
|------|----------|------------|
| `Zion-2.9.5-main.zip` | ~824 MB | odstranit z historie při větším rewrite |
| `Zion-2.9.5-main/` | mnoho desítek až stovek MB | ponechat jen pokud je nutná auditní/reference stopa; jinak přesunout mimo hlavní repo |

Poznámka:

- deploy skripty už tyto cesty explicitně vylučují, což potvrzuje, že nejsou součástí aktivního deploy flow

### B. Historické release binárky

| Prefix | Typický obsah | Příklad velikostí | Doporučení |
|-------|---------------|-------------------|------------|
| `Zion-2.9.5-main/2.9-History/releases/` | staré exe a zip release balíky | ~33 MB za soubor | silný kandidát na history cleanup |
| `Zion-2.9.5-main/2.9.5Public/releases/` | historické node/wallet/miner buildy | ~5-7 MB za soubor | kandidát na archivaci mimo git historii |

### C. Historické externí miner balíky

| Cesta | Velikost | Doporučení |
|------|----------|------------|
| `Zion-2.9.5-main/2.9-History/external/gpu-miners/...` | ~17-19 MB za soubor | odstranit z historie, pokud nejde o auditní povinnost |

---

## 4. Co naopak ponechat

### A. Aktivní web assets

| Cesta | Stav | Důvod |
|------|------|-------|
| `APP&WEB/public_html/V2/books/QuantumRevolution.zip` | ponechat | je živě linkovaný z webu a download endpointů |
| `APP&WEB/public_html/images/...` | ponechat | jsou to runtime web assets |
| `APP&WEB/public_html/V2/...pdf/mp4` | ponechat selektivně | část je součást veřejného web obsahu |

### B. Aktivní desktop-agent runtime binárky

| Cesta | Stav | Důvod |
|------|------|-------|
| `APP&WEB/desktop-agent/resources/zion_native_miner_v2_9.exe` | ponechat do separátního packaging refaktoru | aktuální desktop-agent na něj odkazuje |
| `APP&WEB/desktop-agent/resources/zion_native_miner_v2_9_macos` | ponechat do separátního packaging refaktoru | je součást desktop-agent resource modelu |

Poznámka:

- `REPORT.md` je sice označuje jako staré binárky, ale stále mají aktuální reference v desktop-agent kódu, takže teď nejsou bezpečný cleanup cíl

### C. Finetune workflow metadata

| Cesta | Stav | Důvod |
|------|------|-------|
| `scripts/finetune/outputs/*/Modelfile.zion` | ponechat | malé, použité v merge/export a deploy flow |
| `scripts/finetune/data/zion_train.jsonl` | ponechat | je to kanonický dataset referencovaný training skripty |

---

## 5. Doporučené pořadí dalšího cleanupu

1. Odtrackovat `APP&WEB/website-v2.9/next-build-only.tar.gz` a ignorovat budoucí build tarbally v tomto adresáři.
2. Připravit samostatný history rewrite plán pouze pro legacy snapshoty a historické release balíky pod `Zion-2.9.5-main*`.
3. Nechat web assets a desktop-agent resources mimo tento rewrite, dokud nebude hotový separátní packaging a website asset audit.
