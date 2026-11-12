# Scene soundtracks

Drop a track here and the matching scene player picks it up automatically.

| File | Scene | Player |
| --- | --- | --- |
| `matrix.mp3` | MATRIX (lunar base + glass hall) | `SceneSoundToggle` in `apps/nirvana/src/core/shell/SceneSoundToggle.tsx` |

## Jak to funguje (od 12. 11. 2026)

Přehrávač **neposílá při načtení stránky žádný request** — zkusí track
přehrát až při prvním kliknutí na „♪ zvuk". Když soubor chybí
(404) nebo formát nehraje, přepne se na syntetizovanou ambienci
(`core/shell/ambience.ts`) a tlačítko zůstane funkční.

Dřív se posílal `HEAD /audio/<slug>.mp3` na každé scéně; soubory
neexistují, takže všech 13 prezentací vyrobilo 404 v konzoli.

Přehrávání vždy začíná gestem (autoplay policy prohlížeče) a smyčkuje
s krátkým fade in/out.
