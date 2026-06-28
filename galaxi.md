# Galaxy Core Koncept

Cil:
- Filmovy pocit "doleteni do stredu galaxie".
- Cisty visual bez rusivych overlayu.
- Konzistence mezi webem a desktop-agent estetikou.

Zakladni principy:
- Inward starflow (hvezdy smerem do stredu) misto klasickeho outward warpu.
- Jemne mlhoviny ve vrstvach (silver-blue / cyan / purple), ne agresivni neony.
- Hluboky radialni gradient s jasnejsim jadrem a tmavymi okraji.
- Minimalni motion noise: plynuly, monumentalni pohyb.

Rezimy:
- `planet-orbit`: vychozi tyrkysovy profil.
- `desktop-agent`: barvy a kontrast podle desktop-agentu.
- `galaxy-core`: cinematic "Contact" pristup.
- `warp-speed`: samostatny warp tunel.

UX pravidla:
- Pri `warp-speed` zobrazit pouze warp pozadi + navigaci.
- Hero/main/footer se v tomto rezimu skryji.
- Navigace zustava vzdy pristupna pro okamzity navrat.

Barevne kotvy (desktop-agent):
- Gold: `rgb(255, 215, 0)`
- Purple: `rgb(147, 51, 234)`
- Cyan: `rgb(6, 182, 212)`
- Blue: `rgb(30, 58, 138)`

Technicke poznamky:
- `StarfieldBackground`: podpora `flowDirection = inward|outward`.
- `BackgroundOrchestrator`: per-mode presets + vypnuti cizich overlayu v citlivych modech.
- `QuantumBubbles`: mode-specific mlhoviny pro atmosfera/hloubku.
