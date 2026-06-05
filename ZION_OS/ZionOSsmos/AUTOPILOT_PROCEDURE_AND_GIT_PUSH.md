# ZionOS Autopilot Procedure a Git Push Postup

Datum: 2026-04-11

## Ucel dokumentu
Tento dokument fixuje realny provedeni postup pro ZionOS autopilot workflow tak, aby byl reprodukovatelny, auditovatelny a pripraveny na dalsi iterace.

## Co bylo provedeno
1. Vytvoreni master planu a status trackeru.
2. Zaveden baseline autopilot skriptu pro opakovatelne overeni stavu.
3. Implementace command queue mezi dashboardem a agentem.
4. Rozsireni queue o reliability vrstvu (lease timeout, retry limit, failover do failed).
5. Prubezne overeni pomoci cargo check a autopilot skriptu.
6. Commit a push kazde ucelene zmeny na origin/main.

## Realna posloupnost commitu
1. d181fc9a - ZionOS: add masterplan and start autopilot command queue
2. f361d0a2 - ZionOS: add command lease/retry reliability

## Operacni postup (opakovat pri dalsi iteraci)

### 1) Synchronizace kontextu
1. Overit branch a remote.
2. Overit lokalni zmeny jen pro ZionOS scope.
3. Pri velkem mnozstvi unrelated zmen vzdy stage jen explicitni seznam souboru.

### 2) Implementace zmen
1. Implementovat jen jednu uzavrenou funkcni cast.
2. Udrzet backward kompatibilitu API, pokud neni planovane rozhrani verze.
3. Po implementaci okamzite upravit status dokumentaci.

### 3) Validace
1. Spustit dashboard build check.
2. Spustit agent build check.
3. Spustit autopilot baseline skript.
4. Akceptovat existujici non-blocking warningy, pokud nejsou regresi dane zmeny.

### 4) Git hygiene
1. `git status --short -- ZionOS`
2. `git add <explicitni_soubory>`
3. `git commit -m "ZionOS: <kratky, vecny popis>"`
4. `git push origin main`

## Overeni, ze push probehl
1. Lokalne `git log --oneline -n 5 -- ZionOS` musi obsahovat novy commit.
2. `git push` musi vratit aktualizaci refu na origin/main bez erroru.

## Aktualni stav po tomto postupu
1. Masterplan + autopilot tracking existuji a jsou pushnute.
2. Command queue je nasazena v baseline podobe.
3. Reliability vrstva queue je aktivni (lease + retry + fail limit).
4. Baseline checks pro dashboard/agent/miner prochazeji.

## Dalsi navazujici krok
1. Dodat command history filtry (status, limit, offset).
2. Dopsat lightweight integration test retry/lease scenare.
3. Dovest startup policy hardening pro env/cesty dashboardu.
