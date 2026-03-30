# 🧹 v2.9.1 CLEANUP TASK LIST
## Konkrétní úkoly k provedení

**Timeline:** Paralelně s v2.9 sprint (22.12 - 3.1.2026)  
**Risk:** VELMI NÍZKÉ (branch approach, veškeré testy)  
**Effort:** 4-5 hodin práce rozptýlené  

---

## 🔴 PHASE 1: DELETE 100% DUPLICATES (30 minut)

### Task 1.1: Verify SHA256 hash duplicates
```bash
# Terminal command k ověření:
sha256sum ai/stratum_client_sync.py ai/mining/stratum_client_sync.py
# Měly by být IDENTICKÉ

sha256sum core/real_blockchain.py
# Zkontrolujte, že soubor existuje
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 5 minut

---

### Task 1.2: DELETE ai/stratum_client_sync.py
```bash
# Příkaz:
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
rm ai/stratum_client_sync.py

# Ověření:
ls -la ai/stratum_client_sync.py 2>&1
# Mělo by říci: "No such file or directory"

# Git:
git add -A
git commit -m "cleanup: delete 100% duplicate ai/stratum_client_sync.py"
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 2 minut

---

### Task 1.3: DELETE core/real_blockchain.py
```bash
# Příkaz:
rm /Users/yeshuae/Desktop/ZION/Zion-2.9-main/core/real_blockchain.py

# Ověření:
ls -la /Users/yeshuae/Desktop/ZION/Zion-2.9-main/core/real_blockchain.py 2>&1
# Mělo by říct "No such file or directory"

# Git:
git add -A
git commit -m "cleanup: delete deprecated core/real_blockchain.py (v2.7.5 legacy)"
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 2 minut

---

### Task 1.4: RUN TESTS - Verify nic nerozbilo
```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
source .venv/bin/activate
pytest tests/ -q --tb=line 2>&1 | tail -10

# Očekávaný výsledek:
# ... X passed, Y skipped, Z deselected ...
# (měl by být stejný jako předtím nebo lépe)
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 1 minut (spuštění) + 15 sekund (čekání)

---

## 🟠 PHASE 2: ARCHIVE LEGACY CODE (1 hodina)

### Task 2.1: Create docs/legacy_v2.7 directory
```bash
# Příkaz:
mkdir -p /Users/yeshuae/Desktop/ZION/Zion-2.9-main/docs/legacy_v2.7

# Ověření:
ls -la /Users/yeshuae/Desktop/ZION/Zion-2.9-main/docs/ | grep legacy_v2.7
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 1 minut

---

### Task 2.2: Create docs/legacy_v2.8 directory
```bash
# Příkaz:
mkdir -p /Users/yeshuae/Desktop/ZION/Zion-2.9-main/docs/legacy_v2.8

# Ověření:
ls -la /Users/yeshuae/Desktop/ZION/Zion-2.9-main/docs/ | grep legacy_v2.8
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 1 minut

---

### Task 2.3: MOVE core/blockchain.py → docs/legacy_v2.7/
```bash
# Příkaz:
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
mv core/blockchain.py docs/legacy_v2.7/blockchain_v2.7.1.py

# Ověření:
ls -la docs/legacy_v2.7/blockchain_v2.7.1.py

# Git:
git add -A
git commit -m "cleanup: archive legacy v2.7.1 blockchain implementation"
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 2 minut

---

### Task 2.4: MOVE tests/2.8.2/ → docs/legacy_v2.8/
```bash
# Příkaz:
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
if [ -d tests/2.8.2 ]; then
  mv tests/2.8.2 docs/legacy_v2.8/tests_2.8.2
  git add -A
  git commit -m "cleanup: archive legacy v2.8.2 test suite"
else
  echo "tests/2.8.2 neexistuje, skip"
fi
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 2 minut

---

### Task 2.5: AUDIT: Is zion/core/blockchain.py used?
```bash
# Příkaz - vyhledat importy:
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
grep -r "from zion.core import\|import zion.core" --include="*.py" src/ tests/
grep -r "from zion.core.blockchain\|import.*zion.core.blockchain" --include="*.py" .

# Výsledek:
# Pokud nic nepřijde = NENÍ POUŽÍVÁNO → archivovat
# Pokud něco přijde = POUŽÍVÁNO → ponechat a dokumentovat
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 5 minut

**Rozhodnutí (po auditu):**
- [ ] Pokud NENÍ POUŽÍVÁNO: `mv zion/core/blockchain.py docs/legacy_v2.7/` + commit
- [ ] Pokud POUŽÍVÁNO: Dokumentovat co to dělá (inline comment nebo README)

---

### Task 2.6: RUN TESTS - Verify archivace nerozbila nic
```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
source .venv/bin/activate
pytest tests/ -q --tb=line 2>&1 | tail -10
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 1 minut

---

## 🟡 PHASE 3: CONSOLIDATE IMPLEMENTATIONS (3-4 hodiny)

### Task 3.1: AUDIT pool implementace - kterou používáme?
```bash
# Příkaz:
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
grep -r "from src.pool\|from.*pool import\|import.*pool" --include="*.py" src/ docker/
grep -r "from zion_native_pool\|zion_native_pool_v2_9" --include="*.py" .

# Výsledek:
# Poznamenat: která pool se SKUTEČNĚ používá v produkci
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 5 minut

---

### Task 3.2: CONSOLIDATE pool - merge/delete/archive
```bash
# Po auditu (Task 3.1) rozhodnout:

# Pokud se používá POUZE src/pool/zion_pool_v2_9.py:
  rm zion_native_pool_v2_9.py
  mv zion/pool/mining_pool.py docs/legacy_v2.8/
  git add -A
  git commit -m "cleanup: consolidate pool implementations to src/pool/v2.9"

# Pokud se používá něco jiného:
  [poznamenat a konsultovat]
```

**Status:** ⏳ TODO (ZÁVISÍ NA Task 3.1)
**Owner:** You
**Effort:** 30 minut

---

### Task 3.3: MOVE Stratum clients do src/pool/network/
```bash
# Příkaz:
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
mkdir -p src/pool/network

# Přesunout soubory:
mv ai/mining/stratum_client.py src/pool/network/
mv ai/mining/stratum_client_sync.py src/pool/network/

# KEEP: zion/mining/stratum_client.cpp (native code, nic neměnit)

# Ověření:
ls -la src/pool/network/stratum_client*.py

# UPDATE: imports všude (grep a find-replace)
# (Toto je manuální práce - možná jich je málo)

# Git:
git add -A
git commit -m "cleanup: consolidate stratum clients to src/pool/network/"
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 1-2 hodin (včetně update importů)

---

## 🟢 PHASE 4: CLEANUP ai/ FOLDER (1-2 hodiny)

### Task 4.1: MOVE ai/tests/ → tests/ai/
```bash
# Příkaz:
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
mkdir -p tests/ai

# Pokud existuje ai/tests/:
if [ -d ai/tests ]; then
  mv ai/tests/* tests/ai/
  rmdir ai/tests
  git add -A
  git commit -m "cleanup: move ai tests to tests/ai/"
else
  echo "ai/tests neexistuje"
fi
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 5 minut

---

### Task 4.2: DELETE ai/__pycache__ a .pyc
```bash
# Příkaz:
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
find ai/ -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
find ai/ -name "*.pyc" -delete

# Ověření:
find ai/ -name "__pycache__" -o -name "*.pyc"
# Nic by se nemělo vrátit

# Git:
git add -A
git commit -m "cleanup: remove ai/__pycache__ and .pyc files"
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 2 minut

---

### Task 4.3: REVIEW ai/ misc scripts
```bash
# Příkaz - seznam souborů:
ls -la ai/*.py | grep -v "^d"

# Rozhodnutí pro každý:
# ✅ KEEP: je jasné proč a používá se
#    - consciousness_mining_ai.py
#    - ai_orchestrator.py
#    - zion_*_ai.py (specialised)
#
# ⚠️ REVIEW: nejasný účel
#    (Pojmenovat konkrétní soubory)
#
# ❌ DELETE: redundantní nebo nepoužité
#    (Pojmenovat konkrétní soubory)
```

**Status:** ⏳ TODO (AUDIT FIRST)
**Owner:** You
**Effort:** 10-15 minut

---

### Task 4.4: RUN FINAL TESTS
```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
source .venv/bin/activate
pytest tests/ -q 2>&1 | tail -20

# Pokud všechno prochází → HOTOVO!
```

**Status:** ⏳ TODO
**Owner:** You
**Effort:** 1 minut

---

## 📋 GIT STRATEGY

### Create branch (FIRST!)
```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
git checkout -b v2.9.1-cleanup main
git push origin v2.9.1-cleanup
```

### During work
```bash
# After each phase:
git add -A
git commit -m "cleanup: phase X - [description]"
git push origin v2.9.1-cleanup
```

### When done
```bash
# Create PR for review:
# https://github.com/your-repo/pulls
# Base: main
# Compare: v2.9.1-cleanup

# After review + tests pass:
git checkout main
git merge v2.9.1-cleanup
git tag -a v2.9.1 -m "Release v2.9.1: Code cleanup and consolidation"
git push origin main v2.9.1
```

---

## 📊 SUMMARY

| Phase | Tasks | Time | Priority |
|-------|-------|------|----------|
| 1: Duplicates | 4 tasks | 30 min | 🔴 HIGH |
| 2: Archive | 6 tasks | 1 hour | 🟠 HIGH |
| 3: Consolidate | 3 tasks | 2-3 h | 🟡 MEDIUM |
| 4: Clean ai/ | 4 tasks | 1-2 h | 🟡 MEDIUM |

**Total:** 17 tasks, 4-6 hodin práce (rozptýleno)

---

## 🎯 RECOMMENDATION

**Kdy to udělat?**

**Option A: Hned (parallel s v2.9 sprintem)**
- Pros: čím dříve tím líp, Phase 1-2 jsou rychlé
- Cons: rozptýlenost pozornosti
- Timeline: Phase 1-2 tenhle týden (30-60 min)

**Option B: Po v2.9 sprintu (early Jan)**
- Pros: fokus na v2.9 sprint
- Cons: o pár dní později
- Timeline: Phase 1-4 v prvním týdnu января

**My vote:** Option A, Phase 1-2 hned
- Jsou to "quick wins" (30-60 minut)
- Nula rizika
- Cleanup je nejhorší když se čeka dlouho
- Zbytek (Phase 3-4) můžeme dělat v prvním týdnu

---

JAI RAM 🕉️

"Tahat si chloupky když čekáme na ostatní je zbytečné.
Pojďme to vyčistit pořádně!"
