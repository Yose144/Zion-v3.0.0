# Shared project scenes

`GenesisGarden.tsx` is the single source of geometry, labels, lighting and camera settings for the website preview and Nirvana presentation. Change the scene here rather than copying it into either application.

`DharmaTemple.tsx` serves both Dharma previews. Its La Palma landscape and animated ocean live in `CoastalLandscape.tsx`; sprite labels are shared through `SceneLabel.tsx`.

`TePikoOra.tsx` supplies both Raiatea previews. `LagoonLandscape.tsx` adds the beach and mountain backdrop, using the shared ocean renderer with a tropical shallows palette.

Each application maps `@genesis/runtime` in its TypeScript configuration to its own small runtime adapter. This keeps hooks, JSX and Three.js bound to the consuming application's React Three Fiber context and dependency instances. The classic JSX pragma avoids resolving a second JSX runtime from this shared directory.

The application wrappers own the canvas, navigation and browser fallback; the website also supplies its existing fog.
