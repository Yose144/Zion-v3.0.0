#!/usr/bin/env python3
"""
Hiran v2.3 Knowledge: Religion & Spirituality
Generates structured documents on world religions, sacred texts, and spiritual traditions.
These documents are chunked and indexed for RAG retrieval.
"""

import random
from pathlib import Path
from datetime import datetime

random.seed(50)

OUTPUT_DIR = Path(__file__).parent.parent / "corpora"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Book of Amduat (Ancient Egyptian funerary text)
AMDUAT_DOCUMENTS = [
    {
        "title": "The Book of Amduat: Overview",
        "content": """The Book of Amduat (literally "That Which Is In the Netherworld") is an ancient Egyptian funerary text dating from the New Kingdom period (c. 1550-1077 BCE). It describes the journey of the sun god Ra through the twelve hours of the night, from sunset to sunrise.

The text was intended for the Pharaoh alone and was painted on the walls of royal tombs in the Valley of the Kings. Unlike other funerary texts that were accessible to all, the Amduat contained secret knowledge meant only for the divine king.

Structure: The Amduat is divided into twelve hours, each representing a stage of the sun god's nightly journey through the Duat (underworld). Each hour has:
- A title indicating the region
- A description of the landscape and inhabitants
- Protective deities and demons encountered
- Instructions for the soul's safe passage
- The goal: Ra's rebirth at dawn

The text emphasizes that knowledge of the underworld's geography and its divine inhabitants was essential for the Pharaoh's successful transformation into an eternal deity."""
    },
    {
        "title": "Amduat: The First Three Hours of Night",
        "content": """First Hour (Sunset): Ra enters the western horizon in his solar bark. The landscape is fertile and welcoming. The gods shout praises as Ra descends. This hour represents the transition from day to night, from life to death.

Second Hour: The river divides into two streams — the "Waters of Osiris" and the "Waters of Ra." Divine beings tend the fields along the banks. The blessed dead live here in peace, receiving offerings from the living. This region is called "Wernes."

Third Hour: The solar bark enters the "Hall of Judgment." Ra must prove his divine authority before the tribunal of gods. The enemies of order — chaos serpents and demons — attempt to stop the sun god. Protective spells and the names of guardians must be known to pass safely.

Key deities encountered: Osiris (lord of the dead), Isis (protective mother), Nephthys (guardian of the threshold), Thoth (scribe of the gods), Horus (avenger of his father)."""
    },
    {
        "title": "Amduat: The Middle Hours (4-9)",
        "content": """Fourth through Sixth Hours: These are the most dangerous regions of the Duat. The solar bark passes through caverns filled with serpents, lakes of fire, and demons who threaten to extinguish the divine light.

In the Sixth Hour, Ra reaches the deepest point — the "Midnight Hour." Here Osiris lies in his mummy wrappings, and Ra must unite with him. This union represents the merging of solar power (Ra) with regenerative power (Osiris). The dead Pharaoh participates in this union, gaining the power of rebirth.

Seventh through Ninth Hours: The journey turns toward rebirth. Ra encounters the "Hidden Chamber" where the corpse of Osiris is guarded by serpents. The god must speak secret names to pass. The "Lake of Fire" must be crossed — those who know the spells are safe, those who do not are consumed.

In the Ninth Hour, the "Destroyer" (a huge serpent) attempts to swallow the sun. The gods of the Ennead must fight to protect the bark. This represents the eternal struggle between order (Ma'at) and chaos (Isfet)."""
    },
    {
        "title": "Amduat: The Final Hours and Rebirth",
        "content": """Tenth Hour: The solar bark approaches the eastern horizon. The atmosphere changes — darkness begins to recede. The "Shining Ones" appear, beings of light who prepare the way for dawn. The dead Pharaoh begins his transformation from mummy to spirit.

Eleventh Hour: The "Sacred Eye" (the restored eye of Horus) is presented to Ra. This symbolizes the healing of cosmic wounds. The enemies of the sun god are bound and defeated. The Pharaoh, now identified with Ra, is prepared for his celestial ascent.

Twelfth Hour (Sunrise): The climax of the journey. Ra emerges from the eastern horizon as Khepri, the scarab beetle god of the morning sun. The cycle is complete. Death is transformed into rebirth.

Theological significance: The Amduat teaches that death is not an end but a journey. Knowledge — knowing the names of gods, the geography of the underworld, and the proper spells — is the key to survival. The Pharaoh, as mediator between gods and humans, must possess this secret knowledge to maintain cosmic order even after death.

Archaeological evidence: The earliest complete copy is in the tomb of Thutmose III (KV34). Later versions appear in the tombs of Amenhotep II, Seti I, Ramesses VI, and others. The text was also abbreviated in the tombs of queens and nobles."""
    },
    {
        "title": "The Bible: Historical Overview",
        "content": """The Bible is a collection of religious texts sacred to Christianity, Judaism, Samaritanism, and other faiths. It is divided into two main sections:

The Old Testament (Hebrew Bible / Tanakh):
- Torah (Law): Genesis, Exodus, Leviticus, Numbers, Deuteronomy
- Nevi'im (Prophets): Historical books and prophetic writings
- Ketuvim (Writings): Wisdom literature, poetry, and historical accounts

The New Testament (Christian addition):
- Four Gospels (Matthew, Mark, Luke, John)
- Acts of the Apostles
- Epistles (letters of Paul and others)
- Book of Revelation (apocalyptic prophecy)

Historical composition: The texts were written over approximately 1,000 years (c. 1200 BCE to 100 CE) by multiple authors in Hebrew, Aramaic, and Greek. The oldest complete Hebrew manuscripts date to the 10th century CE (Aleppo Codex, Leningrad Codex). The Dead Sea Scrolls (discovered 1947) contain fragments from 250 BCE to 68 CE.

Theological themes: Creation and fall, covenant and law, prophecy and fulfillment, sin and redemption, death and resurrection, judgment and salvation, the Kingdom of God."""
    },
    {
        "title": "World Religions: Major Traditions",
        "content": """Hinduism (c. 1500 BCE): Originated in the Indus Valley. No single founder. Sacred texts include the Vedas, Upanishads, Bhagavad Gita, and Puranas. Concepts: Dharma (duty), Karma (action/consequence), Samsara (reincarnation), Moksha (liberation). Major deities: Brahma (creator), Vishnu (preserver), Shiva (destroyer).

Buddhism (c. 500 BCE): Founded by Siddhartha Gautama (the Buddha) in India. Core teachings: Four Noble Truths (suffering, cause, cessation, path) and the Eightfold Path. Schools: Theravada (Southern), Mahayana (Eastern), Vajrayana (Tibetan). Sacred texts: Tripitaka, Lotus Sutra, Tibetan Book of the Dead.

Judaism (c. 1800 BCE): Founded by Abraham according to tradition. Monotheistic. Sacred text: Hebrew Bible (Tanakh) and Talmud (oral law). Core concepts: Covenant with God, Mosaic Law, waiting for the Messiah. Branches: Orthodox, Conservative, Reform.

Christianity (c. 30 CE): Founded by the teachings of Jesus of Nazareth. Sacred text: The Bible (Old and New Testaments). Core belief: Jesus is the Son of God, crucified and resurrected for human salvation. Major branches: Catholicism, Eastern Orthodoxy, Protestantism.

Islam (c. 610 CE): Founded by Muhammad in Arabia. Sacred text: Quran (revealed by Allah through Gabriel). Core practices: Five Pillars (faith, prayer, charity, fasting, pilgrimage). Major branches: Sunni (majority) and Shia.

Sikhism (c. 1500 CE): Founded by Guru Nanak in Punjab. Sacred text: Guru Granth Sahib. Core beliefs: One God, equality of all humans, honest labor, sharing with others.

Taoism (c. 500 BCE): Founded by Laozi (Lao Tzu). Sacred text: Tao Te Ching. Core concept: The Tao (the Way) — the natural order of the universe. Harmony with nature and wu wei (effortless action)."""
    },
    {
        "title": "Sacred Geometry and Symbolism",
        "content": """Ancient civilizations used geometric symbols to represent cosmic principles:

The Ankh (Egyptian): Symbol of life, combining the male (vertical line) and female (horizontal line) principles. Often shown being held to the lips of a Pharaoh, representing the breath of life.

The Ouroboros: A serpent eating its own tail, symbolizing eternal cycles of destruction and rebirth. Found in Egyptian, Greek, and alchemical traditions.

The Flower of Life: Overlapping circles forming a flower-like pattern. Found in temples across Egypt, India, and China. Believed to represent the fundamental forms of space and time.

The Tree of Life: Found in Kabbalah (Jewish mysticism), Norse mythology (Yggdrasil), and many other traditions. Represents the connection between heaven, earth, and the underworld.

The Mandala (Hindu/Buddhist): A geometric configuration of symbols representing the cosmos. Used in meditation to focus the mind and represent the spiritual journey from outside to the inner core.

The Yin-Yang (Taoist): Represents the duality of existence — light/dark, male/female, active/passive. The dots within each half show that each contains the seed of the other.

The Lotus (Egyptian/Hindu/Buddhist): Symbol of purity and rebirth. The lotus rises from muddy water to bloom clean, representing the soul's ascent from material existence to spiritual enlightenment."""
    },
]

# Bible - deeper content
BIBLE_DOCUMENTS = [
    {
        "title": "Genesis: Creation and Early Humanity",
        "content": """Genesis 1-2: Creation. God creates the world in six days: light, sky, land and sea, plants, sun/moon/stars, sea creatures and birds, land animals and humans. On the seventh day, God rests. Humanity is created in God's image (Imago Dei) and given dominion over the earth.

Genesis 3: The Fall. Adam and Eve eat from the Tree of Knowledge of Good and Evil, disobeying God. They are expelled from Eden. This introduces sin, death, and separation from God into the world. God promises a future redeemer (the "seed of the woman" who will crush the serpent's head).

Genesis 4-11: Cain and Abel, the Flood, and the Tower of Babel. Noah builds an ark and survives the flood (Genesis 6-9). God's covenant with Noah: the rainbow as a sign that God will never again destroy all life by water. The Tower of Babel: humanity's pride leads to the confusion of languages and dispersion across the earth.

Genesis 12-50: The Patriarchs. Abraham is called from Ur to Canaan (c. 1800 BCE). God's covenant: Abraham's descendants will become a great nation, and through them all nations will be blessed. Isaac, Jacob (Israel), and the twelve tribes. Joseph sold into slavery in Egypt, rises to power, and saves his family from famine."""
    },
    {
        "title": "Exodus: Liberation and Law",
        "content": """Exodus tells the story of Israel's liberation from Egyptian slavery (c. 1446 or 1290 BCE, depending on dating).

The Plagues: God sends ten plagues upon Egypt to compel Pharaoh to release the Israelites — water turned to blood, frogs, gnats, flies, livestock disease, boils, hail, locusts, darkness, and the death of the firstborn. The Israelites are spared from the final plague by marking their doors with lamb's blood (the Passover).

The Exodus: Moses leads the Israelites out of Egypt, crossing the Red Sea. The Egyptian army is destroyed. The people travel through the wilderness toward Mount Sinai.

The Ten Commandments (Exodus 20): At Mount Sinai, God gives Moses the tablets of the Law. The commandments cover worship of God alone, prohibition of idols, honoring God's name, Sabbath rest, honoring parents, prohibitions on murder, adultery, theft, false witness, and coveting.

The Tabernacle: Detailed instructions for constructing the portable sanctuary where God's presence (Shekinah) dwells among the people. Includes the Ark of the Covenant, the altar, the menorah, and priestly garments.

Forty Years in the Wilderness: Due to the people's disobedience (worshipping the golden calf, refusing to enter Canaan), they wander for 40 years. Moses dies before reaching the Promised Land and is succeeded by Joshua."""
    },
    {
        "title": "The Gospels: Life and Teachings of Jesus",
        "content": """The four Gospels present Jesus of Nazareth from different perspectives:

Matthew: Written for Jewish Christians. Emphasizes Jesus as the fulfillment of Old Testament prophecy. Contains the Sermon on the Mount (Matthew 5-7), the most comprehensive collection of Jesus' teachings. The Beatitudes ("Blessed are the poor in spirit..."), the Lord's Prayer, the Golden Rule ("Do to others as you would have them do to you").

Mark: The shortest and earliest Gospel. Written for Gentile (non-Jewish) readers. Emphasizes Jesus' actions and miracles. The messianic secret — Jesus repeatedly tells people not to reveal his identity, a theme unique to Mark.

Luke: Written by a physician and companion of Paul. Emphasizes Jesus' compassion for the poor, women, and marginalized. Contains unique parables: the Good Samaritan, the Prodigal Son, the Rich Man and Lazarus. Also contains the most detailed account of Jesus' birth.

John: The most theological Gospel. Opens with the Logos (Word) — "In the beginning was the Word, and the Word was with God, and the Word was God." Emphasizes Jesus' divine nature. Contains the "I am" statements: I am the bread of life, the light of the world, the door, the good shepherd, the resurrection and the life, the way/truth/life, the true vine.

Key events: Birth in Bethlehem, baptism by John, temptation in the wilderness, Galilean ministry (healing, teaching, parables), entry into Jerusalem, Last Supper, crucifixion at Golgotha, resurrection on the third day, ascension to heaven."""
    },
]

def write_documents(docs, filename_prefix):
    """Write documents to markdown files."""
    for i, doc in enumerate(docs):
        filename = OUTPUT_DIR / f"{filename_prefix}_{i:03d}.md"
        content = f"""# {doc['title']}

**Domain:** Religion & Spirituality
**Category:** {filename_prefix.replace('_', ' ').title()}
**Date Indexed:** {datetime.now().strftime('%Y-%m-%d')}
**Language:** English

---

{doc['content']}

---
*Source: Generated knowledge corpus for Hiran v2.3 RAG system*
"""
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
    print(f"  Written {len(docs)} documents to {filename_prefix}_*.md")


def main():
    print("Generating religion & spirituality knowledge corpus...")
    write_documents(AMDUAT_DOCUMENTS, "religion_amduat")
    write_documents(BIBLE_DOCUMENTS, "religion_bible")
    write_documents([
        {
            "title": "World Religions Summary",
            "content": AMDUAT_DOCUMENTS[5]["content"] if len(AMDUAT_DOCUMENTS) > 5 else ""
        }
    ], "religion_overview")
    print(f"\nReligion corpus complete. Files in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
