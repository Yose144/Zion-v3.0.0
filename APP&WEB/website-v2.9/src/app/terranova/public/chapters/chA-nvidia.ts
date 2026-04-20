import type { BookChapter } from '../bookMetaPublic';

const chapter: BookChapter = {
  id: 'nvidia-compute',
  number: 'A',
  titleCs: 'Příloha A: NVIDIA Compute Pyramida',
  titleEn: 'Appendix A: NVIDIA Compute Pyramid',
  epigraphCs: '„Budoucnost computingu je fyzikální AI." — Jensen Huang, GTC 2026',
  epigraphEn: '"The future of computing is physical AI." — Jensen Huang, GTC 2026',
  color: '#94A3B8',
  rgb: '148,163,184',
  sectionsCs: [
    {
      heading: 'GTC 2026 — nová éra',
      body: 'NVIDIA GTC (GPU Technology Conference) 2026 přinesla pět klíčových oznámení, které přímo ovlivňují Terra Nova architekturu:\n\n1. DGX Spark — osobní superpočítač za $3,999, 1+ PFLOPS inference. Poprvé: superpočítačový výkon na stole komunitního centra.\n\n2. DGX Station — 20 PFLOPS za $49,999. Regionální výzkumné centrum v jednom boxu.\n\n3. Vera Rubin NVL72 — exascale platforma pojmenovaná po astronomce, která prokázala temnou hmotu.\n\n4. NVQLink — kvantový bridge propojující klasické GPU s kvantovými procesory.\n\n5. Project DIGITS — demokratizace AI inference na edge.\n\nTerra Nova čte tyto technologie nikoliv jako produkty, ale jako infrastrukturní předpoklady pro suverénní AI.',
    },
    {
      heading: 'Pětistupňová compute pyramida',
      body: '🏠 ÚROVEŇ 1: Edge ($249–$499) — Jetson Orin Nano. IoT, monitoring, senzory. Medical Table AI modul. Energetický monitoring. Skleník AI.\n\n💻 ÚROVEŇ 2: Personal ($1,999–$4,999) — RTX 5090, DGX Spark. Osobní AI workstation. Mining + inference. Lokální LLM (Llama 8B–70B). Hiranyagarbha personal.\n\n🏢 ÚROVEŇ 3: Community ($49,999) — DGX Station. 20 PFLOPS. Komunitní AI brain. Multi-agent orchestrace. Medical AI výzkum. Plný Hiranyagarbha.\n\n🏗️ ÚROVEŇ 4: Regional ($500K–$5M) — DGX SuperPOD / HGX. Regionální výzkumné centrum. Klimatické modelování. Farmakologie. Material science.\n\n🌍 ÚROVEŇ 5: Planetary ($50M+) — Vera Rubin NVL72. Exascale. Planetární monitoring. SETI analýza. WARP simulace. Issobella orbitální AI.\n\nKaždá úroveň je přístupná. Žádná nevyžaduje korporátní schválení.',
    },
    {
      heading: 'NVQLink — kvantový most',
      body: 'NVQLink (NVIDIA Quantum Link) je rozhraní propojující klasické GPU s kvantovými procesory. Terra Nova implikace:\n\nHybridní quantum-classical AI — kvantové procesory pro optimalizační problémy, GPU pro inference. Kryptografické implikace — post-quantum kryptografie pro ZION L1. WARP simulace — kvantové simulace Alcubierrovy metriky.\n\nFeynmanova architektura — koncept pojmenovaný po Richardu Feynmanovi: „Nature isn\'t classical, dammit, and if you want to make a simulation of nature, you\'d better make it quantum mechanical."\n\nTerra Nova plán: integrovat NVQLink do L3 NCL jakmile bude dostupný pro open-source komunitu.',
    },
    {
      heading: 'Software stack — co běží na hardwaru',
      body: 'NVIDIA software ekosystém relevantní pro Terra Nova:\n\nOpenClaw — open-source robotický stack. Fork pro zemědělství, Medical Table, energetiku.\n\nNemoClaw — humanoidní robotika. Komunitní asistence, údržba, logistika.\n\nNIM (NVIDIA Inference Microservices) — kontejnerizovaná AI inference. Hiranyagarbha deployment.\n\nDynamo — distribuovaný inference engine. ZION L3 NCL backbone.\n\nNemotron Coalition — multi-model orchestrace. Hiranyagarbha multi-agent framework.\n\nVšechny open-source nebo s open licencí. Terra Nova nebuduje od nuly — staví na ramenech obrů.',
    },
    {
      heading: 'ZION compute stack — mapování L0–L6',
      body: 'Jak se NVIDIA pyramida mapuje na ZION vrstvy:\n\nL0 (Hardware) → Jetson, RTX, DGX, Vera Rubin — fyzický compute\nL1 (Blockchain) → Mining na RTX/DGX, Ekam Deeksha PoW\nL2 (DeFi) → Smart contract execution na L2 EVM nodes\nL3 (Neural) → NCL inference přes DGX Spark/Station, Dynamo orchestrace\nL4 (OASIS) → Game rendering, AI NPC, Sacred Avatars přes NIM\nL5 (Free World) → Medical Table AI (Jetson), komunitní monitoring\nL6 (Issobella) → Vera Rubin exascale, orbitální inference, SETI\n\nKaždá vrstva ZION má svůj compute tier. Žádná vrstva není závislá na centrální autoritě.',
    },
    {
      heading: 'Náklady pro komunitu — reálné čísla',
      body: 'Co stojí vybudovat Terra Nova compute infrastrukturu pro komunitu 200 lidí:\n\nMinimální setup: 5× Jetson Orin Nano ($249 × 5 = $1,245) — IoT, monitoring, Medical Table. 3× RTX 5090 workstation ($1,999 × 3 = $5,997) — mining, lokální AI. 1× DGX Spark ($3,999) — komunitní Hiranyagarbha. CELKEM: ~$11,241.\n\nOptimální setup: výše + 1× DGX Station ($49,999) — plný AI výzkum. CELKEM: ~$61,240.\n\nPorovnání: průměrný americký dům stojí $420,000. Kompletní AI infrastruktura pro 200 lidí stojí méně než 15% jednoho domu.\n\nTechnologie už není překážka. Překážkou je představivost.',
    },
  ],
  sectionsEn: [
    {
      heading: 'GTC 2026 — a new era',
      body: 'NVIDIA GTC 2026 brought five key announcements directly impacting Terra Nova architecture:\n\n1. DGX Spark — personal supercomputer for $3,999, 1+ PFLOPS inference.\n2. DGX Station — 20 PFLOPS for $49,999.\n3. Vera Rubin NVL72 — exascale platform.\n4. NVQLink — quantum bridge connecting classical GPUs with quantum processors.\n5. Project DIGITS — democratizing AI inference at the edge.\n\nTerra Nova reads these not as products, but as infrastructure prerequisites for sovereign AI.',
    },
    {
      heading: 'Five-tier compute pyramid',
      body: '🏠 TIER 1: Edge ($249–$499) — Jetson Orin Nano. IoT, monitoring, Medical Table AI.\n💻 TIER 2: Personal ($1,999–$4,999) — RTX 5090, DGX Spark. Personal AI + mining.\n🏢 TIER 3: Community ($49,999) — DGX Station. 20 PFLOPS. Community AI brain.\n🏗️ TIER 4: Regional ($500K–$5M) — DGX SuperPOD. Regional research center.\n🌍 TIER 5: Planetary ($50M+) — Vera Rubin NVL72. Exascale. Planetary monitoring, SETI, WARP simulation.\n\nEvery tier is accessible. None requires corporate approval.',
    },
    {
      heading: 'NVQLink — quantum bridge',
      body: 'NVQLink connects classical GPUs with quantum processors. Implications for Terra Nova:\n\nHybrid quantum-classical AI. Post-quantum cryptography for ZION L1. Quantum simulations of Alcubierre metrics for WARP research.\n\nFeynman architecture — named after Richard Feynman: "Nature isn\'t classical, dammit, and if you want to make a simulation of nature, you\'d better make it quantum mechanical."\n\nPlan: integrate NVQLink into L3 NCL when available to open-source community.',
    },
    {
      heading: 'Software stack — what runs on hardware',
      body: 'Relevant NVIDIA software ecosystem:\n\nOpenClaw — open-source robotics stack.\nNemoClaw — humanoid robotics for community assistance.\nNIM — containerized AI inference for Hiranyagarbha deployment.\nDynamo — distributed inference engine for ZION L3 NCL.\nNemotron Coalition — multi-model orchestration for Hiranyagarbha multi-agent framework.\n\nAll open-source or open-licensed. Terra Nova doesn\'t build from scratch — it stands on the shoulders of giants.',
    },
    {
      heading: 'ZION compute stack — L0–L6 mapping',
      body: 'How the NVIDIA pyramid maps to ZION layers:\n\nL0 (Hardware) → Jetson, RTX, DGX, Vera Rubin\nL1 (Blockchain) → Mining on RTX/DGX, Ekam Deeksha PoW\nL2 (DeFi) → Smart contract execution on L2 EVM nodes\nL3 (Neural) → NCL inference via DGX, Dynamo orchestration\nL4 (OASIS) → Game rendering, AI NPC, Sacred Avatars via NIM\nL5 (Free World) → Medical Table AI (Jetson), community monitoring\nL6 (Issobella) → Vera Rubin exascale, orbital inference, SETI\n\nEvery ZION layer has its compute tier. No layer depends on central authority.',
    },
    {
      heading: 'Community costs — real numbers',
      body: 'What it costs to build Terra Nova compute infrastructure for a 200-person community:\n\nMinimal setup: 5× Jetson ($1,245) + 3× RTX 5090 ($5,997) + 1× DGX Spark ($3,999) = ~$11,241.\n\nOptimal setup: above + 1× DGX Station ($49,999) = ~$61,240.\n\nComparison: average American house costs $420,000. Complete AI infrastructure for 200 people costs less than 15% of one house.\n\nTechnology is no longer the barrier. Imagination is.',
    },
  ],
};

export default chapter;
