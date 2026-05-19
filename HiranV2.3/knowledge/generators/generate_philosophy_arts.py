#!/usr/bin/env python3
"""
Hiran v2.3 Knowledge: Philosophy, Arts, Medicine, Literature, Mythology
"""

from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "corpora"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DOCUMENTS = [
    {
        "title": "Philosophy: From Ancient Greece to Existentialism",
        "content": """Philosophy (from Greek philo-sophia, "love of wisdom") is the systematic study of fundamental questions about existence, knowledge, values, reason, mind, and language.

Ancient Greek Philosophy (6th-4th century BCE):
- Socrates (470-399 BCE): "The unexamined life is not worth living." Developed the Socratic method — asking probing questions to expose contradictions in beliefs. Executed for "corrupting the youth of Athens."
- Plato (428-348 BCE): Student of Socrates. Theory of Forms — physical reality is a shadow of eternal, perfect Forms. The Allegory of the Cave describes prisoners who mistake shadows for reality. Founded the Academy in Athens.
- Aristotle (384-322 BCE): Student of Plato. Logic, ethics, politics, biology, metaphysics. The "Golden Mean" — virtue lies between extremes (courage between recklessness and cowardice). The Lyceum. Tutored Alexander the Great.

Medieval Philosophy:
- St. Augustine (354-430 CE): Combined Christian theology with Platonism. "Our hearts are restless until they rest in You." Free will, original sin, just war theory.
- St. Thomas Aquinas (1225-1274): Synthesized Aristotle with Christianity. Five proofs for God's existence (cosmological argument). Natural law — moral principles discernible by reason.

Modern Philosophy (17th-19th century):
- Descartes (1596-1650): "Cogito, ergo sum" (I think, therefore I am). Methodological doubt — question everything to find certain foundations. Dualism — mind and body are distinct substances.
- Spinoza (1632-1677): God and nature are one (pantheism). Rejected free will. "The highest activity a human being can attain is learning for understanding."
- Leibniz (1646-1716): Optimism — this is the "best of all possible worlds." Monads — indivisible units of reality. Co-invented calculus independently of Newton.
- Hume (1711-1776): Empiricism — all knowledge comes from experience. Skepticism about causation — we observe conjunction, not necessity. Is-ought problem — you cannot derive moral conclusions from factual premises alone.
- Kant (1724-1804): Synthetic a priori knowledge. The mind actively structures experience (categories of understanding). Categorical imperative — act only according to maxims you can will as universal law. "Sapere aude" (Dare to know).
- Hegel (1770-1831): Dialectic — thesis, antithesis, synthesis. History progresses toward freedom. The owl of Minerva flies at dusk (philosophy understands reality only after the fact).
- Nietzsche (1844-1900): "God is dead" — modernity has undermined traditional values. Übermensch (overman) creates new values. Will to power. Master morality vs slave morality. Eternal recurrence.

20th Century:
- Wittgenstein (1889-1951): Early work — language as logical picture of reality. Later work — meaning is use. Philosophical problems are confusions about language.
- Heidegger (1889-1976): Being and Time. Dasein — human existence as being-in-the-world. Authenticity vs the "they-self." Technology as "enframing" that reveals nature as standing reserve.
- Sartre (1905-1980): Existentialism. "Existence precedes essence" — humans are not designed with a fixed nature; we create ourselves through choices. "We are condemned to be free." Bad faith — denying our freedom.
- Simone de Beauvoir (1908-1986): The Second Sex. "One is not born, but rather becomes, a woman." Feminist existentialism.
- Camus (1913-1960): The absurd — the confrontation between human need for meaning and the silent universe. Sisyphus must be imagined happy. Rebel against the absurd through creation and solidarity.

Eastern Philosophy:
- Confucius (551-479 BCE): Ren (benevolence), li (ritual propriety), junzi (exemplary person). Social harmony through moral cultivation.
- Laozi / Taoism: The Tao that can be spoken is not the eternal Tao. Wu wei (effortless action). Simplicity and naturalness.
- Buddhism: Four Noble Truths, Eightfold Path, sunyata (emptiness), anatta (no-self). Nagarjuna's Madhyamaka — all phenomena are empty of inherent existence.
- Advaita Vedanta (Shankara, 8th century): Brahman (ultimate reality) is identical to Atman (individual soul). The world is maya (illusion) in the sense of not being ultimately real."""
    },
    {
        "title": "Art History: From Cave Paintings to Contemporary Art",
        "content": """Art has been a fundamental human expression for at least 40,000 years.

Prehistoric Art:
- Cave paintings at Lascaux (France, c. 17,000 BCE) and Altamira (Spain) depict bison, horses, and deer with remarkable naturalism. The Chauvet Cave (France, c. 30,000 BCE) shows lions and rhinos.
- Venus figurines (c. 28,000-25,000 BCE): Small female statues emphasizing fertility. The Venus of Willendorf is 4.4 inches tall, carved from limestone.

Ancient Art:
- Egyptian: Highly stylized, hierarchical proportions (pharaohs largest, servants smallest). Frontalism — heads in profile, torsos frontal. The Great Sphinx (c. 2500 BCE). Tutankhamun's gold mask.
- Greek: The revolution of naturalism. Kouros statues evolve from rigid Archaic figures to fluid Classical forms. Myron's Discobolus (the discus thrower). Polykleitos' Canon established mathematical proportions for the ideal body. Hellenistic period: emotional intensity (Laocoön and His Sons).
- Roman: Practical and portrait-focused. Realistic busts (Veristic style showing every wrinkle). Pompeii frescoes preserved by Vesuvius' eruption (79 CE). The Colosseum and Pantheon as engineering marvels.

Medieval Art:
- Byzantine: Gold backgrounds, elongated figures, spiritual rather than naturalistic. Hagia Sophia's dome (532-537 CE). Icons as windows to the divine.
- Romanesque (10th-12th century): Massive walls, rounded arches, biblical scenes in sculpture. The tympanum (semicircular space above church doors) showing the Last Judgment.
- Gothic (12th-16th century): Pointed arches, flying buttresses, stained glass rose windows. Chartres Cathedral (1194-1220). Giotto (1267-1337) added emotional depth and spatial hints, bridging Gothic and Renaissance.

Renaissance (14th-17th century): Rebirth of classical ideals + innovation.
- Italy: Masaccio invented linear perspective. Brunelleschi engineered the Duomo dome. Leonardo ( Mona Lisa, The Last Supper) — sfumato (smoky blending), scientific observation. Michelangelo (David, Sistine Chapel ceiling) — muscular, heroic forms. Raphael (School of Athens) — perfect balance and harmony.
- Northern Europe: Van Eyck invented oil painting technique. Bosch's surreal Garden of Earthly Delights. Dürer's mathematical precision in printmaking.

Baroque (17th century): Drama, movement, emotional intensity.
- Caravaggio (1571-1610): Chiaroscuro (extreme light/dark contrast), naturalistic saints as ordinary people. "The Calling of St Matthew."
- Bernini (1598-1680): Sculptor who made marble look like living flesh. "The Ecstasy of St Teresa."
- Rembrandt (1606-1669): Master of light. "The Night Watch." Hundreds of self-portraits tracing aging.
- Velázquez (1599-1660): Court painter of Spain. "Las Meninas" — a painting about looking, with the viewer reflected.

19th Century:
- Neoclassicism: Jacques-Louis David, Ingres. Clean lines, moral subjects, classical references.
- Romanticism: Delacroix, Géricault. Emotion over reason. Nature as sublime and terrifying (Caspar David Friedrich's lone figures in vast landscapes).
- Realism: Courbet, Millet. Painting ordinary people and everyday life without idealization.
- Impressionism (1860s-1880s): Monet, Renoir, Degas. Capturing fleeting light and color. En plein air (outdoor) painting. Short brushstrokes, bright unmixed colors.
- Post-Impressionism: Van Gogh (swirling, emotional brushwork), Gauguin (bold flat colors, Tahitian themes), Cézanne (geometric structure, "treat nature by the cylinder, sphere, cone").

20th Century:
- Cubism (1907-1920s): Picasso and Braque shattered forms into geometric planes. Multiple viewpoints simultaneously. "Les Demoiselles d'Avignon" (1907) shocked Paris.
- Futurism: Celebrated speed, technology, violence. Boccioni's dynamic sculptures.
- Surrealism (1920s-1950s): Dalí's dreamlike precision. Magritte's visual paradoxes ("This is not a pipe"). Automatic drawing to access the unconscious.
- Abstract Expressionism (1940s-1950s): Pollock's drip paintings. Rothko's color field meditations. New York replaces Paris as art capital.
- Pop Art (1950s-1960s): Warhol's Campbell's soup cans and Marilyn Monroe multiples. Lichtenstein's comic-strip paintings. Blurring high art and mass culture.
- Minimalism (1960s-1970s): Judd's geometric boxes. Stripped to essential forms. "What you see is what you see."
- Contemporary: Installation, performance, video art. Ai Weiwei's political installations. Banksy's street art and anonymity. NFTs and digital ownership questions."""
    },
    {
        "title": "Medicine: From Ancient Healing to Modern Science",
        "content": """Medicine is the science and practice of diagnosing, treating, and preventing disease.

Ancient Medicine:
- Egyptian (c. 3000 BCE): The Edwin Smith Papyrus (c. 1600 BCE) describes surgical procedures, fractures, and wounds. Imhotep (c. 2600 BCE) was a physician, architect, and later deified as a god of medicine.
- Mesopotamian: Diagnostic handbooks listing symptoms and prognoses. Exorcism and herbal remedies combined.
- Ayurveda (India, c. 1000 BCE): Three doshas (vata, pitta, kapha) must be balanced for health. Sushruta Samhita describes surgery including rhinoplasty and cataract removal.
- Traditional Chinese Medicine: Qi (vital energy) flows through meridians. Acupuncture, herbal medicine, tai chi. The Yellow Emperor's Inner Canon (c. 200 BCE).
- Greek: Hippocrates (c. 460-370 BCE) — the "Father of Medicine." Rejected supernatural causes. The Hippocratic Oath. Described many diseases accurately. Humoral theory (four bodily fluids: blood, phlegm, black bile, yellow bile).

Medieval and Early Modern:
- Islamic Golden Age: Ibn Sina (Avicenna, 980-1037) wrote The Canon of Medicine, used in Europe for 600 years. Ibn al-Nafis (1213-1288) described pulmonary circulation 300 years before Harvey.
- Medieval Europe: Monastery infirmaries. Barber-surgeons performed bloodletting. The Black Death (1347-1351) killed 30-60% of Europe; doctors wore beaked masks filled with herbs.
- Paracelsus (1493-1541): Rejected humoral theory. "The dose makes the poison." Introduced laudanum (opium tincture) and mercury for syphilis.
- Andreas Vesalius (1514-1564): De humani corporis fabrica — first accurate anatomy based on dissection. Corrected 200+ of Galen's errors.

The Scientific Revolution in Medicine:
- William Harvey (1578-1657): Described blood circulation (De Motu Cordis, 1628). The heart is a pump; blood circulates in a closed loop.
- Antonie van Leeuwenhoek (1632-1723): Invented the microscope. First to observe bacteria, sperm cells, and blood cells.
- Edward Jenner (1749-1823): Developed vaccination. Observed that milkmaids who caught cowpox didn't get smallpox. Inoculated a boy with cowpox, then exposed him to smallpox — he was immune.

19th Century Breakthroughs:
- Germ Theory: Louis Pasteur (1822-1895) proved microorganisms cause disease. Developed pasteurization and rabies vaccine. Robert Koch (1843-1910) identified specific bacteria for tuberculosis, cholera, and anthrax. Koch's postulates still define infectious disease causation.
- Florence Nightingale (1820-1910): Founded modern nursing. Used statistics to show sanitation reduces mortality. The polar area diagram.
- Joseph Lister (1827-1912): Antiseptic surgery using carbolic acid. Surgery mortality dropped dramatically.
- Anesthesia: Ether (1846) and chloroform (1847) made painless surgery possible. Before this, surgery was horrifically painful and speedy.

20th Century:
- Alexander Fleming (1881-1955): Discovered penicillin (1928) from mold contamination. The antibiotic revolution began.
- DNA Structure (1953): Watson and Crick (with Franklin's X-ray data) described the double helix. Launched molecular biology.
- Organ Transplantation: First kidney transplant (1954), heart transplant (1967, Christiaan Barnard), liver, lung, pancreas transplants followed.
- Imaging: X-rays (1895, Röntgen), CT scans (1970s), MRI (1980s), PET scans. Non-invasive internal visualization.
- The Human Genome Project (1990-2003): Mapped all 3 billion base pairs of human DNA. Cost ~$3 billion. Today, whole genome sequencing costs ~$200.

21st Century:
- CRISPR-Cas9 (2012): Gene editing with bacterial immune systems. Enables precise DNA modification. Potential for curing genetic diseases (sickle cell, muscular dystrophy) but raises ethical concerns (designer babies).
- mRNA Vaccines: COVID-19 vaccines (2020) use messenger RNA to instruct cells to produce spike protein, training the immune system. Decades of research by Katalin Karikó and others.
- Immunotherapy: Training the immune system to attack cancer. Checkpoint inhibitors (PD-1/PD-L1) have transformed treatment for melanoma, lung cancer, and others.
- Personalized Medicine: Treatments based on individual genetics, microbiome, and molecular profile. Pharmacogenomics — matching drugs to genetic variants.

Global Health Challenges:
- Antimicrobial resistance: Bacteria evolving to resist antibiotics. By 2050, AMR could cause 10 million deaths annually.
- Non-communicable diseases: Heart disease, cancer, diabetes now dominate globally.
- Mental health: Depression is the leading cause of disability worldwide.
- Access: Billions lack basic healthcare. The WHO estimates half the world lacks essential health services."""
    },
    {
        "title": "World Literature: Epic Poems, Novels, and Sacred Texts",
        "content": """Literature preserves human experience across millennia.

Ancient Epics:
- The Epic of Gilgamesh (c. 2100 BCE, Mesopotamia): The world's oldest known literary work. King Gilgamesh seeks immortality after his friend Enkidu dies. Confronts mortality and finds meaning in human achievements rather than eternal life.
- The Iliad and Odyssey (c. 8th century BCE, Homer, Greece): The Iliad tells of Achilles' rage during the Trojan War. The Odyssey follows Odysseus' 10-year journey home. Defined the Western heroic tradition.
- The Mahabharata (c. 400 BCE-400 CE, India): The longest epic poem (~1.8 million words). The great war between Pandavas and Kauravas. Contains the Bhagavad Gita — Krishna's dialogue with Arjuna on duty and devotion.
- The Ramayana (c. 5th-4th century BCE, India): Prince Rama rescues his wife Sita from the demon king Ravana. Models of ideal kingship, marriage, and brotherhood.
- The Aeneid (19 BCE, Virgil, Rome): Aeneas flees fallen Troy to found Rome. "Arma virumque cano" (I sing of arms and the man). Propaganda for Augustus' empire.

Classical Literature:
- Greek Tragedy: Aeschylus (Oresteia), Sophocles (Oedipus Rex, Antigone), Euripides (Medea, The Bacchae). Catharsis — emotional purification through witnessing suffering.
- Greek Comedy: Aristophanes (Lysistrata — women withhold sex to stop war, The Clouds — mocks Socrates).
- Roman: Ovid's Metamorphoses (mythological transformations). Seneca's tragedies. Catullus' lyric poetry.

Medieval:
- Dante Alighieri (1265-1321): The Divine Comedy. Journey through Inferno, Purgatorio, and Paradiso. Written in Tuscan Italian, establishing the literary language.
- Geoffrey Chaucer (c. 1343-1400): The Canterbury Tales. Pilgrims tell stories on the road to Canterbury. Social satire across all classes.
- One Thousand and One Nights: Frame story of Scheherazade, who tells tales to survive. Aladdin, Ali Baba, Sinbad the Sailor.

Renaissance:
- Shakespeare (1564-1616): 39 plays, 154 sonnets. Hamlet, Macbeth, King Lear, Othello — the tragedies. Romeo and Juliet. The comedies: A Midsummer Night's Dream, Twelfth Night. The histories: Henry V. Invented or popularized 1,700+ English words.
- Cervantes (1547-1616): Don Quixote. The first modern novel. Quixote's delusion that he is a knight-errant, Sancho Panza as pragmatic foil. Self-conscious fiction — the characters discuss being in a book.

19th Century:
- The novel becomes the dominant form.
- Jane Austen (1775-1817): Pride and Prejudice. Marriage, manners, and social mobility. Free indirect discourse.
- Victor Hugo (1802-1885): Les Misérables. Social injustice, redemption, revolution. The Hunchback of Notre-Dame.
- Charles Dickens (1812-1870): Oliver Twist, A Tale of Two Cities, Great Expectations. Social reform through storytelling.
- Leo Tolstoy (1828-1910): War and Peace (historical epic of Napoleonic invasion). Anna Karenina (tragic love, society's judgment).
- Fyodor Dostoevsky (1821-1881): Crime and Punishment (Raskolnikov's murder and moral redemption). The Brothers Karamazov (faith, doubt, patricide).
- Gustave Flaubert (1821-1880): Madame Bovary. Realism — precise, unflinching observation.

20th Century:
- James Joyce (1882-1941): Ulysses (single day in Dublin, stream of consciousness, Homeric parallels). Finnegans Wake (experimental language, multilingual puns, circular structure).
- Franz Kafka (1883-1924): The Metamorphosis (Gregor Samsa wakes as a giant insect). The Trial (Joseph K. arrested for unknown crime). The Castle (bureaucratic absurdity). "Kafkaesque" — oppressive, surreal bureaucracy.
- Gabriel García Márquez (1927-2014): One Hundred Years of Solitude. Magical realism — the miraculous treated as ordinary. The Buendía family saga mirrors Latin American history.
- Toni Morrison (1931-2019): Beloved. A mother kills her child to prevent enslavement; the ghost returns. African American experience, memory, trauma.
- Haruki Murakami (b. 1949): Norwegian Wood, 1Q84. Dreamlike narratives blending reality and fantasy, cats, jazz, loneliness.

Sacred Texts as Literature:
- The Bible contains poetry (Psalms, Song of Solomon), prophecy (Isaiah), wisdom literature (Proverbs, Ecclesiastes), apocalyptic visions (Revelation).
- The Quran's Arabic is considered inimitable (i'jaz) — the ultimate literary miracle.
- The Bhagavad Gita: Philosophical dialogue in poetic Sanskrit.
- The Tao Te Ching: 81 brief, paradoxical verses."""
    },
    {
        "title": "World Mythology: Gods, Heroes, and Creation Stories",
        "content": """Myths are stories that explain origins, natural phenomena, and cultural values.

Egyptian Mythology:
- Creation: Atum (or Ra) emerges from the primordial waters (Nun) on the first mound of land. Creates Shu (air) and Tefnut (moisture), who produce Geb (earth) and Nut (sky). Osiris, Isis, Seth, and Nephthys are their children.
- Osiris myth: Osiris rules Egypt justly. His brother Seth murders him, dismembers him, and scatters the pieces. Isis reassembles and resurrects Osiris (first mummy). Horus, son of Osiris and Isis, battles Seth for the throne. Horus = living pharaoh, Osiris = dead pharaoh in the afterlife.
- Ra's nightly journey: The sun god sails through the underworld (Duat) in his solar bark, battling the chaos serpent Apophis. Each hour described in the Book of Amduat.
- Ma'at: Goddess of truth, justice, and cosmic order. Her feather is weighed against the deceased's heart in the afterlife judgment.

Greek Mythology:
- Creation (Hesiod's Theogony): Chaos → Gaia (earth), Tartarus (underworld), Eros. Gaia produces Uranus (sky). Their children — the Titans — are imprisoned by Uranus. Cronus overthrows Uranus. Zeus overthrows Cronus and the Titans, establishing the Olympian gods.
- The Twelve Olympians: Zeus (sky, king), Hera (marriage), Poseidon (sea), Demeter (agriculture), Athena (wisdom, war), Apollo (sun, music, prophecy), Artemis (hunt, moon), Ares (war), Aphrodite (love), Hephaestus (fire, craft), Hermes (messenger), Dionysus (wine, ecstasy) or Hestia (hearth).
- Prometheus: Titan who created humans from clay and stole fire for them. Punished by Zeus — chained to a rock where an eagle eats his liver daily, which regenerates each night.
- The Trojan War: Eris' golden apple, Paris' judgment, Helen's abduction, the wooden horse, Achilles' heel, the Odyssey.
- The Underworld: Hades rules. Charon ferries souls across the Styx for an obol (coin placed in the mouth of the dead). Three judges decide the soul's fate. Tartarus for the wicked, Elysium for the heroic, Asphodel Fields for the ordinary.

Norse Mythology:
- Yggdrasil, the World Tree: Connects nine worlds. Roots reach Asgard (gods), Jotunheim (giants), and Niflheim (underworld).
- The Aesir gods: Odin (wisdom, war, poetry — hung himself on Yggdrasil for nine days to learn the runes), Thor (thunder, Mjolnir hammer), Loki (trickster, shape-shifter), Frigg (prophecy), Tyr (war, sacrificed his hand to bind Fenrir).
- Ragnarök: The prophesied end of the world. Fenrir the wolf swallows Odin. Jörmungandr the world serpent kills Thor. The world sinks into the sea, then rises renewed. Two humans survive inside Yggdrasil to repopulate.
- Valkyries: Choosers of the slain. Carry half the dead to Valhalla (Odin's hall, preparation for Ragnarök). The other half go to Freyja's field Fólkvangr.

Hindu Mythology:
- The Trimurti: Brahma (creator), Vishnu (preserver), Shiva (destroyer/transformer).
- Avatars of Vishnu: Krishna, Rama, Buddha (in some traditions), Kalki (future avatar who will appear at the end of Kali Yuga).
- The churning of the ocean (Samudra Manthan): Gods and demons churn the cosmic ocean to obtain amrita (nectar of immortality). Many treasures emerge, including Lakshmi, the elephant Airavata, and poison which Shiva drinks.
- The Mahabharata war: Arjuna's charioteer Krishna reveals the Bhagavad Gita. Dharma — doing one's duty regardless of outcome.

Japanese Mythology:
- Izanagi and Izanami: The primordial couple who create the Japanese islands by stirring the ocean with a jeweled spear. Izanami dies giving birth to fire god Kagutsuchi. Izanagi pursues her to Yomi (underworld) but cannot look back — when he does, she becomes a rotting corpse and he must flee.
- Amaterasu: Sun goddess, ancestor of the imperial line. Hides in a cave, plunging the world into darkness. The other gods lure her out with a mirror and dancing (origin of Kagura).
- Susanoo: Storm god, Amaterasu's brother. Kills the eight-headed serpent Yamata-no-Orochi and finds the Kusanagi sword in its tail — one of the three Imperial Regalia.

African Mythology:
- Anansi the Spider (Akan people, Ghana): Trickster who often outsmarts more powerful beings. Stories spread to the Caribbean via the slave trade (Brer Rabbit is a descendant).
- The Dogon (Mali): Complex cosmology involving the star Sirius and its companion Sirius B, which they allegedly knew about before telescopes.
- Yoruba (Nigeria): Olodumare (supreme being) created the world through Obatala (purity) and Oduduwa (kingship). Orishas (spiritual forces) include Shango (thunder, justice), Oshun (love, rivers), Yemoja (motherhood, ocean)."""
    },
]

def write_documents(docs, filename_prefix):
    for i, doc in enumerate(docs):
        filename = OUTPUT_DIR / f"{filename_prefix}_{i:03d}.md"
        content = f"""# {doc['title']}

**Domain:** Humanities
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
    print("Generating philosophy, arts, medicine, literature, mythology corpus...")
    write_documents(DOCUMENTS, "humanities")
    print(f"\nHumanities corpus complete. Files in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
