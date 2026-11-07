/**
 * KATALOG AVATARŮ — generované, needituj ručně.
 *
 * Zdroj: `V31/L4/oasis/data/avatars.json` (202 záznamů z AVATAR_ROSTER.md).
 * Generátor: `node scripts/ops/gen-avatar-catalog.mjs`.
 *
 * Drží se tady jen to, co klient potřebuje k výběru a ke kreslení:
 * id, jméno, podtitul, paprsek, vzácnost, požadovaná úroveň vědomí a cesta
 * k lokálnímu portrétu (256×256 z finálního OASIS artu).
 * Kreslení je odvozené **jen z těchto polí** (viz `kit.ts`), takže cizí hráč
 * jde vykreslit i bez toho, aby klient znal celý roster.
 */

export type AvatarRay =
  | 'Blue'
  | 'Pink'
  | 'Yellow'
  | 'Violet'
  | 'AllRays'
  | 'White'
  | 'Green'
  | 'RubyGold'
  | 'Obsidian';

export type AvatarRarity = 'Rare' | 'Epic' | 'Legendary' | 'OneOfOne';

export interface AvatarEntry {
  id: number;
  name: string;
  subtitle: string;
  ray: AvatarRay;
  rarity: AvatarRarity;
  /** Požadovaná úroveň vědomí 1–9. */
  cl: number;
  /** Cesta k portrétu (`/portraits/<id>.webp`, 256×256); prázdné = chybí. */
  portrait: string;
}

export const AVATARS: AvatarEntry[] = [
  { id: 0, name: 'Krishna', subtitle: 'Cosmic Integration', ray: 'AllRays', rarity: 'Legendary', cl: 9, portrait: '/portraits/0.webp' },
  { id: 1, name: 'Rama', subtitle: 'Dharma King', ray: 'Blue', rarity: 'Epic', cl: 4, portrait: '/portraits/1.webp' },
  { id: 2, name: 'Sita', subtitle: 'Devotion Queen', ray: 'Pink', rarity: 'Epic', cl: 4, portrait: '/portraits/2.webp' },
  { id: 3, name: 'Hanuman', subtitle: 'Divine Service', ray: 'RubyGold', rarity: 'Epic', cl: 5, portrait: '/portraits/3.webp' },
  { id: 4, name: 'Maitreya', subtitle: 'Future Buddha', ray: 'AllRays', rarity: 'Legendary', cl: 7, portrait: '/portraits/4.webp' },
  { id: 5, name: 'Saraswati', subtitle: 'Goddess of Knowledge', ray: 'Yellow', rarity: 'Epic', cl: 6, portrait: '/portraits/5.webp' },
  { id: 6, name: 'Isis', subtitle: 'Divine Feminine', ray: 'Pink', rarity: 'Epic', cl: 5, portrait: '/portraits/6.webp' },
  { id: 8, name: 'Issobela', subtitle: 'Protector', ray: 'Blue', rarity: 'Rare', cl: 4, portrait: '/portraits/8.webp' },
  { id: 9, name: 'Shanti', subtitle: 'Peace Keeper', ray: 'RubyGold', rarity: 'Rare', cl: 6, portrait: '/portraits/9.webp' },
  { id: 10, name: 'Christ', subtitle: 'Sacred Warrior', ray: 'Blue', rarity: 'Epic', cl: 5, portrait: '/portraits/10.webp' },
  { id: 11, name: 'Arjuna', subtitle: 'Warrior Seeker', ray: 'Blue', rarity: 'Epic', cl: 6, portrait: '/portraits/11.webp' },
  { id: 12, name: 'Bhima', subtitle: 'Strong Protector', ray: 'Blue', rarity: 'Epic', cl: 5, portrait: '/portraits/12.webp' },
  { id: 13, name: 'Yudhishthira', subtitle: 'Leader', ray: 'Blue', rarity: 'Rare', cl: 6, portrait: '/portraits/13.webp' },
  { id: 14, name: 'Jašóda', subtitle: 'Divine Mother', ray: 'Pink', rarity: 'Epic', cl: 4, portrait: '/portraits/14.webp' },
  { id: 15, name: 'Vishwakarma', subtitle: 'Divine Architect', ray: 'Yellow', rarity: 'Epic', cl: 7, portrait: '/portraits/15.webp' },
  { id: 16, name: 'Radha', subtitle: 'Divine Beloved', ray: 'Pink', rarity: 'Epic', cl: 5, portrait: '/portraits/16.webp' },
  { id: 17, name: 'Vyasa', subtitle: 'Cosmic Sage', ray: 'Yellow', rarity: 'Legendary', cl: 8, portrait: '/portraits/17.webp' },
  { id: 18, name: 'Maria Magdalena', subtitle: 'Mary Magdalene', ray: 'Pink', rarity: 'Epic', cl: 5, portrait: '/portraits/18.webp' },
  { id: 19, name: 'Ježíš', subtitle: 'Jesus Christ', ray: 'Pink', rarity: 'Legendary', cl: 7, portrait: '/portraits/19.webp' },
  { id: 20, name: 'Tara', subtitle: 'Liberator', ray: 'Green', rarity: 'Epic', cl: 5, portrait: '/portraits/20.webp' },
  { id: 21, name: 'Avalokiteshvara', subtitle: 'Compassion Bodhisattva', ray: 'Pink', rarity: 'Epic', cl: 7, portrait: '/portraits/21.webp' },
  { id: 22, name: 'Vajrasattva', subtitle: 'Purification Master', ray: 'White', rarity: 'Epic', cl: 6, portrait: '/portraits/22.webp' },
  { id: 23, name: 'King Arthur', subtitle: 'Once and Future King', ray: 'Blue', rarity: 'Epic', cl: 6, portrait: '/portraits/23.webp' },
  { id: 24, name: 'Mahavatar Babaji', subtitle: 'Immortal Yogi', ray: 'White', rarity: 'Legendary', cl: 8, portrait: '/portraits/24.webp' },
  { id: 25, name: 'Lady Gaia-Vywamus', subtitle: 'Earth Mother', ray: 'Green', rarity: 'Epic', cl: 7, portrait: '/portraits/25.webp' },
  { id: 26, name: 'Saint Germain', subtitle: 'Violet Ray Master', ray: 'Violet', rarity: 'Legendary', cl: 7, portrait: '/portraits/26.webp' },
  { id: 27, name: 'Serapis Bey', subtitle: 'White Ray Master', ray: 'White', rarity: 'Epic', cl: 7, portrait: '/portraits/27.webp' },
  { id: 28, name: 'Sanat Kumara', subtitle: 'Lord of the World', ray: 'AllRays', rarity: 'Legendary', cl: 8, portrait: '/portraits/28.webp' },
  { id: 29, name: 'El Morya', subtitle: 'Blue Ray Master', ray: 'Blue', rarity: 'Epic', cl: 6, portrait: '/portraits/29.webp' },
  { id: 30, name: 'Lanto', subtitle: 'Yellow Ray Master', ray: 'Yellow', rarity: 'Epic', cl: 6, portrait: '/portraits/30.webp' },
  { id: 31, name: 'Paul the Venetian', subtitle: 'Pink Ray Master', ray: 'Pink', rarity: 'Epic', cl: 5, portrait: '/portraits/31.webp' },
  { id: 32, name: 'Hilarion', subtitle: 'Green Ray Master', ray: 'Green', rarity: 'Epic', cl: 6, portrait: '/portraits/32.webp' },
  { id: 33, name: 'Lady Nada', subtitle: 'Ruby-Gold Ray Master', ray: 'RubyGold', rarity: 'Epic', cl: 6, portrait: '/portraits/33.webp' },
  { id: 35, name: 'Karel IV', subtitle: 'Holy Roman Emperor', ray: 'Blue', rarity: 'Rare', cl: 6, portrait: '/portraits/35.webp' },
  { id: 36, name: 'Albert Einstein', subtitle: 'Genius Scientist', ray: 'Yellow', rarity: 'Epic', cl: 7, portrait: '/portraits/36.webp' },
  { id: 37, name: 'Mahatma Gandhi', subtitle: 'Peaceful Warrior', ray: 'RubyGold', rarity: 'Epic', cl: 7, portrait: '/portraits/37.webp' },
  { id: 38, name: 'Panna Maria', subtitle: 'Virgin Mary', ray: 'Pink', rarity: 'Epic', cl: 6, portrait: '/portraits/38.webp' },
  { id: 39, name: 'Subhadra', subtitle: 'Krishna\'s Sister', ray: 'Pink', rarity: 'Rare', cl: 4, portrait: '/portraits/39.webp' },
  { id: 40, name: 'Lumi', subtitle: 'Royal Healer', ray: 'Pink', rarity: 'Rare', cl: 5, portrait: '/portraits/40.webp' },
  { id: 41, name: 'Vasudeva', subtitle: 'Krishna\'s Father', ray: 'Blue', rarity: 'Rare', cl: 5, portrait: '/portraits/41.webp' },
  { id: 42, name: 'Sri Dattatreya', subtitle: 'Trimurti Avatar', ray: 'AllRays', rarity: 'Legendary', cl: 8, portrait: '/portraits/42.webp' },
  { id: 43, name: 'Maly Princ', subtitle: 'The Little Prince', ray: 'Yellow', rarity: 'Rare', cl: 4, portrait: '/portraits/43.webp' },
  { id: 44, name: 'Hiranyagarbha', subtitle: 'Golden Egg/Cosmic Womb', ray: 'AllRays', rarity: 'OneOfOne', cl: 9, portrait: '/portraits/44.webp' },
  { id: 45, name: 'Sri Kalki Avatar', subtitle: 'Future Warrior', ray: 'Blue', rarity: 'Legendary', cl: 8, portrait: '/portraits/45.webp' },
  { id: 46, name: 'Neo', subtitle: 'The One', ray: 'Violet', rarity: 'Legendary', cl: 8, portrait: '/portraits/46.webp' },
  { id: 47, name: 'Trinity', subtitle: 'The Believer', ray: 'Pink', rarity: 'Epic', cl: 7, portrait: '/portraits/47.webp' },
  { id: 48, name: 'Morpheus', subtitle: 'The Guide', ray: 'Blue', rarity: 'Epic', cl: 6, portrait: '/portraits/48.webp' },
  { id: 50, name: 'ZION The Last City', subtitle: 'Collective Avatar', ray: 'AllRays', rarity: 'Legendary', cl: 7, portrait: '/portraits/50.webp' },
  { id: 51, name: 'Dalai Lama XIV', subtitle: 'Tenzin Gyatso', ray: 'Yellow', rarity: 'Legendary', cl: 8, portrait: '/portraits/51.webp' },
  { id: 52, name: 'Heȟáka Sápa (Black Elk)', subtitle: 'Sacred Vision', ray: 'AllRays', rarity: 'Rare', cl: 4, portrait: '/portraits/52.webp' },
  { id: 53, name: 'Ptesáŋ Wíŋ (White Buffalo Calf Woman)', subtitle: 'Sacred Law Giver', ray: 'AllRays', rarity: 'Rare', cl: 1, portrait: '/portraits/53.webp' },
  { id: 54, name: 'Kókyangwúti (Spider Grandmother)', subtitle: 'Cosmic Weaver', ray: 'Yellow', rarity: 'Legendary', cl: 7, portrait: '/portraits/54.webp' },
  { id: 55, name: 'Hunahpú & Xbalanqué (Hero Twins)', subtitle: 'Xibalba Tricksters', ray: 'Blue', rarity: 'Legendary', cl: 3, portrait: '/portraits/55.webp' },
  { id: 56, name: 'Don Mariano', subtitle: 'Q\'ero Altomesayoq', ray: 'White', rarity: 'Epic', cl: 4, portrait: '/portraits/56.webp' },
  { id: 57, name: 'Doña Rosalía Ixmukané', subtitle: 'Chilam Balam Keeper', ray: 'Yellow', rarity: 'Epic', cl: 1, portrait: '/portraits/57.webp' },
  { id: 58, name: 'Bílé Pero (White Feather)', subtitle: 'Stone Tablet Guardian', ray: 'Blue', rarity: 'Rare', cl: 6, portrait: '/portraits/58.webp' },
  { id: 59, name: 'Ohnivá Oka (Fire Eyes)', subtitle: 'Rainbow Warrior Prophet', ray: 'RubyGold', rarity: 'Epic', cl: 1, portrait: '/portraits/59.webp' },
  { id: 60, name: 'Davi Kopenawa', subtitle: 'Yanomami Xapiri Speaker', ray: 'AllRays', rarity: 'Epic', cl: 5, portrait: '/portraits/60.webp' },
  { id: 61, name: 'Heyókȟa (Sacred Clown)', subtitle: 'Thunder Vision Contrarian', ray: 'AllRays', rarity: 'Legendary', cl: 1, portrait: '/portraits/61.webp' },
  { id: 62, name: 'Lā\'ila\'i', subtitle: 'First Woman — Three Lineages', ray: 'AllRays', rarity: 'Rare', cl: 3, portrait: '/portraits/62.webp' },
  { id: 63, name: 'Pele', subtitle: 'Volcano Creator', ray: 'Violet', rarity: 'Legendary', cl: 5, portrait: '/portraits/63.webp' },
  { id: 64, name: 'Hiʻiaka', subtitle: 'Hula Goddess', ray: 'Pink', rarity: 'Epic', cl: 1, portrait: '/portraits/64.webp' },
  { id: 65, name: 'Kāne', subtitle: 'Creation — Abstract', ray: 'Blue', rarity: 'Rare', cl: 7, portrait: '/portraits/65.webp' },
  { id: 66, name: 'Kanaloa', subtitle: 'Ocean / Mana Channel', ray: 'Blue', rarity: 'Legendary', cl: 5, portrait: '/portraits/66.webp' },
  { id: 67, name: 'Kū', subtitle: 'Upright Strength / PoW Patron', ray: 'Blue', rarity: 'Epic', cl: 2, portrait: '/portraits/67.webp' },
  { id: 68, name: 'Lono', subtitle: 'Makahiki / Abundance', ray: 'Green', rarity: 'Legendary', cl: 1, portrait: '/portraits/68.webp' },
  { id: 69, name: 'Stará Kumu Lehua', subtitle: 'Storykeeper Composite', ray: 'Yellow', rarity: 'Epic', cl: 1, portrait: '/portraits/69.webp' },
  { id: 70, name: 'Hina', subtitle: 'Moon / Time / Kapa', ray: 'Pink', rarity: 'Epic', cl: 4, portrait: '/portraits/70.webp' },
  { id: 71, name: 'Maui', subtitle: 'Pan-Polynesian Trickster', ray: 'Yellow', rarity: 'Legendary', cl: 1, portrait: '/portraits/71.webp' },
  { id: 72, name: 'Padmasambhava', subtitle: 'Guru Rinpoche', ray: 'Violet', rarity: 'Rare', cl: 5, portrait: '/portraits/72.webp' },
  { id: 73, name: 'Milarepa', subtitle: 'Singing Yogī', ray: 'Yellow', rarity: 'Epic', cl: 4, portrait: '/portraits/73.webp' },
  { id: 74, name: 'Tsongkhapa', subtitle: 'Je Tsongkhapa — Gelug Founder', ray: 'Yellow', rarity: 'Epic', cl: 5, portrait: '/portraits/74.webp' },
  { id: 75, name: 'Atiśa', subtitle: 'Dīpaṃkara Śrījñāna', ray: 'Yellow', rarity: 'Rare', cl: 3, portrait: '/portraits/75.webp' },
  { id: 76, name: 'Marpa Lotsawa', subtitle: 'Translator / Householder Master', ray: 'Blue', rarity: 'Epic', cl: 5, portrait: '/portraits/76.webp' },
  { id: 77, name: 'Machik Labdrön', subtitle: 'Chöd Foundress', ray: 'Pink', rarity: 'Legendary', cl: 6, portrait: '/portraits/77.webp' },
  { id: 78, name: 'Mañjuśrī', subtitle: 'Bodhisattva of Wisdom', ray: 'Blue', rarity: 'Epic', cl: 5, portrait: '/portraits/78.webp' },
  { id: 79, name: 'Samantabhadra', subtitle: 'Bodhisattva of All-Encompassing Practice', ray: 'AllRays', rarity: 'Legendary', cl: 4, portrait: '/portraits/79.webp' },
  { id: 80, name: 'Medicine Buddha', subtitle: 'Bhaiṣajyaguru', ray: 'Blue', rarity: 'Epic', cl: 3, portrait: '/portraits/80.webp' },
  { id: 81, name: 'Longchen Rabjam', subtitle: 'Longchenpa — Dzogchen Master', ray: 'White', rarity: 'Rare', cl: 7, portrait: '/portraits/81.webp' },
  { id: 82, name: 'Shiva', subtitle: 'Mahadev — Destruction–Renewal Axis', ray: 'Blue', rarity: 'Legendary', cl: 6, portrait: '/portraits/82.webp' },
  { id: 83, name: 'Parvati', subtitle: 'Uma — Queen of Harmony', ray: 'Pink', rarity: 'Epic', cl: 4, portrait: '/portraits/83.webp' },
  { id: 84, name: 'Ganesha', subtitle: 'Vinayaka — Remover of Obstacles', ray: 'Yellow', rarity: 'Epic', cl: 1, portrait: '/portraits/84.webp' },
  { id: 85, name: 'Lakshmi', subtitle: 'Śri — Śrī Lakṣmī', ray: 'Pink', rarity: 'Epic', cl: 3, portrait: '/portraits/85.webp' },
  { id: 86, name: 'Durga', subtitle: 'Ambā — Demon-Slayer Narrative Boss', ray: 'Blue', rarity: 'Legendary', cl: 5, portrait: '/portraits/86.webp' },
  { id: 87, name: 'Kali', subtitle: 'Mahākālī — Time & Liberation', ray: 'Violet', rarity: 'Rare', cl: 7, portrait: '/portraits/87.webp' },
  { id: 88, name: 'Kartikeya', subtitle: 'Skanda/Muruga — Vigorous Dharma Commander', ray: 'Blue', rarity: 'Epic', cl: 4, portrait: '/portraits/88.webp' },
  { id: 89, name: 'Surya', subtitle: 'Āditya — Cosmic Rhythm', ray: 'White', rarity: 'Rare', cl: 2, portrait: '/portraits/89.webp' },
  { id: 90, name: 'Indra', subtitle: 'Śakradev — Sovereign Storm & Order Challenge', ray: 'Blue', rarity: 'Epic', cl: 5, portrait: '/portraits/90.webp' },
  { id: 91, name: 'Ganga', subtitle: 'River Goddess', ray: 'Blue', rarity: 'Epic', cl: 3, portrait: '/portraits/91.webp' },
  { id: 92, name: 'Amaterasu', subtitle: 'Solar Kami Sovereign', ray: 'White', rarity: 'Rare', cl: 1, portrait: '/portraits/92.webp' },
  { id: 93, name: 'Susanoo', subtitle: 'Storm Cleanser', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/93.webp' },
  { id: 94, name: 'Tsukuyomi', subtitle: 'Lunar Discrimination', ray: 'Violet', rarity: 'Rare', cl: 1, portrait: '/portraits/94.webp' },
  { id: 95, name: 'Inari', subtitle: 'Rice & Threshold Kami', ray: 'Green', rarity: 'Rare', cl: 1, portrait: '/portraits/95.webp' },
  { id: 96, name: 'Ōkuninushi', subtitle: 'Hospitable Land Lord', ray: 'Pink', rarity: 'Rare', cl: 1, portrait: '/portraits/96.webp' },
  { id: 97, name: 'Izanami', subtitle: 'Yomi Threshold Steward', ray: 'Violet', rarity: 'Rare', cl: 1, portrait: '/portraits/97.webp' },
  { id: 98, name: 'Hachiman', subtitle: 'Protective Archer Sovereign', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/98.webp' },
  { id: 99, name: 'Benzaiten', subtitle: 'Flowing Arts Sarasvatī bridge', ray: 'Pink', rarity: 'Rare', cl: 1, portrait: '/portraits/99.webp' },
  { id: 100, name: 'Kūkai', subtitle: 'Kōbō Daishi — Mandala Architect', ray: 'White', rarity: 'Rare', cl: 1, portrait: '/portraits/100.webp' },
  { id: 101, name: 'Nichiren', subtitle: 'Lotus Réform Beacon', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/101.webp' },
  { id: 102, name: 'Xuanyuan Huangdi', subtitle: 'Yellow Emperor Archetype', ray: 'Yellow', rarity: 'Rare', cl: 1, portrait: '/portraits/102.webp' },
  { id: 103, name: 'Xiwangmu', subtitle: 'Queen Mother of West', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/103.webp' },
  { id: 104, name: 'Laozi', subtitle: 'Dao Minimal Governance', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/104.webp' },
  { id: 105, name: 'Kongzi (Confucius)', subtitle: 'Ren & Mentorship Ethics', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/105.webp' },
  { id: 106, name: 'Guan Yu / Guandi', subtitle: 'Loyalty & Commerce Honour', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/106.webp' },
  { id: 107, name: 'Mazu', subtitle: 'Sea Patron Tianhou', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/107.webp' },
  { id: 108, name: 'Nezha', subtitle: 'Lotus Body Renewal', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/108.webp' },
  { id: 109, name: 'Sun Wukong', subtitle: 'Pilgrim Monkey King Satire Ethics', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/109.webp' },
  { id: 110, name: 'Yu the Great', subtitle: 'Flood Engineering Steward', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/110.webp' },
  { id: 111, name: 'Lei Gong', subtitle: 'Thunder Tribunal', ray: 'Violet', rarity: 'Rare', cl: 1, portrait: '/portraits/111.webp' },
  { id: 112, name: 'Dewi Sri', subtitle: 'Rice Mother', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/112.webp' },
  { id: 113, name: 'Nyai Roro Kidul', subtitle: 'Southern Ocean Sovereign', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/113.webp' },
  { id: 114, name: 'Semar', subtitle: 'Wayang Wisdom Clown Mentor', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/114.webp' },
  { id: 115, name: 'Batara Guru', subtitle: 'Cosmic Mentor Archetype', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/115.webp' },
  { id: 116, name: 'Barong Ket', subtitle: 'Protector Balance', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/116.webp' },
  { id: 117, name: 'Garuda', subtitle: 'Unity Bird Archetype', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/117.webp' },
  { id: 118, name: 'Gatotkaca', subtitle: 'Flying Pandava-derived Hero Local', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/118.webp' },
  { id: 119, name: 'Prince Panji', subtitle: 'Cycle Romance Sovereignty', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/119.webp' },
  { id: 120, name: 'Roro Jonggrang', subtitle: 'Temple Bargain Steward', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/120.webp' },
  { id: 121, name: 'Dewi Nawang Wulan', subtitle: 'Moon Hospitality Archetype', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/121.webp' },
  { id: 122, name: 'Seven Sisters Songline Steward', subtitle: 'Pleiades Multi-nation Compass', ray: 'Violet', rarity: 'Rare', cl: 1, portrait: '/portraits/122.webp' },
  { id: 123, name: 'Rainbow Serpent Country Law', subtitle: 'Hydrological Ethics Composite', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/123.webp' },
  { id: 124, name: 'Bunjil', subtitle: 'Kulin Creator Eagle', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/124.webp' },
  { id: 125, name: 'Baiame', subtitle: 'Regional Sky Father Steward', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/125.webp' },
  { id: 126, name: 'Tagai Navigator', subtitle: 'Torres Strait Celestial Voyaging', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/126.webp' },
  { id: 127, name: 'Celestial Emu Dreaming Steward', subtitle: 'Dark Constellation STEM', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/127.webp' },
  { id: 128, name: 'Djang\'kawu Creator Voyagers', subtitle: 'Yolŋu voyaging archetype', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/128.webp' },
  { id: 129, name: 'Namarrkon', subtitle: 'Arnhem Lightning Law', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/129.webp' },
  { id: 130, name: 'Country Knowledge Walk (Tjukurpa education frame)', subtitle: '', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/130.webp' },
  { id: 131, name: 'Makarrata Treaty Bridge', subtitle: 'Truth treaty repair lore', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/131.webp' },
  { id: 132, name: 'Papatūānuku', subtitle: 'Earth Mother', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/132.webp' },
  { id: 133, name: 'Ranginui', subtitle: 'Sky Father', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/133.webp' },
  { id: 134, name: 'Tāne Mahuta', subtitle: 'Forest Intercessor', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/134.webp' },
  { id: 135, name: 'Tangaroa (Māori strand)', subtitle: '', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/135.webp' },
  { id: 136, name: 'Rongo', subtitle: 'Peace & Cultivation', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/136.webp' },
  { id: 137, name: 'Tūmatauenga', subtitle: 'Whānau Defender', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/137.webp' },
  { id: 138, name: 'Tāwhirimatea', subtitle: 'Storm winds resilience', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/138.webp' },
  { id: 139, name: 'Haumiatiketike', subtitle: 'Wild foods stealth', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/139.webp' },
  { id: 140, name: 'Hine-nui-te-pō', subtitle: 'Threshold transformation', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/140.webp' },
  { id: 141, name: 'Kupe Navigator', subtitle: 'Voyager cartography ethic', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/141.webp' },
  { id: 142, name: 'Ọṣun', subtitle: 'River reciprocity òrìṣà', ray: 'RubyGold', rarity: 'Rare', cl: 1, portrait: '/portraits/142.webp' },
  { id: 143, name: 'Ṣàngó', subtitle: 'Thunder-order justice lore', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/143.webp' },
  { id: 144, name: 'Ọbàtálá', subtitle: 'Calm-maker / elder craft', ray: 'White', rarity: 'Rare', cl: 1, portrait: '/portraits/144.webp' },
  { id: 145, name: 'Ọya', subtitle: 'Wind-crossing refactor', ray: 'Violet', rarity: 'Rare', cl: 1, portrait: '/portraits/145.webp' },
  { id: 146, name: 'Mawu-Lisa', subtitle: 'Fon cosmology dual stewardship', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/146.webp' },
  { id: 147, name: 'Nyame / Nyankopon', subtitle: 'Akan high-god pedagogical compass', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/147.webp' },
  { id: 148, name: 'Kwaku Ananse', subtitle: 'Story-weaver pedagogy', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/148.webp' },
  { id: 149, name: 'Ausar-Osiris', subtitle: 'Kemetic cyclic renewal ethics', ray: 'Green', rarity: 'Rare', cl: 1, portrait: '/portraits/149.webp' },
  { id: 150, name: 'Maʿăt', subtitle: 'Feather tribunal / integrity voting', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/150.webp' },
  { id: 151, name: 'Anna Njinga', subtitle: 'Ndongo–Matamba resistance diplomat', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/151.webp' },
  { id: 152, name: 'Atlas', subtitle: 'Ring steward / eldest king frame', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/152.webp' },
  { id: 153, name: 'Cleito', subtitle: '*Kleitó* sanctuary consent', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/153.webp' },
  { id: 154, name: 'Gadeirus', subtitle: 'Harbor-ring / strait ethics', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/154.webp' },
  { id: 155, name: 'Ampheres', subtitle: 'Proportional loadshare', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/155.webp' },
  { id: 156, name: 'Evaemon', subtitle: 'Good-custom law etiquette', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/156.webp' },
  { id: 157, name: 'Mneseus', subtitle: 'Chain memory archives', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/157.webp' },
  { id: 158, name: 'Autochthon', subtitle: 'Local-first legitimacy', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/158.webp' },
  { id: 159, name: 'Elasippus', subtitle: 'Routing cadence fairness', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/159.webp' },
  { id: 160, name: 'Mestor', subtitle: 'Accord mediator', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/160.webp' },
  { id: 161, name: 'Azaes', subtitle: 'Risk-bound explorer', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/161.webp' },
  { id: 162, name: 'Lemur Steward', subtitle: 'Biodiversity-before-babel Madagascar frame', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/162.webp' },
  { id: 163, name: 'Sclater Bridge', subtitle: 'Hypothesis retractions pedagogy', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/163.webp' },
  { id: 164, name: 'Coral Notary', subtitle: 'Reef accountability witness', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/164.webp' },
  { id: 165, name: 'Tide Column', subtitle: 'Fair tidal rhythm / mempool equity lore', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/165.webp' },
  { id: 166, name: 'Basalt Chronicle', subtitle: 'MORB / ridge basalt geology honesty', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/166.webp' },
  { id: 167, name: 'Foam Seed', subtitle: 'Dispersal ethics without colonial map', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/167.webp' },
  { id: 168, name: 'Oceanic Bridge', subtitle: 'Pacific solidarity scaffold', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/168.webp' },
  { id: 169, name: 'Shelf Whisper', subtitle: 'Shelf subsidence realism', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/169.webp' },
  { id: 170, name: 'Equinox Lull', subtitle: 'Volatility moderation at thresholds', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/170.webp' },
  { id: 171, name: 'Circle Closure', subtitle: 'Meta-bridge tee to cosmic wave', ray: 'Violet', rarity: 'Rare', cl: 1, portrait: '/portraits/171.webp' },
  { id: 172, name: 'Great Central Sun Steward', subtitle: 'Cosmic clock / consensus frame', ray: 'White', rarity: 'Rare', cl: 1, portrait: '/portraits/172.webp' },
  { id: 173, name: 'Photon Cadence', subtitle: 'Photon-belt gates as season pacing only', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/173.webp' },
  { id: 174, name: 'Solar Logos Dual', subtitle: 'Helios/Vesta-style dual signing metaphor', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/174.webp' },
  { id: 175, name: 'Telluric Soul Bridge', subtitle: 'Planetary soul bridge; cross #25 Lady Gaia', ray: 'Violet', rarity: 'Rare', cl: 1, portrait: '/portraits/175.webp' },
  { id: 176, name: 'Tube-of-Light Sentinel', subtitle: 'OPSEC visual from Vzestup practice names', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/176.webp' },
  { id: 177, name: 'Radiant Spiral', subtitle: 'Guild XP spiral — not body claims', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/177.webp' },
  { id: 178, name: 'Seventh Ray Adjunct', subtitle: 'Violet frequency UI next to Saint Germain #26', ray: 'Violet', rarity: 'Rare', cl: 1, portrait: '/portraits/178.webp' },
  { id: 179, name: 'Galactic Convenor', subtitle: 'Galactic Federation parliament — tiered mandates, not Earth-ethnic ranking', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/179.webp' },
  { id: 180, name: 'Lightbody Scribe', subtitle: 'Journaling only — no therapeutic NFT', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/180.webp' },
  { id: 181, name: 'Vzestup Capstone', subtitle: '13th expansion decad closure → COSMIC_MAP', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/181.webp' },
  { id: 182, name: 'Valhalla Hall-Steward', subtitle: 'Einherjar etiquette / rest cycle — not afterlife theology', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/182.webp' },
  { id: 183, name: 'Óðinn Wayfarer', subtitle: 'Governance raven-log / fork review', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/183.webp' },
  { id: 184, name: 'Þórr Storm-Host', subtitle: 'Uptime / community safety — not toxic alpha trope', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/184.webp' },
  { id: 185, name: 'Freyja Van-Ruler', subtitle: 'Fair treasury + privacy lore — no sexualized combat', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/185.webp' },
  { id: 186, name: 'Týr Oath-Fire', subtitle: 'Timelock sacrifice / smart-contract honor', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/186.webp' },
  { id: 187, name: 'Brigid Triple-Flame', subtitle: 'Forge / docs / care — syncretism disclaimer', ray: 'White', rarity: 'Rare', cl: 1, portrait: '/portraits/187.webp' },
  { id: 188, name: 'Dagda Peace-Harp', subtitle: 'Public goods / epoch spacing', ray: 'Green', rarity: 'Rare', cl: 1, portrait: '/portraits/188.webp' },
  { id: 189, name: 'Morrígan Sovereignty-Raven', subtitle: 'Threat triage — mandatory art consult', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/189.webp' },
  { id: 190, name: 'Lugh Samildanach', subtitle: 'Multi-skill multisig / mentor rotation', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/190.webp' },
  { id: 191, name: 'Manannán mac Lir', subtitle: 'Sandbox / mist boundaries between chains', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/191.webp' },
  { id: 192, name: 'Ré Solar-Barque', subtitle: 'Epoch heartbeat / anti-FOMO pacing', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/192.webp' },
  { id: 193, name: 'Hor Unifier', subtitle: 'Double-crown governance; cross #149 Osiris', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/193.webp' },
  { id: 194, name: 'Thoth Scribe', subtitle: 'Merkle / changelog integrity', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/194.webp' },
  { id: 195, name: 'Hathor Jubilee', subtitle: 'Community celebration / anti-spam fests', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/195.webp' },
  { id: 196, name: 'Sekhmet Audit-Flame', subtitle: 'Slashing + cooling debrief — art gate', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/196.webp' },
  { id: 197, name: 'Ptah Mason', subtitle: 'Genesis bytecode / factory safety', ray: 'Green', rarity: 'Rare', cl: 1, portrait: '/portraits/197.webp' },
  { id: 198, name: 'Anubis Threshold', subtitle: 'Migration snapshots — no gore NFTs', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/198.webp' },
  { id: 199, name: 'Amun Hidden-Field', subtitle: 'Commit–reveal / private tally lore', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/199.webp' },
  { id: 200, name: 'Geb Foundation', subtitle: 'L1 substrate / hosting reality check', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/200.webp' },
  { id: 201, name: 'Nut Stellar Vault', subtitle: 'Sharding / nightly maintenance metaphor', ray: 'Blue', rarity: 'Rare', cl: 1, portrait: '/portraits/201.webp' },
  { id: 202, name: 'Bolon Yokte\' K\'uh', subtitle: 'God of Nine Steps', ray: 'Obsidian', rarity: 'Legendary', cl: 7, portrait: '/portraits/202.webp' },
  { id: 203, name: 'Sri Anagha Lakshmi', subtitle: 'Divine Mother Trinity', ray: 'AllRays', rarity: 'Legendary', cl: 9, portrait: '/portraits/203.webp' },
  { id: 204, name: 'Sri Chaitanya Mahaprabhu', subtitle: 'Golden Avatar', ray: 'Yellow', rarity: 'Legendary', cl: 8, portrait: '/portraits/204.webp' },
];

export const AVATARS_BY_ID = new Map<number, AvatarEntry>(AVATARS.map((avatar) => [avatar.id, avatar]));

/** Barvy paprsků — jedna paleta pro model, odznak i picker. */
export const RAY_COLOR: Record<AvatarRay, string> = {
  Blue: '#4a7bff',
  Pink: '#ff6ec7',
  Yellow: '#ffd166',
  Violet: '#9333ea',
  Green: '#10b981',
  White: '#e8eef7',
  RubyGold: '#e8b23a',
  Obsidian: '#3b2a45',
  AllRays: '#7fe3d4',
};

export const RARITY_COLOR: Record<AvatarRarity, string> = {
  Rare: '#7fe3d4',
  Epic: '#c8f56a',
  Legendary: '#ffd166',
  OneOfOne: '#ff9de2',
};

export function avatarById(id: number | null | undefined): AvatarEntry | null {
  if (typeof id !== 'number') return null;
  return AVATARS_BY_ID.get(id) ?? null;
}
