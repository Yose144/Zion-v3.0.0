/**
 * Nova Zeme L5 Pioneer Projects — shared between the WorldPanel project
 * list and the in-world beacon markers rendered by WorldEnvironment.
 * lat/lon place each beacon on the Nova Zeme globe at its real location.
 */
export const NOVA_ZEME_PROJECTS = [
  {
    id: 'genesis',
    name: 'Zahrada Genesis',
    location: 'Algarve · Portugalsko',
    color: '#10b981',
    status: 'Active',
    desc: 'Atlantický uzel Terra Nova — organická farma, glamping, solar off-grid, surf a sázení stromů. První dlouhodobá komunitní infrastruktura.',
    href: 'https://app.zionterranova.com/terranova/genesis',
    lat: 37.0,
    lon: -8.0,
  },
  {
    id: 'dharma',
    name: 'Dharma Temple',
    location: 'La Palma · Kanárské ostrovy',
    color: '#8b5cf6',
    status: 'Prep',
    desc: 'Spirituální a vzdělávací uzel — meditace, syntropic zahrada, dharma governance, vulkanická krajina, off-grid voda. UNESCO Biosphere Reserve.',
    href: 'https://app.zionterranova.com/terranova/dharma-temple',
    lat: 28.7,
    lon: -17.9,
  },
  {
    id: 'piko-ora',
    name: 'Te Pīko Ora',
    location: 'Tahiti · Francouzská Polynésie',
    color: '#06b6d4',
    status: 'Planned',
    desc: 'Tichomořský uzel — ochrana mořského i pozemského dědictví, regenerativní komunita, kulturní most mezi Polynésií a ZION.',
    href: 'https://app.zionterranova.com/terranova/te-piko-ora',
    lat: -17.6,
    lon: -149.4,
  },
  {
    id: 'bohemia',
    name: 'Golden Republic Bohemia',
    location: 'Čechy · Česká republika',
    color: '#ffd700',
    status: 'Planned',
    desc: 'Governance laboratoř Zlaté republiky — kruh rozhodování, česká moudrost (sůl, most, Zlatá bula) a ZION protokol v srdci Evropy.',
    href: 'https://app.zionterranova.com/terranova/golden-republic-bohemia',
    lat: 50.0,
    lon: 15.0,
  },
  {
    id: 'bodhi-lanka',
    name: 'Bodhi Lanka',
    location: 'Srí Lanka',
    color: '#f59e0b',
    status: 'Planned',
    desc: 'Akáša uzel — prostor, který drží všechny elementy. Nekonečná láska Ramy a Sity, nejstarší žijící strom na Zemi a ZION protokol.',
    href: 'https://app.zionterranova.com/terranova/bodhi-lanka',
    lat: 7.9,
    lon: 80.8,
  },
] as const;
