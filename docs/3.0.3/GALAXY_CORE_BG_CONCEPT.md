# Galaxy Core — Background Mode Concept

## Inspiration: "Contact" (1997) wormhole scene

Reference film moment: Ellie Arroway (Jodie Foster) travels through the
wormhole machine and approaches the galactic core — the famous
"they should have sent a poet" scene.

### Visual language

- **Color palette:** Brilliant blue-white core, cyan-to-white star
  streaks, deep indigo/black periphery. Not purple, not gold — cold,
  pure, cosmic blue-white.
- **Motion:** Extreme forward velocity. Stars stretch into long
  radial streaks converging toward a central vanishing point. The
  core grows larger over time, then resets (loop).
- **Density:** Very high streak count near center, thinning toward
  edges. Sense of immense speed — faster than "deep-space" mode.
- **Central glow:** A bright, pulsing white-cyan core at the
  vanishing point. Not a sharp point — a soft, breathing nucleus
  that radiates outward.
- **Atmosphere:** Particles/light rays streaming past the camera.
  Occasional lens flares. A feeling of piercing through layers of
  cosmic dust.
- **Contrast:** Very dark background (#02040a) with high-contrast
  bright streaks. The core should feel like staring into a sun.

### Technical approach

- Starfield: high density (400+), very high speed (6-8), low
  trailOpacity (0.03) so streaks are crisp, not smeary.
- Star color: [200, 230, 255] — cold blue-white.
- Background gradient: radial from center, deep indigo fading to
  near-black. Bright spot at 50% 50%.
- Bubbles: 1-2 very large, very blurred cyan-white bubbles near
  center to simulate the galactic core glow. Low opacity, high blur.
- Optional: a CSS pulsing radial-gradient div at center for the
  "breathing core" effect.

### Mode name

`galaxy-core` — label: "Galaxy Core", description: "Contact approach"

### Files to touch

- `src/contexts/ObservatoryContext.tsx` — add mode type + label
- `src/components/BackgroundOrchestrator.tsx` — add starfield preset
- `src/components/QuantumBubbles.tsx` — add bubble preset
- `src/components/BackgroundToggle.tsx` — add config entry

### Tuning notes

- If streaks feel too chaotic, lower density to ~350.
- If core glow is too subtle, increase bubble size to 500+.
- Speed 6-8 gives the "Contact" warp feel. Below 5 feels like
  regular deep-space.
- trailOpacity 0.03-0.05 keeps streaks sharp. Higher values smear.
