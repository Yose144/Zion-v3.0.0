# WORK REPORT — 04 Feb 2026

## Kontext
Cíl: dotáhnout „total debug native 2.9.5 complet“ pro mining na Helsinki pool (`77.42.31.72:3333`) – minimalizovat reject rate a mít jasné důvody rejectů.

Poslední fáze se zaměřila na sjednocení miner „meets-target“ logiky (Cosmic/CHv3: `state0(u32)` vs `target(u32)` + endianness) a na to, aby i při ne-ideálních odpovědích poolu (`result:false`) miner poskytl deterministickou diagnostiku.

## Změny (co bylo uděláno)

### 1) Miner: sjednocení default endianness pro Cosmic state0
- Miner teď defaultně používá `cosmic_state0_endian="little"` jako fallback (match pool runtime), místo „big“ fallbacku v jedné z cest.
- Sjednoceno i v desktop-agent bundlované kopii mineru, aby se chování nelišilo podle toho, odkud se miner spouští.

### 2) Miner: lepší handling pro submit odpovědi `result: false`
- Pokud pool vrátí `{"result": false}` bez `error`, miner to nově bere jako reject (ne jen „Unexpected submit result“ bez kontextu).
- Přidá se rate-limited log s meta informacemi (`job_id`, `nonce`, `state0`, `target32`, `endian`), aby šlo rychle ověřit target semantiku.
- Přidána heuristika na auto-detekci endianness mismatch i v této `result:false` větvi (když meta dává jednoznačný signál).

### 3) Git hygiene
- Do `.gitignore` přidáno ignorování `desktop-agent/resources/*.exe` (lokální build artefakty, aby se omylem necommitovaly).

## E2E pozorování (Helsinki)
- Krátké testy (25–40 s) proti `77.42.31.72:3333` stále ukazují vysoký reject count.
- Zásadní nové zjištění: pool často odpovídá `result:false` bez structured `error` (tj. nevrací detailní reject reason).
- Miner nyní umí z těchto rejectů vytáhnout meta a (pokud je to endian mismatch) i automaticky přepnout lokální check.

**Interpretace:** Pokud Helsinki pool stále vrací `result:false` bez `error`, je velmi pravděpodobné, že běžící container není build s „structured reject errors“ (nebo je v submit handleru stále stará větev).

## Doporučený další krok
1) Na serveru ověřit, že běží správný image/build poolu (tag/commit) a že submit handler používá structured `error` odpovědi.
2) Po ověření redeploy a znovu E2E (20–60 s) – cílem je, aby dominantní reject reason byl čitelný (`job_not_found`, `duplicate`, `low_difficulty`, …), ne jen `result:false`.

## Změněné soubory
- `.gitignore`
- `zion_native_miner_v2_9.py`
- `2.9.5/zion_native_miner_v2_9.py`
- `desktop-agent/resources/zion_native_miner_v2_9.py`
- `desktop-agent/src/ui/index.html`
- `desktop-agent/src/ui/renderer.js`
- `2.9.5/zion-native/pool/src/stratum/server_v2.rs`
