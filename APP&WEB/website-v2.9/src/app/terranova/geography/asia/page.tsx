import GeographyRegionPage from '../components/GeographyRegionPage';

const DATA = {
  titleCs: 'Asie',
  titleEn: 'Asia',
  subtitleCs: 'Od Himálaje po východní moudrosti — Tibet, Indie, Čína, Japonsko a Indonésie',
  subtitleEn: 'From the Himalayas to eastern wisdom — Tibet, India, China, Japan and Indonesia',
  inserts: [
    {
      id: 'tibet',
      titleCs: 'Tibet',
      titleEn: 'Tibet',
      descCs: 'Buddhistická moudrost výšin, meditační tradice a odolnost duchovní kultury v extrémních podmínkách.',
      descEn: 'Buddhist wisdom of high altitudes, meditation traditions, and spiritual culture resilience in extreme conditions.',
    },
    {
      id: 'india',
      titleCs: 'Indie',
      titleEn: 'India',
      descCs: 'Kolébka védské tradice, jógy a filosofie jednoty — Hiranyagarbha a dharma v praxi.',
      descEn: 'Cradle of Vedic tradition, yoga, and the philosophy of unity — Hiranyagarbha and dharma in practice.',
    },
    {
      id: 'china',
      titleCs: 'Čína',
      titleEn: 'China',
      descCs: 'Taoistická moudrost proudu, konfuciánská etika a starověká čínská kosmologie jako zdroj rovnováhy.',
      descEn: 'Taoist wisdom of flow, Confucian ethics, and ancient Chinese cosmology as a source of balance.',
    },
    {
      id: 'japan',
      titleCs: 'Japonsko',
      titleEn: 'Japan',
      descCs: 'Zen, ikigai a estetika wabi-sabi — cesta k plné přítomnosti a kráse v nedokonalosti.',
      descEn: 'Zen, ikigai, and the aesthetics of wabi-sabi — a path to full presence and beauty in imperfection.',
    },
    {
      id: 'indonesia',
      titleCs: 'Indonésie',
      titleEn: 'Indonesia',
      descCs: 'Námořní civilizace, ostrovní spiritualita a most mezi Asií a Pacifikem v kulturní výměně.',
      descEn: 'Maritime civilization, island spirituality, and a bridge between Asia and the Pacific in cultural exchange.',
    },
  ],
};

export default function AsiaPage() {
  return <GeographyRegionPage data={DATA} />;
}
