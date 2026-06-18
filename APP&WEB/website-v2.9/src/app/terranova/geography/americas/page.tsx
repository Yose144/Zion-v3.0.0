import GeographyRegionPage from '../components/GeographyRegionPage';

const DATA = {
  titleCs: 'Ameriky',
  titleEn: 'Americas',
  subtitleCs: 'Mayská kosmologie a domorodé civilizační kořeny západní polokoule',
  subtitleEn: 'Mayan cosmology and indigenous civilizational roots of the western hemisphere',
  inserts: [
    {
      id: 'maya',
      titleCs: 'Mayská civilizace',
      titleEn: 'Maya Civilization',
      descCs: 'Long Count kalendář, matematická přesnost a kosmologická hloubka středoamerické tradice.',
      descEn: 'The Long Count calendar, mathematical precision, and the cosmological depth of the Mesoamerican tradition.',
    },
  ],
};

export default function AmericasPage() {
  return <GeographyRegionPage data={DATA} />;
}
