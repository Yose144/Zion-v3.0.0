# Revenue Unification — v2.9.8

> Cíl: zachovat CHv3 revenue kvalitu i při sjednoceném Deeksha algoritmu.

## 1) Co musí zůstat beze změny

1. CPU revenue stream (`--group revenue`) aktivní při `revenue.enabled=true`.
2. GPU revenue stream (`--group revenue --gpu`) při kompatibilním módu.
3. NCL stream jako třetí větev dle alokace.
4. Stream scheduler na poolu rozhoduje revenue algo (nefixovat rigidně v mineru).
5. Stejné nonce partition guardy (`main`, `revenue`, `gpu-revenue`).

## 2) Canonical alokace 2.9.8

Výchozí model:
- `ZION: 50%`
- `REVENUE multi-algo: 25%`
- `NCL: 25%`

Povolené runtime override:
- env + config musí mapovat na stejnou interní strukturu,
- žádné paralelní staré klíče bez migrace.

## 3) CHv4.2 parity požadavek

CHv4/Deeksha start path musí umět stejné revenue scénáře jako CHv3:
- main miner start,
- CPU revenue spawn,
- GPU revenue spawn,
- stop/restart lifecycle,
- log prefixy + stats soubory,
- renderer events.

## 4) Incident pravidlo

Při pool reconnect problémech nebo reject stormu:
- revenue větev se může auto-throttle/auto-disable,
- main ZION mining nesmí spadnout,
- všechno musí být auditovatelné v logu.

## 5) Acceptance checklist

- [ ] CHv4/Deeksha + revenue CPU: stabilní 30 min
- [ ] CHv4/Deeksha + GPU revenue: bez contention regresí
- [ ] stream allocation metriky odpovídají konfiguraci
- [ ] žádný `ReferenceError`/spawn crash v Electron main process
- [ ] pool acceptance rate bez reject stormu
