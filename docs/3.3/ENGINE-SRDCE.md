# Strojovna lodi — `zion-compute`

> **Datum:** 2026-10-29 · **Stav:** specifikace. Žádný crate, žádný kernel, žádný deploy.
> **Kapitola:** [`NIRVANA-V3.3-KAPITOLA.md`](../../NIRVANA-V3.3-KAPITOLA.md)
> **Mimo DoD 3.3.** UE5, pixel streaming a Proof-of-Care na L1 zůstávají NON-DoD ([`NIRVANA-V3.3-PLAN.md`](../../NIRVANA-V3.3-PLAN.md)).

Veřejné jméno v kapitole je **strojovna**. Technické jméno budoucího crate je **`zion-compute`**. Sedí vedle [`V31/L3/ncl`](../../V31/L3/ncl) jako rozšíření NCL, ne jako fork [`V31/L1/miner`](../../V31/L1/miner).

## Proč miner OASIS engine není

`zion-miner` mluví stratumem. Čtyři streamy: ZION (Ekam Deeksha, CPU a volitelně OpenCL/CUDA/Metal), dva GPU AuxPoW, jeden CPU AuxPoW. Pearl a QPoW mají vlastní kernely (`pearl_cuda.rs`, `qpow_*.rs`). Odměna je share proti job targetu a zápis do PPLNS.

OASIS dnes:

- Backend [`V31/L4/oasis`](../../V31/L4/oasis) na `:8094` drží hru (hráči, questy, území). Do L1 nezapisuje (`lib.rs`).
- „AI“ ve hře je HTTP na Hiran, ne lokální GPU fronta.
- [`apps/OasisWeb`](../../apps/OasisWeb) kreslí scénu v prohlížeči (WebGL/WebGPU). To je **render klienta**, ne těžba.
- `zion-ncl` má typy jobů a scheduler; backendy v `backend.rs` jsou placeholdery.
- Pool `ncl_gateway.rs` je HTTP proxy chatu, ne rozvrh GPU.

Sdílený kontrakt práce neexistuje: share ≠ inference batch ≠ scéna. VRAM se už pere mezi QTU, PRL a ZION. Přidat OASIS do `GpuMiner` by sáhlo na cestu, která drží výplaty.

`PocAlgorithm` v `V31/L1/cosmic-harmony/src/algorithm/poc.rs` zůstává inertní. Tahle specifikace ho nezapíná.

## Tři pruhy, jeden orchestrátor času

Jeden proces na stroji těžaře (ne proces poolu) drží kalendář GPU. Desktop agent už pinuje karty (`gpuDevices` proti inferenci). Strojovna ten kontrakt pojmenuje a neslije ho s mutexem poolu.

| Pruh | Kdo počítá | Kontrakt | V téhle spec |
|---|---|---|---|
| **Hash** | Stávající `zion-miner` | Stratum share, AuxPoW, Pearl submit | Orchestrátor jen pouští a zastavuje proces. Kernely, targety a `submit_block` se nemění. |
| **Care** | Budoucí NCL worker | Jeden typ jobu, opt-in, odměna jen na regtestu | Domov položky N3 „miner↔NCL spike“. Výchozí stav vypnuto. |
| **Scene** | OasisWeb v prohlížeči | WebGPU scéna, katalog světů na `:8094` | Server dál jen katalog. Pixel-stream z edge GPU je HORIZONT a mimo DoD. |

Přepnutí pruhu je časový slot, ne sdílený CUDA context mezi hashem a scénou. Když běží Hash, Care nealokuje stejnou kartu. Scene na serveru v 3.3 neběží vůbec.

## Hranice, které se nesmí překročit

- Žádná změna `V31/L1/core` (konsensus, genesis, emise, fee, crypto, P2P) a žádná změna parametrů Ekam Deeksha.
- Care job nesmí volat payout sweep, `record_payout`, ani cestu, která značí UTXO jako utracené.
- Selhání Care (timeout, špatný model, plná VRAM) nesmí shodit stratum session. Hash má přednost, Care se vzdá slotu.
- Žádný job neposílá na mainnet odměnu. Regtest je strop, dokud člověk neotevře samostatný gate.
- Oasis backend dál neupravuje L1 state.
- Orchestrátor nečte pool SQLite a nesahe na `pool.lock()`.

## Kam se to později zapojí

Až bude spec schválená, pořadí implementace (každý krok zvlášť, ne v téhle vlně):

1. Crate `zion-compute` ve workspace: typ jobu, fronta, žádný GPU kód. Naváže na `NclJob` v `V31/L3/ncl`, backendy zůstanou stub, dokud není jeden reálný typ.
2. Opt-in smyčka v mineru (`ZION_NCL_*`, default off), která si řekne o slot a při Hash dutycycle nic nepočítá. Bez úpravy validace share.
3. Sdílená knihovna kernelů až ve chvíli, kdy Hash a Care potřebují stejný CUDA modul. Dnes kernely žijí uvnitř `zion-miner` a ven se netahají.
4. Scene na serveru (pixel-stream) jen jako samostatné rozhodnutí mimo DoD 3.3.

Do schválení téhle spec se v `V31/` nic z strojovny nepíše.
