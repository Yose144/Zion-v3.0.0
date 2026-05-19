#!/usr/bin/env python3
"""
Hiran v2.3 Knowledge: Extended Language Guides
German, Russian, Chinese, Arabic, Japanese, Latin, Greek, Sanskrit
"""

from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "corpora"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DOCUMENTS = [
    {
        "title": "Language Guide: German, Russian, Chinese, Arabic, Japanese",
        "content": """Extended multi-language basics for global communication.

**GERMAN** (Germanic, ~130 million speakers)
- Hallo / Guten Tag (Hello / Good day)
- Danke / Danke schön (Thank you / Thank you very much)
- Bitte (Please / You're welcome)
- Ja / Nein (Yes / No)
- Wie geht es Ihnen? (How are you? — formal)
- Guten Morgen / Guten Abend (Good morning / evening)
- Auf Wiedersehen / Tschüss (Goodbye / Bye — informal)
- Ich verstehe nicht (I don't understand)
- Wo ist...? (Where is...?)
- Wie viel kostet das? (How much is this?)
- Ich liebe dich (I love you)
- Unique feature: Capitalization of ALL nouns. Three grammatical genders (der, die, das). Compound words can be very long (e.g., Donaudampfschifffahrtsgesellschaftskapitän = Danube steamship captain).

**RUSSIAN** (Slavic, ~260 million speakers)
- Привет / Здравствуйте (Privet / Zdravstvuyte — informal/formal hello)
- Спасибо / Благодарю (Spasibo / Blagodaryu — thank you)
- Пожалуйста (Pozhaluysta — please / you're welcome)
- Да / Нет (Da / Net — yes / no)
- Как дела? (Kak dela? — How are you? — informal)
- Доброе утро / Добрый вечер (Dobroye utro / Dobryy vecher — Good morning / evening)
- До свидания / Пока (Do svidaniya / Poka — goodbye / bye)
- Я не понимаю (Ya ne ponimayu — I don't understand)
- Где находится...? (Gde nakhoditsya...? — Where is...?)
- Сколько это стоит? (Skol'ko eto stoit? — How much?)
- Я тебя люблю (Ya tebya lyublyu — I love you)
- Unique feature: Cyrillic alphabet. No articles (the/a). Grammatical case system (6 cases). Stress is unpredictable and changes meaning (замок = castle vs lock).

**CHINESE (MANDARIN)** (Sino-Tibetan, ~1.1 billion speakers)
- 你好 (Nǐ hǎo — Hello)
- 谢谢 (Xièxiè — Thank you)
- 请 (Qǐng — Please)
- 是 / 不是 (Shì / Bù shì — Yes / No — literally "is / is not")
- 你好吗? (Nǐ hǎo ma? — How are you?)
- 早上好 / 晚上好 (Zǎoshang hǎo / Wǎnshang hǎo — Good morning / evening)
- 再见 / 拜拜 (Zàijiàn / Báibái — goodbye / bye)
- 我不懂 (Wǒ bù dǒng — I don't understand)
- ...在哪里? (...zài nǎlǐ? — Where is...?)
- 这个多少钱? (Zhège duōshǎo qián? — How much?)
- 我爱你 (Wǒ ài nǐ — I love you)
- Unique feature: Tonal language — 4 tones change meaning (mā = mother, mà = scold). Characters (汉字) are logographic — each represents meaning, not sound. No verb conjugation, no plurals, no articles. Simplified ( mainland) vs Traditional (Taiwan/HK) characters.

**ARABIC** (Semitic, ~420 million speakers)
- مرحبا / السلام عليكم (Marhaba / As-salamu alaykum — Hello / Peace be upon you)
- شكرا / جزاك الله خيرا (Shukran / Jazak Allah khairan — Thank you / May God reward you)
- من فضلك (Min fadlik — Please)
- نعم / لا (Na'am / La — Yes / No)
- كيف حالك؟ (Kayfa haluk? — How are you? — to male)
- صباح الخير / مساء الخير (Sabah al-khayr / Masa' al-khayr — Good morning / evening)
- مع السلامة / باي (Ma'a as-salama / Bay — goodbye / bye)
- لا أفهم (La afham — I don't understand)
- أين...؟ (Ayna...? — Where is...?)
- كم ثمن هذا؟ (Kam thaman hadha? — How much?)
- أحبك (Uhibbuka/Uhibbuki — I love you — m/f)
- Unique feature: Right-to-left script. 28 letters, all consonants (vowels shown as diacritical marks, often omitted in modern writing). Diglossia — Modern Standard Arabic (written/formal) vs dialects (spoken) vary enormously. Same root letters generate related words (k-t-b = write, book, office, library).

**JAPANESE** (Japonic, ~125 million speakers)
- こんにちは (Konnichiwa — Hello / Good afternoon)
- ありがとう / ありがとうございます (Arigatou / Arigatou gozaimasu — thank you / formal)
- お願いします (Onegai shimasu — Please)
- はい / いいえ (Hai / Iie — Yes / No)
- お元気ですか (O-genki desu ka? — How are you? — formal)
- おはよう / こんばんは (Ohayou / Konbanwa — Good morning / evening)
- さようなら / じゃあね (Sayounara / Jaa ne — goodbye / see ya)
- 分かりません (Wakarimasen — I don't understand)
- ...はどこですか (...wa doko desu ka? — Where is...?)
- いくらですか (Ikura desu ka? — How much?)
- 愛してる (Aishiteru — I love you)
- Unique feature: Three writing systems used together — Hiragana (native words), Katakana (foreign words), Kanji (Chinese characters). SOV word order. Keigo (honorific speech) with multiple politeness levels. Particles (は, が, を, に, で) mark grammatical function."""
    },
    {
        "title": "Language Guide: Latin, Greek, Sanskrit, Hebrew, Swahili",
        "content": """Classical and influential languages of world civilization.

**LATIN** (Italic, extinct as spoken language, ~0 native speakers, used by Catholic Church, scientists, lawyers)
- Salve / Ave (Hello / Hail)
- Gratias tibi ago (Thank you — literally "thanks to you I give")
- Quaeso (Please)
- Ita / Minime (Yes / No — literally "thus" / "least")
- Quid agis? (How are you? — "What do you do?")
- Bonum mane / Bonum vesperum (Good morning / evening)
- Vale / Salve (Goodbye / Be well)
- Non intellego (I don't understand)
- Ubi est...? (Where is...?)
- Quantum constat? (How much does it cost?)
- Te amo (I love you)
- Unique feature: No articles. Cases decline (6 cases). Verbs conjugate. Extensive literary legacy: Virgil, Cicero, Ovid, Horace, Caesar. Origin of Romance languages. Still used in taxonomy (Homo sapiens), medicine, law (habeas corpus, caveat emptor), and mottoes (e pluribus unum).

**ANCIENT GREEK** (Hellenic, ~13 million modern Greek speakers, Ancient Greek studied by scholars)
- Χαῖρε / Χαίρετε (Chaire / Chairete — Hello — singular / plural)
- Εὐχαριστῶ (Eucharisto — Thank you — literally "I give good grace")
- Παρακαλῶ (Parakalo — Please / You're welcome — literally "I ask")
- Ναί / Οὔ (Nai / Ou — Yes / No)
- Τί πράττεις; (Ti pratteis? — How are you? — "What do you do?")
- Καλημέρα / Καλησπέρα (Kalimera / Kalispera — Good morning / evening)
- Χαίρε / Εἰς τὸ ἐπανιδεῖν (Chaire / Eis to epanidein — goodbye / until we meet again)
- Οὐ γιγνώσκω (Ou gignosko — I don't understand)
- Ποῦ ἐστιν...; (Pou estin...? — Where is...?)
- Πόσον ἄξιόν ἐστι; (Poson axion esti? — How much is it worth?)
- Σὲ φιλῶ (Se philo — I love you)
- Unique feature: Alphabet origin of modern alphabets. Pitch accent. Extensive inflection (nouns decline in 5 cases, verbs in multiple moods/tenses). Foundation of Western philosophy, science, mathematics, drama, and historiography. The New Testament was written in Koine Greek.

**SANSKRIT** (Indo-Aryan, ~25,000 fluent speakers today, sacred language of Hinduism, Buddhism, Jainism)
- नमस्ते (Namaste — I bow to you — hello/goodbye)
- धन्यवादः (Dhanyavaadah — Thank you)
- कृपया (Kripayaa — Please)
- आम् / न (Aam / Na — Yes / No)
- भवान् कथमसि? (Bhavaan kathamsi? — How are you? — to male)
- शुभप्रभातम् / शुभसायम् (Shubhaprabaatam / Shubhasaayam — Good morning / evening)
- पुनर्मिलामः (Punarmilaamah — We'll meet again)
- न जानामि (Na jaanaami — I don't know)
- ...कुत्र अस्ति? (...kutra asti? — Where is...?)
- ...कियत् मूल्यम्? (...kiyat moolyam? — How much?)
- त्वाम् प्रिये करोमि (Tvaam priye karomi — I hold you dear)
- Unique feature: Perfectly regular grammar described by Panini in Ashtadhyayi (c. 500 BCE) — the most comprehensive grammar ever written. Devanagari script. Sandhi rules cause phonetic changes at word boundaries. Sacred texts: Vedas, Upanishads, Mahabharata, Ramayana. Source of many words in English and other languages (nirvana, karma, yoga, mantra, avatar, guru, jungle, thug).

**HEBREW** (Semitic, ~9 million speakers, revived from ancient language by Eliezer Ben-Yehuda in late 19th century — the only successful large-scale language revival in history)
- שלום (Shalom — Hello / Goodbye / Peace)
- תודה רבה (Toda raba — Thank you very much)
- בבקשה (Bevakasha — Please / You're welcome)
- כן / לא (Ken / Lo — Yes / No)
- מה נשמע? (Ma nishma? — What's up? — literally "What is heard?")
- בוקר טוב / ערב טוב (Boker tov / Erev tov — Good morning / evening)
- להתראות (Lehitraot — See you / Goodbye)
- אני לא מבין (Ani lo mevin — I don't understand)
- איפה...? (Eifo...? — Where is...?)
- כמה זה עולה? (Kama ze oleh? — How much does it cost?)
- אני אוהב אותך (Ani ohev otach — I love you — to female)
- Unique feature: Right-to-left. Consonantal alphabet with vowel pointing (niqqud). Modern Israeli Hebrew is a Semitic language with European (Yiddish, Russian) overlays. Biblical Hebrew differs significantly from Modern Hebrew.

**SWAHILI** (Niger-Congo/Bantu, ~200 million speakers across East Africa)
- Jambo / Habari (Hello / News — "How are things?")
- Asante sana (Thank you very much)
- Tafadhali (Please)
- Ndiyo / Hapana (Yes / No)
- Habari yako? (How are you? — literally "Your news?")
- Habari za asubuhi / jioni (Good morning / evening)
- Kwa heri / Kwa herini (Goodbye — singular / plural)
- Sielewi (I don't understand)
- ...iko wapi? (...iko wapi? — Where is...?)
- Bei gani? (What is the price?)
- Nakupenda (I love you)
- Unique feature: Bantu noun class system (18 classes marked by prefixes). Extensive Arabic vocabulary from centuries of Indian Ocean trade. Serves as lingua franca across Kenya, Tanzania, Uganda, Rwanda, Burundi, DRC. Written in Latin script. Hakuna matata = 'no worries.'"""
    },
    {
        "title": "Language Families and Writing Systems of the World",
        "content": """An overview of the world's major writing systems and their characteristics.

**ALPHABETIC SYSTEMS** (Symbols represent individual sounds):
- Latin alphabet: Used by ~70% of the world's population across English, Spanish, French, German, Portuguese, Vietnamese, Turkish, Indonesian, and hundreds more. 26 letters, adapted from Etruscan/Greek via Roman expansion.
- Cyrillic: Created by Saints Cyril and Methodius (9th century) for Slavic peoples. 33 letters in Russian. Used across Russia, Ukraine, Bulgaria, Serbia, Mongolia, and Central Asia.
- Greek alphabet: 24 letters. Ancestor of Latin and Cyrillic. Used for Greek (13 million speakers) and in science/mathematics (alpha, beta, gamma, delta, pi, sigma, omega).
- Arabic abjad: 28 letters, all consonants. Right-to-left. Used for Arabic, Persian, Urdu, Pashto, Uyghur, and Jawi Malay.
- Hebrew abjad: 22 letters. Right-to-left. Used for Hebrew, Yiddish, and Ladino.
- Korean Hangul: Alphabetic blocks representing syllables. Invented by King Sejong (1443). 14 consonants and 10 vowels. Considered one of the most logical writing systems.
- Georgian: 33 letters. Unique to Georgia. No capital letters.
- Armenian: 39 letters. Created by Mesrop Mashtots (405 CE) for Armenian.

**LOGOGRAPHIC / SYLLABIC SYSTEMS** (Symbols represent words, morphemes, or syllables):
- Chinese characters (汉字): ~50,000 total, ~3,500 commonly used. Each character represents a morpheme (meaning unit). Logographic — not phonetic. Used for Chinese, Japanese (kanji), Korean (hanja, now rare), and formerly Vietnamese (chu nom).
- Japanese: Three systems used together — Kanji (Chinese characters for nouns and verb stems), Hiragana (46 phonetic symbols for native Japanese words and grammatical endings), Katakana (46 phonetic symbols for foreign words and emphasis).
- Mayan glyphs: Logosyllabic. ~800 signs. Deciphered in the 20th century.
- Egyptian hieroglyphs: Logosyllabic. ~700 signs. Used from 3200 BCE to 4th century CE.
- Cuneiform: Wedge-shaped marks in clay. Invented by Sumerians (c. 3400 BCE). Used for Sumerian, Akkadian, Elamite, Hittite, and others.

**ABUGIDA SYSTEMS** (Consonant-vowel sequences written as a unit):
- Devanagari: Used for Hindi, Sanskrit, Marathi, Nepali. Each consonant has an inherent vowel 'a'; other vowels shown by diacritics.
- Bengali-Assamese: Used for Bengali (240M speakers) and Assamese.
- Tamil: One of India's oldest scripts. Very curved because palm leaves were the writing surface — straight lines would split the leaf.
- Thai: 44 consonants, 15 vowel symbols. Tone markers.
- Ethiopian Ge'ez / Amharic: Used for Amharic (32M speakers in Ethiopia) and Tigrinya.

**FEATURES OF NOTABLE LANGUAGES:**

Most speakers (native + second language):
1. English (~1.5 billion)
2. Mandarin Chinese (~1.1 billion)
3. Hindi (~600 million)
4. Spanish (~550 million)
5. French (~300 million)
6. Arabic (~420 million)
7. Bengali (~270 million)
8. Portuguese (~260 million)
9. Russian (~260 million)
10. Urdu (~230 million)

Most complex grammars:
- Navajo: Verbs incorporate mode, aspect, subject, object, and shape of object (e.g., "carry" differs for long, flat, round, or animate objects).
- Hungarian: 35 grammatical cases.
- Basque: Aglutinative, ergative case marking, no known relatives.
- Japanese: Keigo honorific system with 3 politeness levels and multiple forms per verb.
- Tuyuca (Amazon): Evidentiality — verbs must indicate how you know something (saw it, heard it, inferred it, or were told it).

Conlang (constructed languages):
- Esperanto (1887): Created by L.L. Zamenhof as a universal second language. ~2 million speakers. Regular grammar, no exceptions.
- Klingon (1984): Created by Marc Okrand for Star Trek. ~30 fluent speakers, official dictionary.
- Toki Pona (2001): Minimalist philosophical language with only 120 root words."""
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
    print("Generating extended languages knowledge corpus...")
    write_documents(DOCUMENTS, "languages_extended")
    print(f"\nExtended languages corpus complete. Files in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
