#!/usr/bin/env python3
"""
Hiran v2.3 Knowledge: World History
Generates structured documents on civilizations, empires, wars, and cultural history.
"""

import random
from pathlib import Path
from datetime import datetime

random.seed(51)

OUTPUT_DIR = Path(__file__).parent.parent / "corpora"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HISTORY_DOCUMENTS = [
    {
        "title": "Ancient Civilizations: Egypt, Mesopotamia, and the Indus Valley",
        "content": """The Bronze Age (c. 3300-1200 BCE) saw the rise of humanity's first great civilizations.

Ancient Egypt (c. 3100-30 BCE): United under Narmer (Menes) around 3100 BCE. The Old Kingdom (2686-2181 BCE) built the Great Pyramids of Giza. The Middle Kingdom (2055-1650 BCE) expanded trade and literature. The New Kingdom (1550-1077 BCE) produced pharaohs like Hatshepsut, Akhenaten, Tutankhamun, and Ramesses II. Cleopatra VII, the last pharaoh, died in 30 BCE when Egypt became a Roman province.

Key achievements: Hieroglyphic writing, papyrus, the 365-day calendar, monumental architecture, mummification, advanced medicine.

Mesopotamia (c. 3500-539 BCE): "Land between the rivers" (Tigris and Euphrates). Sumerians invented cuneiform writing (c. 3400 BCE), the wheel, and city-states like Uruk and Ur. Babylon under Hammurabi (c. 1754 BCE) produced one of the earliest law codes. The Neo-Babylonian Empire built the Hanging Gardens. Conquered by Persia in 539 BCE.

Indus Valley Civilization (c. 3300-1300 BCE): Located in modern Pakistan and northwest India. Cities of Harappa and Mohenjo-daro featured advanced urban planning with grid streets, drainage systems, and standardized weights. The Indus script remains undeciphered.

Ancient China (c. 2070 BCE onwards): The Xia Dynasty (traditionally c. 2070-1600 BCE) may be legendary. The Shang Dynasty (c. 1600-1046 BCE) left the earliest Chinese writing on oracle bones. The Zhou Dynasty (1046-256 BCE) introduced the Mandate of Heaven concept. Confucius (551-479 BCE) and Laozi (6th century BCE) shaped Chinese philosophy.

Ancient Greece (c. 1100-146 BCE): The Minoans of Crete (c. 2700-1100 BCE) built palace complexes at Knossos. Mycenaeans (c. 1600-1100 BCE) fought the Trojan War (traditionally 1184 BCE). The Archaic Period (800-480 BCE) developed the polis (city-state) and colonization. The Classical Period (480-323 BCE) produced democracy in Athens, the Persian Wars (490-479 BCE), the Peloponnesian War (431-404 BCE), and figures like Socrates, Plato, and Aristotle. Alexander the Great (356-323 BCE) conquered from Greece to India."""
    },
    {
        "title": "The Roman Empire: Rise, Height, and Fall",
        "content": """The Roman Republic (509-27 BCE): Founded after overthrowing the last king, Tarquin the Proud. Governed by two consuls, a Senate, and popular assemblies. Expanded through Italy, defeating Carthage in the Punic Wars (264-146 BCE). Julius Caesar conquered Gaul (58-50 BCE) and crossed the Rubicon in 49 BCE, triggering civil war.

The Roman Empire (27 BCE-476 CE): Augustus became the first emperor, establishing the Pax Romana (27 BCE-180 CE), a period of relative peace and stability. The empire stretched from Britain to Mesopotamia, from the Rhine to North Africa.

Key emperors:
- Augustus (27 BCE-14 CE): Established the imperial system
- Nero (54-68 CE): Persecuted Christians; blamed for the Great Fire of Rome
- Trajan (98-117 CE): Empire reached maximum territorial extent
- Hadrian (117-138 CE): Built Hadrian's Wall in Britain
- Marcus Aurelius (161-180 CE): Philosopher-emperor; author of Meditations
- Diocletian (284-305 CE): Divided the empire into East and West
- Constantine (306-337 CE): Legalized Christianity; founded Constantinople
- Justinian (527-565 CE): Eastern Roman emperor; codified Roman law

Achievements: Roman law (basis for modern legal systems), concrete engineering (aqueducts, roads, Colosseum, Pantheon), Latin language (ancestor of Romance languages), extensive trade networks, organized military with legions.

The Fall of the Western Empire (476 CE): Multiple factors contributed — economic decline, military overstretch, barbarian invasions (Visigoths, Vandals, Huns), political instability, and the split between East and West. The last Western emperor, Romulus Augustulus, was deposed by the Germanic chieftain Odoacer. The Eastern Empire (Byzantium) survived until 1453.

Legacy: Roman law, architecture, language, Christianity (adopted as state religion under Constantine), and the concept of empire influenced Western civilization for millennia."""
    },
    {
        "title": "The Middle Ages: Europe, Asia, and the Islamic World",
        "content": """Early Middle Ages (500-1000 CE): After Rome's fall, Europe fragmented into Germanic kingdoms. The Frankish king Charlemagne (742-814) united much of Western Europe and was crowned Holy Roman Emperor in 800. The Viking Age (793-1066) saw Norse raiders and traders reach from Newfoundland to the Caspian Sea.

The Islamic Golden Age (8th-13th centuries): After Muhammad's death (632 CE), Arab armies conquered from Spain to Central Asia within a century. The Abbasid Caliphate (750-1258) made Baghdad a center of learning. Scholars preserved and expanded Greek philosophy, mathematics, medicine, and astronomy. Key figures: Al-Khwarizmi (algebra), Ibn Sina (Avicenna, medicine), Al-Razi (chemistry), Ibn Rushd (Averroes, philosophy).

Medieval Europe (1000-1400): Feudalism organized society into lords, vassals, and serfs. The Catholic Church was the dominant religious and political force. The Crusades (1095-1291) attempted to reclaim Jerusalem from Muslim rule. Gothic architecture produced cathedrals like Notre-Dame. The Black Death (1347-1351) killed 30-60% of Europe's population.

Asia during the Middle Ages:
- Tang Dynasty China (618-907): One of China's golden ages. Poetry, printing, gunpowder, and the Silk Road flourished. Chang'an (Xi'an) was the world's largest city.
- Song Dynasty (960-1279): Economic revolution — paper money, movable type, advanced agriculture.
- Mongol Empire (1206-1368): Genghis Khan united Mongol tribes and created the largest contiguous land empire in history. His descendants ruled from China to Persia to Russia.
- Japanese Feudalism: The samurai class emerged during the Heian (794-1185) and Kamakura (1185-1333) periods.

Africa: Great empires included Ghana (300-1200), Mali (1235-1670), and Songhai (1464-1591). Mansa Musa of Mali (c. 1280-1337) was perhaps the richest person in history. Timbuktu was a center of Islamic scholarship and trade.

Americas: The Maya (c. 2600 BCE-1697 CE) developed hieroglyphic writing, the concept of zero, and advanced astronomy. The Aztec Empire (1428-1521) built Tenochtitlan (modern Mexico City) on a lake. The Inca Empire (1438-1533) constructed Machu Picchu and 25,000 miles of roads without wheeled transport."""
    },
    {
        "title": "The Renaissance, Reformation, and Scientific Revolution",
        "content": """The Renaissance (14th-17th centuries): A cultural rebirth beginning in Italy. Rediscovery of classical Greek and Roman texts. Humanism emphasized human potential and achievements.

Key figures:
- Leonardo da Vinci (1452-1519): Artist, inventor, scientist. Painted the Mona Lisa and The Last Supper. Designed flying machines, tanks, and anatomical studies.
- Michelangelo (1475-1564): Sculpted David, painted the Sistine Chapel ceiling, designed St. Peter's Basilica dome.
- Raphael (1483-1520): Painted The School of Athens, depicting classical philosophers.
- Machiavelli (1469-1527): Wrote The Prince, analyzing political power.

The Protestant Reformation (1517): Martin Luther nailed his 95 Theses to the church door in Wittenberg, challenging Catholic Church practices (indulgences, papal authority). The Bible should be accessible to all, not just priests. Led to Protestant denominations: Lutheran, Calvinist, Anglican.

The Catholic Counter-Reformation: The Council of Trent (1545-1563) clarified Catholic doctrine. The Jesuit order (1540) became a powerful missionary and educational force.

The Scientific Revolution (16th-17th centuries):
- Copernicus (1473-1543): Proposed heliocentrism (sun-centered solar system).
- Galileo (1564-1642): Improved the telescope, confirmed heliocentrism, studied falling bodies. Tried by the Inquisition for heresy.
- Kepler (1571-1630): Discovered laws of planetary motion (elliptical orbits).
- Newton (1643-1727): Laws of motion, universal gravitation, calculus, optics.
- Bacon (1561-1626): Advocated empirical observation and the scientific method.
- Descartes (1596-1650): "I think, therefore I am." Systematic doubt and rationalism.

Age of Exploration (15th-17th centuries):
- 1492: Columbus reached the Americas
- 1498: Vasco da Gama reached India by sailing around Africa
- 1519-1522: Magellan's expedition circumnavigated the globe
- Consequences: Columbian Exchange (plants, animals, diseases between Old and New Worlds), European colonization, the Atlantic slave trade."""
    },
    {
        "title": "The Enlightenment, Revolutions, and Modern Era",
        "content": """The Enlightenment (17th-18th centuries): Emphasis on reason, science, individual rights, and skepticism of traditional authority.

Key thinkers:
- John Locke (1632-1704): Natural rights (life, liberty, property), government by consent
- Voltaire (1694-1778): Freedom of speech, religious tolerance, separation of church and state
- Rousseau (1712-1778): Social contract, popular sovereignty
- Montesquieu (1689-1755): Separation of powers (executive, legislative, judicial)
- Adam Smith (1723-1790): Wealth of Nations, free markets, division of labor
- Kant (1724-1804): "Dare to know!" Categorical imperative in ethics

The American Revolution (1775-1783): Thirteen colonies declared independence from Britain. The Declaration of Independence (1776): "All men are created equal, endowed by their Creator with certain unalienable Rights." George Washington led the Continental Army. The Constitution (1787) established a federal republic with checks and balances.

The French Revolution (1789-1799): Overthrew the monarchy and feudal system. The Declaration of the Rights of Man proclaimed liberty, equality, fraternity. The Reign of Terror (1793-1794) executed thousands, including King Louis XVI. Napoleon Bonaparte (1769-1821) seized power in 1799, crowned himself Emperor in 1804, conquered much of Europe, and was finally defeated at Waterloo (1815).

The Industrial Revolution (1760-1840): Began in Britain. Mechanization of textile production, steam engines (James Watt, 1769), railways, coal and iron. Shifted population from rural to urban. Created new social classes: industrial bourgeoisie and working class.

19th Century:
- Latin American independence (1810-1830): Simón Bolívar liberated much of South America from Spain.
- Abolition of slavery: Britain (1833), US (1865 after Civil War), Brazil (1888).
- Unification: Italy (1861) and Germany (1871) became unified nation-states.
- European imperialism: Scramble for Africa (1880s), British Raj in India, spheres of influence in China.

20th Century:
- World War I (1914-1918): 16 million dead. Ended empires (Ottoman, Austro-Hungarian, Russian, German).
- Russian Revolution (1917): Bolsheviks under Lenin established the Soviet Union.
- World War II (1939-1945): 70-85 million dead. Holocaust (6 million Jews murdered). The atomic bomb ended the war with Japan.
- Cold War (1947-1991): US-Soviet rivalry, nuclear arms race, proxy wars (Korea, Vietnam, Afghanistan).
- Decolonization (1945-1970s): India, Africa, Southeast Asia gained independence.
- Fall of Berlin Wall (1989), dissolution of USSR (1991), end of Cold War.
- September 11 attacks (2001), wars in Afghanistan and Iraq, rise of China."""
    },
    {
        "title": "Cultural Histories of Nations",
        "content": """Portugal: One of Europe's oldest nation-states (1139). Age of Discovery pioneer (Henry the Navigator, Vasco da Gama). Fado music (intimate, melancholic song tradition). Azulejo tile art. Portuguese is spoken by 250+ million people across Brazil, Angola, Mozambique, and other former colonies.

Spain: Unified under Ferdinand and Isabella (1469). The Reconquista completed (1492). Golden Age literature (Cervantes, Don Quixote). Flamenco music and dance from Andalusia. The Civil War (1936-1939) and Franco's dictatorship. Transition to democracy after Franco's death (1975). Catalan, Basque, and Galician regional identities.

France: "Eldest daughter of the Church." Gothic architecture (Notre-Dame, Chartres). The Sun King Louis XIV built Versailles. The Revolution gave the world "liberte, egalite, fraternite." Napoleon spread revolutionary ideals across Europe. Impressionism (Monet, Renoir) revolutionized art. Existentialism (Sartre, Camus).

Hawaii: Polynesian navigators settled the islands c. 300-800 CE. The kapu system regulated social and religious life. Kamehameha I unified the islands (1795). American missionaries arrived (1820), introduced writing. The monarchy was overthrown (1893), annexed by the US (1898). Hula (traditional dance) and oli (chant) preserve ancient stories. The concept of aloha extends beyond "hello" to mean love, compassion, and mutual respect.

India: One of the world's oldest continuous civilizations. The Indus Valley (c. 3300 BCE), Vedic period (1500 BCE), Maurya Empire (Ashoka, 268-232 BCE), Gupta Golden Age (320-550 CE), Mughal Empire (1526-1857), British Raj (1858-1947), independence under Gandhi (1947). Four major religions originated here: Hinduism, Buddhism, Jainism, Sikhism. Sanskrit is one of the oldest Indo-European languages. Classical traditions: yoga, Ayurvedic medicine, classical music (raga), dance (Bharatanatyam, Kathak).

Czech Republic: Ancient homeland of Celtic Boii, later Germanic Marcomanni. The Great Moravian Empire (833-907). Prague founded by Prague Castle (870s). Under Habsburg rule (1526-1918). The Defenestration of Prague (1618) triggered the Thirty Years' War. National revival (19th century). Independent Czechoslovakia (1918). Nazi occupation (1938-1945), Communist era (1948-1989), Velvet Revolution (1989), Velvet Divorce (1993). Kafka, Dvorak, Havel."""
    },
]

def write_documents(docs, filename_prefix):
    """Write documents to markdown files."""
    for i, doc in enumerate(docs):
        filename = OUTPUT_DIR / f"{filename_prefix}_{i:03d}.md"
        content = f"""# {doc['title']}

**Domain:** History
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
    print("Generating world history knowledge corpus...")
    write_documents(HISTORY_DOCUMENTS, "history")
    print(f"\nHistory corpus complete. Files in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
