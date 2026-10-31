# Scene soundtracks

Drop a track here and the matching scene player picks it up automatically.

| File | Scene | Player |
| --- | --- | --- |
| `matrix.mp3` | MATRIX (lunar base + glass hall) | `SceneSoundToggle` in `apps/nirvana/src/core/shell/SceneSoundToggle.tsx` |

The button stays in the "zvuk se připravuje" state while the file is missing, so the
player can ship before the audio does. Playback always starts from a user gesture
(browser autoplay policy) and loops with a short fade in/out.
