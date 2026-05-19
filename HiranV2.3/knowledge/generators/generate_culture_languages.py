#!/usr/bin/env python3
"""
Hiran v2.3 Knowledge: World Cultures and Languages
Documents on traditions, customs, and basic language guides.
"""

from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "corpora"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CULTURE_DOCUMENTS = [
    {
        "title": "World Cultural Traditions and Festivals",
        "content": """Human cultures have developed rich traditions celebrating life, death, harvest, and the changing seasons.

Egyptian Traditions: The ancient Egyptians celebrated Opet Festival (renewal of divine kingship), the Beautiful Festival of the Valley (honoring the dead), and the Sed Festival (royal jubilee after 30 years). Modern Egypt celebrates Sham el-Nessim (spring festival dating to Pharaonic times), Eid al-Fitr, and Eid al-Adha.

Chinese Traditions: Chinese New Year (Spring Festival) is the most important celebration, marking the lunar new year with red decorations, lion dances, and family reunions. The Mid-Autumn Festival celebrates the harvest moon. Qingming Festival honors ancestors. Dragon Boat Festival commemorates the poet Qu Yuan.

Indian Traditions: Diwali (Festival of Lights) celebrates the victory of light over darkness. Holi (Festival of Colors) marks spring with colored powders. Navratri honors the goddess Durga. Weddings involve multiple days of rituals including the haldi ceremony, mehndi, and the seven sacred steps (saptapadi).

Japanese Traditions: Hanami (cherry blossom viewing) in spring. Obon honors ancestral spirits in summer. Tea ceremony (chado) is a meditative art form. Kabuki and Noh are classical theater traditions. The torii gate marks the transition from mundane to sacred space at Shinto shrines.

Hawaiian Traditions: Hula preserves genealogy, history, and mythology through dance and chant. The luau feast features kalua pig, poi, and lomi salmon. Lei (flower garlands) are given as symbols of affection and welcome. The concept of ohana (extended family) emphasizes community bonds. Makahiki season (roughly November-February) was a time of peace, games, and tribute to the god Lono.

African Traditions: Ubuntu philosophy ("I am because we are") emphasizes community. Ancestor veneration is practiced across the continent. Griots (storytellers) preserve oral history in West Africa. The Maasai jump dance (adamu) is a rite of passage. South African braai (barbecue) is a social institution.

European Traditions: Carnival/Mardi Gras precedes Lent across Catholic Europe. Oktoberfest in Bavaria celebrates beer and harvest. Spanish flamenco combines dance, guitar, and song. Italian opera originated in Florence (1580s). Russian banya (sauna) is a social and cleansing ritual.

Latin American Traditions: Día de los Muertos (Day of the Dead) in Mexico celebrates deceased loved ones with altars, marigolds, and sugar skulls. Brazilian Carnival is the world's largest festival. Argentine tango originated in Buenos Aires' working-class neighborhoods. Andean textiles use patterns dating back to Inca times.

Indigenous Americas: Powwows are intertribal gatherings featuring dance, drumming, and regalia. The potlatch (Pacific Northwest) redistributes wealth and status. The Green Corn Ceremony (Southeastern tribes) celebrates the harvest. Navajo sand paintings are temporary sacred art used in healing ceremonies."""
    },
]

LANGUAGE_DOCUMENTS = [
    {
        "title": "Language Guide: Basic Phrases in Seven Languages",
        "content": """Multi-language basics for travelers and learners.

**ENGLISH** (Germanic, ~1.5 billion speakers)
- Hello / Hi
- Thank you / Thanks
- Please
- Yes / No
- How are you?
- Good morning / afternoon / evening
- Goodbye / See you
- I don't understand
- Where is...?
- How much is this?

**CZECH** (Slavic, ~10 million speakers)
- Dobrý den (Good day)
- Ahoj (Hello/Hi — informal)
- Děkuji / Dík (Thank you)
- Prosím (Please / You're welcome)
- Ano / Ne (Yes / No)
- Jak se máš? (How are you? — informal)
- Dobré ráno / Dobrý večer (Good morning / evening)
- Nashledanou (Goodbye)
- Nerozumím (I don't understand)
- Kolik to stojí? (How much is this?)
- Miluji tě (I love you)

**PORTUGUESE** (Romance, ~250 million speakers)
- Olá / Oi (Hello / Hi)
- Obrigado/Obrigada (Thank you — m/f)
- Por favor (Please)
- Sim / Não (Yes / No)
- Como está? (How are you?)
- Bom dia / Boa tarde / Boa noite (Good morning/afternoon/night)
- Adeus / Tchau (Goodbye)
- Não entendo (I don't understand)
- Quanto custa? (How much?)
- Eu te amo (I love you)

**FRENCH** (Romance, ~300 million speakers)
- Bonjour (Hello / Good day)
- Salut (Hi — informal)
- Merci (Thank you)
- S'il vous plaît (Please — formal)
- Oui / Non (Yes / No)
- Comment allez-vous? (How are you? — formal)
- Bonjour / Bonsoir (Good morning / evening)
- Au revoir (Goodbye)
- Je ne comprends pas (I don't understand)
- Combien ça coûte? (How much?)
- Je t'aime (I love you)

**SPANISH** (Romance, ~500 million speakers)
- Hola (Hello)
- Gracias (Thank you)
- Por favor (Please)
- Sí / No (Yes / No)
- ¿Cómo estás? (How are you? — informal)
- Buenos días / Buenas tardes / noches (Good morning/afternoon/night)
- Adiós / Hasta luego (Goodbye / See you later)
- No entiendo (I don't understand)
- ¿Cuánto cuesta? (How much?)
- Te quiero / Te amo (I love you)

**HAWAIIAN** (Austronesian, ~24,000 native speakers, revitalizing)
- Aloha (Hello / Goodbye / Love / Peace)
- Mahalo (Thank you)
- ʻAe / ʻAʻole (Yes / No)
- Pehea ʻoe? (How are you?)
- Aloha kakahiaka (Good morning)
- Aloha ahiahi (Good evening)
- A hui hou (Until we meet again)
- ʻAʻole maopopo iaʻu (I don't understand)
- ʻEhia kālā? (How much money?)
- Ke aloha nui (Much love)

**HINDI** (Indo-Aryan, ~600 million speakers)
- Namaste (Hello — "I bow to you")
- Dhanyavād (Thank you)
- Kripayā (Please)
- Haan / Nahin (Yes / No)
- Aap kaise hain? (How are you? — formal)
- Suprabhat / Shubh raatri (Good morning / night)
- Alvida / Phir milenge (Goodbye / We'll meet again)
- Main samajha nahin (I don't understand)
- Kitne ka hai? (How much is this?)
- Main tumse pyaar karta/karti hoon (I love you — m/f)

Note: The Hawaiian language uses the ʻokina (glottal stop, written as ʻ) and kahakō (macron for long vowels). Hawaiian has only 13 letters: a, e, i, o, u, h, k, l, m, n, p, w, ʻ."""
    },
    {
        "title": "Language Families of the World",
        "content": """Human languages are grouped into families based on shared ancestry.

Indo-European (3 billion+ speakers): The largest language family.
- Germanic: English, German, Dutch, Swedish, Danish, Norwegian, Icelandic
- Romance: Spanish, Portuguese, French, Italian, Romanian, Catalan
- Slavic: Russian, Polish, Czech, Ukrainian, Serbian, Bulgarian
- Indo-Iranian: Hindi, Urdu, Bengali, Punjabi, Persian (Farsi), Pashto
- Celtic: Irish, Scottish Gaelic, Welsh, Breton
- Greek, Albanian, Armenian (separate branches)

Sino-Tibetan (1.3 billion+ speakers):
- Chinese: Mandarin, Cantonese, Wu, Min, Hakka, Xiang, Gan
- Tibetan: Tibetan, Dzongkha
- Burmese: Burmese, Loloish languages

Afro-Asiatic (500 million+ speakers):
- Semitic: Arabic, Hebrew, Amharic, Aramaic, Maltese
- Cushitic: Somali, Oromo, Afar
- Berber: Tamazight, Tuareg languages
- Chadic: Hausa
- Egyptian: Ancient Egyptian (Coptic is its descendant)

Austronesian (400 million+ speakers):
- Malayo-Polynesian: Indonesian, Malay, Tagalog, Malagasy, Hawaiian, Māori, Samoan, Tongan
- Taiwan indigenous languages

Niger-Congo (500 million+ speakers):
- Bantu: Swahili, Zulu, Xhosa, Kikuyu, Shona
- Atlantic-Congo: Yoruba, Igbo, Wolof, Fula
- Mande: Bambara, Dyula

Trans-New Guinea (3-5 million speakers, greatest diversity):
- Hundreds of languages in Papua New Guinea

Dravidian (250 million+ speakers):
- Tamil, Telugu, Kannada, Malayalam, Tulu, Brahui

Turkic (200 million+ speakers):
- Turkish, Azerbaijani, Turkmen, Uzbek, Kazakh, Kyrgyz, Uyghur, Tatar

Uralic (25 million+ speakers):
- Finnic: Finnish, Estonian, Sámi
- Ugric: Hungarian, Khanty, Mansi

Koreanic: Korean (80 million)
Japonic: Japanese (125 million), Ryukyuan languages

Language isolates (no known relatives): Basque, Sumerian (extinct), Korean (debated), Burushaski

Endangered languages: UNESCO estimates 40% of the world's 7,000 languages are endangered. One language dies approximately every two weeks."""
    },
]

def write_documents(docs, filename_prefix):
    for i, doc in enumerate(docs):
        filename = OUTPUT_DIR / f"{filename_prefix}_{i:03d}.md"
        content = f"""# {doc['title']}

**Domain:** Culture & Languages
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
    print("Generating culture & languages knowledge corpus...")
    write_documents(CULTURE_DOCUMENTS, "culture")
    write_documents(LANGUAGE_DOCUMENTS, "languages")
    print(f"\nCulture & languages corpus complete. Files in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
