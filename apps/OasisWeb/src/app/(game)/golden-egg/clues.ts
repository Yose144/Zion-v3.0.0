export type ClueCategory = 'library' | 'avatar' | 'world' | 'source' | 'community';

export interface Clue {
  id: string;
  category: ClueCategory;
  hint: string;
}

export const CATEGORIES: Record<ClueCategory, string> = {
  library: 'Sacred Library',
  avatar: 'Avatar Quests',
  world: 'Hidden in the World',
  source: 'Source Code',
  community: 'Community Wisdom',
};

export const CLUES: Clue[] = generateClues();

function generateClues(): Clue[] {
  const clues: Clue[] = [];
  const counts: Record<ClueCategory, number> = { library: 40, avatar: 30, world: 20, source: 10, community: 8 };
  const hints: Record<ClueCategory, string[]> = {
    library: [
      'Look where the Flower of Life first blooms.',
      'The violet flame holds the next letter.',
      'Count the veils between you and the Creator.',
      'Search the emerald tablets of Thoth.',
      'What is the first word of the first law?',
      'A number hidden in the Hall of Amenti.',
      'The Great Pyramid points to a star.',
      'Meru is the center of the wheel.',
      'Find the silence between two thoughts.',
      'The breath of Brahma encodes it.',
      'In the Akashic record, page 108.',
      'The seventh seal reveals a color.',
      'Look for the thread that binds Vedas and Bible.',
      'A mantra in the Key of David.',
      'The phoenix leaves a feather in the ashes.',
      'Sirius shines on the third step.',
      'The Tree of Life has 33 rungs.',
      'Merkaba rotation is 34 degrees.',
      'The Atlantean crystal still hums.',
      'A glyph under the Sphinx paw.',
      'The emerald flame answers greed.',
      'The 12 tribes are 12 frequencies.',
      'A name spoken backwards opens it.',
      'The lost chord is in the octave above.',
      'In the Book of the Dead, spell 125.',
      'The Ark of the Covenant weighs 108.',
      'The Grail is a state, not a cup.',
      'Look where Uriel hides the sun.',
      'The 8th sphere is the first clue.',
      'The diamond body is older than bones.',
      'The serpent rises 3.5 times.',
      'Find the 72 names in sequence.',
      'The Book of Enoch names the watcher.',
      'A cube within a cube within a star.',
      'The tetractys hides the master key.',
      'The lightning strike forms a glyph.',
      'The first day of the sixth sun.',
      'Pillar of Fire, verse 7.',
      'The shekhinah descends at 60 degrees.',
      'The 108 beads are 108 doors.',
    ],
    avatar: [
      'The Warrior leaves a footprint at dawn.',
      'The Monk rings a bell 108 times.',
      'The Scientist hides data in plain sight.',
      'The Alchemist turns lead into a phrase.',
      'The Oracle speaks only in questions.',
      'The Healer holds the herb of forgetting.',
      'The Architect built a door in the air.',
      'The Pilgrim crossed the desert at noon.',
      'The Bard sings the 9th verse backwards.',
      'The Guardian waits where two rivers meet.',
      'The Mystic drew the clue in sand.',
      'The Captain buried it under deck 7.',
      'The Weaver tied it into the loom.',
      'The Hermit carved it on a stone.',
      'The Hunter found it in a silver track.',
      'The Smith forged the key in water.',
      'The Lover hides it in a heartbeat.',
      'The King lost it in the crown jewels.',
      'The Prophet signed it with fire.',
      'The Dreamer left it under a pillow.',
      'The Dancer stepped on the right star.',
      'The Scribe wrote it between the lines.',
      'The Guide placed it at the crossroads.',
      'The Rebel painted it on a banner.',
      'The Sage whispered it to the wind.',
      'The Child drew a circle around it.',
      'The Elder remembers the unspoken name.',
      'The Wanderer found it in a mirror.',
      'The Artist hid it in the negative space.',
      'The Keeper locked it with a smile.',
    ],
    world: [
      'A block hash ends with the sacred number.',
      'The genesis flower is not what it seems.',
      'Follow the tithe path to the fountain.',
      'The pool difficulty whispers a word.',
      'A P2P handshake hides the symbol.',
      'The first mined block has no parents.',
      'The chain height equals 10,800.',
      'A smart contract returns 42.',
      'The bridge burns the exact answer.',
      'A DAO vote contains the passphrase.',
      'The fountain of rewards is dry at 7.',
      'The ledger of souls is page 108.',
      'A node log prints a glyph at midnight.',
      'The mempool holds a poem.',
      'The difficulty bomb is a flower.',
      'A special coinbase has no outputs.',
      'The explorer hides it in HTML.',
      'The validator signed with a riddle.',
      'A cross-chain receipt names the key.',
      'The watchtower sees it at block 7777.',
    ],
    source: [
      'Search for the comment with three stars.',
      'A variable named after a constellation.',
      'The uncommitted line contains the truth.',
      'Find the TODO marked SACRED.',
      'A magic number in consensus.rs.',
      'The genesis hash has a twin.',
      'A dead code path still compiles.',
      'The test that never runs knows it.',
      'A git tag points to the answer.',
      'The build script prints it in bytes.',
    ],
    community: [
      'The first AMA pinned a hidden link.',
      'A Discord role is named after a star.',
      'The winner of the meme contest knows.',
      'A GitHub issue has label #108.',
      'The founder wrote it in a poem.',
      'A retweet from the oracle contains it.',
      'The monthly report page 7 hides it.',
      'The community vote 42 reveals the rest.',
    ],
  };

  let id = 1;
  (Object.keys(counts) as ClueCategory[]).forEach((category) => {
    const list = hints[category];
    for (let i = 0; i < counts[category]; i++) {
      clues.push({
        id: `C${id.toString().padStart(3, '0')}`,
        category,
        hint: list[i % list.length] + (i >= list.length ? ` (echo ${i - list.length + 1})` : ''),
      });
      id++;
    }
  });
  return clues;
}
