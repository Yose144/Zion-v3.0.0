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
    {
      id: 'nova-amerika',
      titleCs: 'Nová Amerika — Kostarika',
      titleEn: 'Nová Amerika — Costa Rica',
      descCs: 'Šestý uzel L5 Terra Nova — most a paměť pro nativní kultury Amerik (Bribri, Cabécar, Boruca), FPIC governance, sdílený pozemek s pozemní stanicí L6 Issobella. Projekt ve fázi vize.',
      descEn: 'The sixth L5 Terra Nova node — a bridge and memory project for the native cultures of the Americas (Bribri, Cabécar, Boruca), FPIC governance, land shared with the L6 Issobella ground station. Vision-stage project.',
    },
  ],
};

export default function AmericasPage() {
  return <GeographyRegionPage data={DATA} />;
}
