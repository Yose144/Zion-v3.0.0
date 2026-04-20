import type { BookChapter } from '../bookMetaPublic';

const chapter: BookChapter = {
  id: 'medicina',
  number: 'VI',
  titleCs: 'Medicína Nové Země',
  titleEn: 'Medicine of the New Earth',
  epigraphCs: '„Léčení je obnovení paměti celku v každé buňce." — Bhagavan Sri Kalki',
  epigraphEn: '"Healing is the restoration of the memory of wholeness in every cell." — Bhagavan Sri Kalki',
  color: '#F472B6',
  rgb: '244,114,182',
  sectionsCs: [
    {
      heading: 'Medical Tables — filozofie',
      body: 'Medical Tables je odpovědí na dvě otázky: Proč jsou nemocnice tak drahé? A proč většina léčení adresuje symptomy, ne příčiny?\n\nKoncept: kompaktní diagnosticko-terapeutické zařízení velikosti masážního stolu, obsahující: senzorovou vrstvu (teplota, vodivost, bioimpedance, srdeční variabilita), terapeutickou vrstvu (PEMF cívky, LED fototerapie, akustická rezonance), AI vrstvu (lokální inference přes Hiranyagarbha, pattern matching s open-source databází).\n\nNení to náhrada nemocnic. Je to rozšíření přístupu ke zdravotní péči tam, kde nemocnice neexistují — v off-grid komunitách, rozvojových oblastech, po katastrofách.',
    },
    {
      heading: 'PEMF — Pulsed Electromagnetic Field Therapy',
      body: 'PEMF není alternativní medicína. Je to FDA-schválená terapie:\n\nFDA schválení pro hojení kostí (1979). FDA schválení pro léčbu deprese (rTMS, 2008). NASA výzkum pro astronauty (1960+). 50+ let klinických studií. Mechanismus: slabá pulzující elektromagnetická pole stimulují buněčnou aktivitu — zlepšují krevní oběh, redukují zánět, akcelerují hojení.\n\nMedical Table PEMF specifikace: Frekvence: 1 Hz – 100 kHz. Intenzita: 0.1 – 100 Gauss. Programovatelné protokoly pro různé stavy. AI-řízená adaptace na základě biofeedbacku v reálném čase.',
    },
    {
      heading: 'Biorezonance a Rife frekvence',
      body: 'Royal Raymond Rife (1888–1971) — americký vynálezce, který tvrdil, že specifické frekvence mohou deaktivovat patogeny. Kontroverze: Rife byl diskreditován farmaceutickým establishmentem. Mnoho jeho nároků nebylo replikováno.\n\nTerra Nova pozice — vědecky poctivá: Specifické frekvence ovlivňují biologické systémy — to je prokázáno (PEMF, ultrazvuk, fototerapie). Rife frekvence proti konkrétním patogenům — nepotvrzeno peer-reviewed výzkumem. Medical Table implementace: PEMF + bioimpedance + AI analýza. Pokud budoucí výzkum potvrdí specifické Rife protokoly, AI je integruje.\n\nZásada: žádné lživé sliby. Otevřenost výzkumu, ne dogma.',
    },
    {
      heading: 'V1 Hardware — specifikace',
      body: 'Medical Table V1 design pro Terra Nova komunity:\n\nRám: dřevo + hliník, rozměry 200 × 80 × 75 cm, hmotnost < 40 kg. PEMF systém: 6 cívek v matici pod lehátkem, řídící jednotka Arduino/ESP32. Senzory: 12 bioimpedančních elektrod, 4 teplotní senzory, PPG senzor pro srdeční variabilitu. LED panel: 660nm (červená) + 850nm (infračervená) fototerapie. Akustika: piezoelektrické měniče pro zvukovou rezonanci. AI modul: Jetson Orin Nano ($249) pro lokální inference.\n\nOdhadovaná cena V1: ~$2,000. Cíl: klesající cena s open-source iteracemi a komunitní výrobou.\n\nVšechny blueprinty budou open-source pod GPLv3.',
    },
    {
      heading: 'AI integrace ve zdravotní péči',
      body: 'Hiranyagarbha jako zdravotní asistent v Medical Table:\n\n1. Anamnéza — AI vede strukturovaný rozhovor s pacientem (lokálně, žádná cloud data).\n2. Senzorový sběr — Medical Table měří bioimpedanci, teplotu, HRV, vodivost kůže.\n3. Pattern matching — lokální inference porovnává vzorce s open-source databází (anonymizovaná komunitní data).\n4. Doporučení — AI navrhuje: PEMF protokol, bylinný přípravek, životní úpravy, případně doporučení k lékaři.\n5. Sledování — kontinuální monitoring, adaptace protokolu.\n\nKlíčové: AI nikdy nediagnostikuje finálně. Vždy doporučí konzultaci s lékařem pro vážné stavy. AI asistuje — nenahrazuje.',
    },
    {
      heading: 'Holistický model — tělo, mysl, duch',
      body: 'Západní medicína oddělila tělo od mysli a mysl od ducha. Medical Tables je sjednocují:\n\nTělo (Physical): PEMF, fototerapie, výživa, byliny, pohyb. Mysl (Mental): biofeedback pro stres a úzkost, meditační protokoly řízené AI, zvuková terapie (binaurální beaty, 432 Hz). Duch (Spiritual): komunální podpora, smysl a příslušnost, Ekam Deeksha meditace, příroda jako terapie.\n\nTroji model není esoterický. Je to klinicky prokázaný přístup: psychosomatická medicína, MBSR (Mindfulness-Based Stress Reduction), pozitivní psychologie — všechno potvrzuje, že tělo-mysl-duch je neoddělitelný systém.',
    },
    {
      heading: 'Bylinná formulace a fermentace',
      body: 'Každá Terra Nova komunita pěstuje léčivé byliny:\n\nZákladní herbarium: měsíček (zánět, hojení), heřmánek (trávení, spánek), třezalka (deprese, nervový systém), echinacea (imunita), kurkuma (protizánětlivý), máta (trávení, bolest hlavy), levandule (úzkost, kůže).\n\nFermentace jako medicína: kombucha (probiotika, detox), kvašená zelenina (mikrobiom), fermentované byliny (zvýšená biodostupnost), vodní kefír (minerály, enzymy).\n\nPropojení s AI: Hiranyagarbha sleduje bylinkovou zahradu (vlhkost, růst, sklizeň) a doporučuje bylinné přípravky na základě sezónní dostupnosti a pacientových potřeb.',
    },
  ],
  sectionsEn: [
    {
      heading: 'Medical Tables — philosophy',
      body: 'Medical Tables answers two questions: Why are hospitals so expensive? And why does most treatment address symptoms, not causes?\n\nConcept: a compact diagnostic-therapeutic device the size of a massage table, containing: sensor layer (temperature, conductivity, bioimpedance, heart rate variability), therapeutic layer (PEMF coils, LED phototherapy, acoustic resonance), AI layer (local inference via Hiranyagarbha, pattern matching with open-source database).\n\nIt is not a hospital replacement. It is an expansion of healthcare access where hospitals don\'t exist — in off-grid communities, developing regions, after disasters.',
    },
    {
      heading: 'PEMF — Pulsed Electromagnetic Field Therapy',
      body: 'PEMF is not alternative medicine. It is FDA-approved therapy:\n\nFDA approval for bone healing (1979). FDA approval for depression treatment (rTMS, 2008). NASA research for astronauts (1960+). 50+ years of clinical studies.\n\nMechanism: weak pulsating electromagnetic fields stimulate cellular activity — improving blood circulation, reducing inflammation, accelerating healing.\n\nMedical Table PEMF spec: Frequency 1 Hz – 100 kHz. Intensity 0.1 – 100 Gauss. Programmable protocols. AI-driven adaptation based on real-time biofeedback.',
    },
    {
      heading: 'Bioresonance and Rife frequencies',
      body: 'Royal Raymond Rife (1888–1971) claimed specific frequencies could deactivate pathogens. Controversy: Rife was discredited by the pharmaceutical establishment. Many of his claims were not replicated.\n\nTerra Nova position — scientifically honest: Specific frequencies affect biological systems — proven (PEMF, ultrasound, phototherapy). Rife frequencies against specific pathogens — unconfirmed by peer-reviewed research. Medical Table implementation: PEMF + bioimpedance + AI analysis. If future research confirms specific Rife protocols, AI will integrate them.\n\nPrinciple: no false promises. Openness to research, not dogma.',
    },
    {
      heading: 'V1 Hardware — specifications',
      body: 'Medical Table V1 design for Terra Nova communities:\n\nFrame: wood + aluminum, 200 × 80 × 75 cm, weight < 40 kg. PEMF system: 6 coils in matrix under the table, Arduino/ESP32 controller. Sensors: 12 bioimpedance electrodes, 4 temperature sensors, PPG sensor for HRV. LED panel: 660nm (red) + 850nm (infrared) phototherapy. Acoustics: piezoelectric transducers for sound resonance. AI module: Jetson Orin Nano ($249).\n\nEstimated V1 cost: ~$2,000. Goal: decreasing cost through open-source iterations and community manufacturing. All blueprints open-source under GPLv3.',
    },
    {
      heading: 'AI integration in healthcare',
      body: 'Hiranyagarbha as health assistant in Medical Table:\n\n1. History — AI conducts structured interview (locally, no cloud data).\n2. Sensor collection — measures bioimpedance, temperature, HRV, skin conductivity.\n3. Pattern matching — local inference compares patterns with open-source database.\n4. Recommendation — AI suggests: PEMF protocol, herbal preparation, lifestyle adjustments, or referral to a doctor.\n5. Monitoring — continuous monitoring, protocol adaptation.\n\nKey: AI never makes a final diagnosis. Always recommends doctor consultation for serious conditions. AI assists — does not replace.',
    },
    {
      heading: 'Holistic model — body, mind, spirit',
      body: 'Western medicine separated body from mind and mind from spirit. Medical Tables reunifies them:\n\nBody (Physical): PEMF, phototherapy, nutrition, herbs, movement.\nMind (Mental): biofeedback for stress and anxiety, AI-guided meditation protocols, sound therapy (binaural beats, 432 Hz).\nSpirit (Spiritual): community support, meaning and belonging, Ekam Deeksha meditation, nature as therapy.\n\nThe triple model is not esoteric. It is a clinically proven approach: psychosomatic medicine, MBSR, positive psychology — all confirm that body-mind-spirit is an inseparable system.',
    },
    {
      heading: 'Herbal formulation and fermentation',
      body: 'Every Terra Nova community grows medicinal herbs:\n\nBasic herbarium: calendula (inflammation, healing), chamomile (digestion, sleep), St. John\'s wort (depression, nervous system), echinacea (immunity), turmeric (anti-inflammatory), peppermint (digestion, headache), lavender (anxiety, skin).\n\nFermentation as medicine: kombucha (probiotics, detox), fermented vegetables (microbiome), fermented herbs (increased bioavailability), water kefir (minerals, enzymes).\n\nAI integration: Hiranyagarbha monitors the herb garden (moisture, growth, harvest) and recommends herbal preparations based on seasonal availability and patient needs.',
    },
  ],
};

export default chapter;
