import GeographyRegionPage from '../components/GeographyRegionPage';

const DATA = {
  titleCs: 'Evropa',
  titleEn: 'Europe',
  subtitleCs: 'Atlantida, seversko-keltské tradice a sámská moudrost',
  subtitleEn: 'Atlantis, Norse-Celtic traditions and Sámi wisdom',
  inserts: [
    {
      id: 'atlantis',
      titleCs: 'Atlantis',
      titleEn: 'Atlantis',
      descCs: 'Mýtický ostrov pokročilé civilizace, jehož pád slouží jako varování i inspirace pro novou Zemi.',
      descEn: 'The mythical island of an advanced civilization whose fall serves as both warning and inspiration for a new Earth.',
    },
    {
      id: 'norse-celtic',
      titleCs: 'Norsko-keltské tradice',
      titleEn: 'Norse-Celtic Traditions',
      descCs: 'Runy, druidové a severská kosmologie jako pramen obnovené evropské spirituality.',
      descEn: 'Runes, druids, and Norse cosmology as a spring of renewed European spirituality.',
    },
    {
      id: 'saman',
      titleCs: 'Sámské tradice',
      titleEn: 'Sámi Traditions',
      descCs: 'Arktická moudrost severních lidí, jejich vztah k zemi, zvířatům a prastarým rytmům.',
      descEn: 'Arctic wisdom of the northern peoples, their relationship to land, animals, and ancient rhythms.',
    },
  ],
};

export default function EuropePage() {
  return <GeographyRegionPage data={DATA} />;
}
