import GeographyRegionPage from '../components/GeographyRegionPage';

const DATA = {
  titleCs: 'Afrika',
  titleEn: 'Africa',
  subtitleCs: 'Pramen lidstva, starověký Egypt a kontinentální moudrost kořenů',
  subtitleEn: 'Cradle of humanity, ancient Egypt and continental wisdom of roots',
  inserts: [
    {
      id: 'africa',
      titleCs: 'Africké tradice',
      titleEn: 'African Traditions',
      descCs: 'Ústní tradice, komunitní rytmy a propojení s půdou jako základ civilizace.',
      descEn: 'Oral traditions, community rhythms, and connection to soil as the foundation of civilization.',
    },
    {
      id: 'ancient-egypt',
      titleCs: 'Starověký Egypt',
      titleEn: 'Ancient Egypt',
      descCs: 'Kniha mrtvých, hvězdná kosmologie a technická přesnost faraonské civilizace.',
      descEn: 'The Book of the Dead, stellar cosmology, and the technical precision of pharaonic civilization.',
    },
  ],
};

export default function AfricaPage() {
  return <GeographyRegionPage data={DATA} />;
}
