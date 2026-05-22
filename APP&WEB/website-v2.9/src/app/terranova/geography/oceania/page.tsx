import GeographyRegionPage from '../components/GeographyRegionPage';

const DATA = {
  titleCs: 'Oceánie & Pacifik',
  titleEn: 'Oceania & Pacific',
  subtitleCs: 'Austrálie, Havaj, Lemurie, Nový Zéland a Rapa Nui — ostrovní civilizace a námořní paměť',
  subtitleEn: 'Australia, Hawaii, Lemuria, New Zealand and Rapa Nui — island civilizations and maritime memory',
  inserts: [
    {
      id: 'australia',
      titleCs: 'Austrálie',
      titleEn: 'Australia',
      descCs: 'Aboriginský Dreamtime, zeměpisné písně a 60 000 let kontinuity mezi člověkem a krajinou.',
      descEn: 'Aboriginal Dreamtime, songlines, and 60,000 years of continuity between humans and landscape.',
    },
    {
      id: 'hawaii',
      titleCs: 'Havaj',
      titleEn: 'Hawaii',
      descCs: 'Polynéská navigace, mana a aloha — ostrovní moudrost uprostřed Pacifiku.',
      descEn: 'Polynesian navigation, mana, and aloha — island wisdom in the heart of the Pacific.',
    },
    {
      id: 'lemuria',
      titleCs: 'Lemurie',
      titleEn: 'Lemuria',
      descCs: 'Mýtický ztracený kontinent Indického oceánu — legenda o pokročilé civilizaci, která zůstává v paměti Země.',
      descEn: 'The mythical lost continent of the Indian Ocean — a legend of an advanced civilization that remains in the memory of the Earth.',
    },
    {
      id: 'newzealand',
      titleCs: 'Nový Zéland',
      titleEn: 'New Zealand',
      descCs: 'Maorská kultura, whakapapa a propojení lidského rodu s přírodou Aotearoa.',
      descEn: 'Maori culture, whakapapa, and the connection of human lineage to the nature of Aotearoa.',
    },
    {
      id: 'rapa-nui',
      titleCs: 'Rapa Nui',
      titleEn: 'Rapa Nui',
      descCs: 'Velikonoční ostrov, Moai a kulturní paměť nejodlehlejší obývané země na světě.',
      descEn: 'Easter Island, the Moai, and the cultural memory of the most remote inhabited land on Earth.',
    },
  ],
};

export default function OceaniaPage() {
  return <GeographyRegionPage data={DATA} />;
}
