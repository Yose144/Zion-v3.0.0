'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useLang } from "@/contexts/LanguageContext";
import {
  ChevronRight,
  Book,
  Sparkles,
  Atom,
  Orbit,
  Sun,
  Layers,
  Menu,
  X,
  Cpu,
  Heart,
  Globe,
} from 'lucide-react';

const EkamDeekshaCopy = {
  preface: { cs: `Předmluva`, en: `Preface` },
  secondBreathOfTheQuantumRevolu: { cs: `Druhý dech Kvantové Revoluce`, en: `Second Breath of the Quantum Revolution` },
  theEndOfTheSeparateHuman: { cs: `Konec odděleného člověka`, en: `The End of the Separate Human` },
  crisisOfTheSeparateSelf: { cs: `Krize odděleného self`, en: `Crisis of the Separate Self` },
  whyOldMapsAreNotEnough: { cs: `Proč staré mapy nestačí`, en: `Why Old Maps Are Not Enough` },
  fourLimitsOfModernSeeking: { cs: `Čtyři limity moderního hledání`, en: `Four Limits of Modern Seeking` },
  historicalLineage: { cs: `Historická linie`, en: `Historical Lineage` },
  dualUnityPrincipleOfLoveAndIns: { cs: `Dvojjediny princip lásky a vhledu`, en: `Dual-Unity Principle of Love and Insight` },
  transmissionAsConsciousnessTec: { cs: `Přenos jako technologie vědomí`, en: `Transmission as Consciousness Technology` },
  templeAndGoldenCenter: { cs: `Chrám a zlaté centrum`, en: `Temple and Golden Center` },
  goldenSeedCosmologyOfCreation: { cs: `Zlatý zárodek — kosmologie stvoření`, en: `Golden Seed — Cosmology of Creation` },
  algorithmAsGoldenSeedCosmicHar: { cs: `Algoritmus jako zlatý zárodek — Cosmic Harmony v3`, en: `Algorithm as Golden Seed — Cosmic Harmony v3` },
  algorithmOfTheGoldenAge: { cs: `Algoritmus Zlatého věku`, en: `Algorithm of the Golden Age` },
  tenStepsFromSeparationToUnity: { cs: `Deset kroků od separace k jednotě`, en: `Ten Steps from Separation to Unity` },
  conclusion: { cs: `Závěr`, en: `Conclusion` },
  whenTheGoldenAgeBegins: { cs: `Kdy začíná Zlatý věk`, en: `When the Golden Age Begins` },
  initializationOfTheGoldenSeedB: { cs: `Inicializace zlatého zárodku — seed z hlavičky bloku se rozvíjí v primordial state.`, en: `Initialization of the golden seed — block header seed expands into primordial state.` },
  expansionOfCreationReadingFrom: { cs: `Expanze stvoření — čtení z 256 KiB scratchpadu rozviřuje prostor stavů.`, en: `Expansion of creation — reading from 256 KiB scratchpad swirls the state space.` },
  k4Passes256RandomReadsGeometryO: { cs: `4 průchody × 256 náhodných čtení — geometrie posvátného vzorce, doslova nelze parallelizovat.`, en: `4 passes × 256 random reads — geometry of sacred pattern, literally cannot be parallelized.` },
  lawOfCauseEpochNpuWeightsRotat: { cs: `Zákon příčiny — epoch NPU váhy (rotace každých 2016 / 100 bloků) mění výsledek každou epochou.`, en: `Law of cause — epoch NPU weights (rotation every 2016 / 100 blocks) change the result each epoch.` },
  pureConsciousnessFinalMixOfWei: { cs: `Čisté vědomí — finální mix vah s hash state.`, en: `Pure consciousness — final mix of weights with hash state.` },
  unification32ByteResultCompare: { cs: `Sjednocení — 32bajtový výsledek srovnaný s target difficulty. PoW je dokončen.`, en: `Unification — 32-byte result compared with target difficulty. PoW is complete.` },
  memoryBoundWorkEveryScannerPas: { cs: `Paměťově vázaná práce — každý průchod skenerem musí procházet celou 256 KiB oblastí. ASIC nemůže vynechat paměťový latency.`, en: `Memory-bound work — every scanner pass must traverse the entire 256 KiB region. ASIC cannot skip memory latency.` },
  epochNpuWeights: { cs: `Epoch NPU váhy`, en: `Epoch NPU Weights` },
  every2016BlocksOr100BlocksInTe: { cs: `Každých 2016 bloků (nebo 100 bloků v testnet) se rotují NPU vahové matice. Speciální hardware zastarává každou epochou.`, en: `Every 2016 blocks (or 100 blocks in testnet) the NPU weight matrices rotate. Specialized hardware becomes obsolete every epoch.` },
  continuesTheQuantumRevolution: { cs: `Navazuje na Kvantovou Revoluci`, en: `Continues the Quantum Revolution` },
  algorithmOfUnityPhilosophyCosm: { cs: `Algoritmus jednoty — filozofie, kosmologie a praxe Zlatého věku`, en: `Algorithm of unity — philosophy, cosmology and practice of the Golden Age` },
  theSecondBookAfterTheQuantumRe: { cs: `Druhá kniha po Kvantové Revoluci. Nepokračuje tím, že by přidala novou teorii. Obrací pohled dovnitř: co se musí stát ve vědomí člověka, aby se oddělený svět opravdu přestal reprodukovat.`, en: `The second book after the Quantum Revolution. It does not continue by adding new theory. It turns the gaze inward: what must happen in human consciousness for the separated world to truly stop reproducing itself.` },
  exploreEkam: { cs: `Projít Ekam`, en: `Explore Ekam` },
  chapters: { cs: `Kapitoly`, en: `Chapters` },
  ch: { cs: `Kap. `, en: `Ch. ` },
  theQuantumRevolutionNamedTheCi: { cs: `Kvantová Revoluce pojmenovala civilizační práh.`, en: `The Quantum Revolution named the civilizational threshold.` },
  itShowedThatTheOldWorldDoesNot: { cs: `Ukázala, že starý svět se nevyčerpává náhodou —`, en: `It showed that the old world does not exhaust itself by accident —` },
  butBecauseItHasReachedTheLimit: { cs: `ale proto, že dosáhl mezí vlastního odděleného vědomí.`, en: `but because it has reached the limits of its own separated consciousness.` },
  thisBookFollowsThatMapButItDoe: { cs: `Tato kniha na tu mapu navazuje. Ale nerozšiřuje ji přidáním nové vrstvy teorie.`, en: `This book follows that map. But it does not expand it by adding a new layer of theory.` },
  itTurnsTheGaze: { cs: `Obrací pohled `, en: `It turns the gaze ` },
  inward: { cs: `dovnitř`, en: `inward` },
  itAsksMorePreciselyWhatMustHap: { cs: `Ptá se přesněji: co se musí stát v člověku, aby oddělený svět opravdu skončil?`, en: `It asks more precisely: what must happen in a human being for the separated world to truly end?` },
  betterSystemsAreNotEnoughAQuan: { cs: `Nestačí lepší systémy. Nestačí kvantový slovník. Nestačí motivační spiritualita.`, en: `Better systems are not enough. A quantum vocabulary is not enough. Motivational spirituality is not enough.` },
  whatIsNeededIsTheEndOfOneStruc: { cs: `Je třeba konec jedné struktury vnímání — a zrození jiné.`, en: `What is needed is the end of one structure of perception — and the birth of another.` },
  ekamMeansOne: { cs: `Ekam znamená „jedno".`, en: `Ekam means "one".` },
  deekshaMeansTransmissionInitia: { cs: `Deeksha znamená „přenos, zasvěcení, milost".`, en: `Deeksha means "transmission, initiation, grace".` },
  thisBookIsAboutHowThisOnenessI: { cs: `Tato kniha je o tom, jak se toto jedno přenáší v čase,`, en: `This book is about how this oneness is transmitted in time,` },
  spacePhilosophyAndInBlockchain: { cs: `prostoru, filozofii — a v algoritmech blockchainu.`, en: `space, philosophy — and in blockchain algorithms.` },
  behindThisBookStandsTheLineage: { cs: `Za touto knihou stojí linie Jeevashram → Satyaloka → Oneness → Ekam.`, en: `Behind this book stands the lineage Jeevashram → Satyaloka → Oneness → Ekam.` },
  behindThisLineageStandAmmaAndB: { cs: `Za touto linií stojí Amma a Bhagavan Sri Kalki.`, en: `Behind this lineage stand Amma and Bhagavan Sri Kalki.` },
  andBehindAllOfThisStandsTheOld: { cs: `A za tím vším stojí nejstarší kosmologický obraz Véd:`, en: `And behind all of this stands the oldest cosmological image of the Vedas:` },
  theGoldenSeedFromWhichTheUnive: { cs: `zlatý zárodek, z něhož se rodí vesmír.`, en: `the golden seed from which the universe is born.` },
  chapter1: { cs: `Kapitola 1`, en: `Chapter 1` },
  thereAreEpochsWhenCivilization: { cs: `Existují epochy, kdy se civilizace hroutí pod tlakem vnějších sil. A pak existují epochy, kdy se hroutí proto, že už neudrží vlastní vnitřní tvar. Naše doba patří do té druhé kategorie. Na povrchu vidíme konflikty, ekonomické otřesy, rozpad vztahů, epidemii úzkosti, technologickou závislost i duchovní zmatek. Pod tím vším však leží hlubší příčina. Člověk se sám pro sebe stal oddělenou jednotkou, která přestala prožívat svou souvislost se životem.`, en: `There are epochs when civilizations collapse under external pressure. And there are epochs when they collapse because they can no longer maintain their own inner shape. Our era belongs to the second category. On the surface we see conflicts, economic shocks, relationship breakdowns, an epidemic of anxiety, technological addiction and spiritual confusion. But beneath all of this lies a deeper cause. Humans have become a separate unit unto themselves, no longer experiencing their connection with life.` },
  theFundamentalProblemIsNotMora: { cs: `Základní problém není morální. Problém je ontologický. Člověk vnímá sebe sama jako izolované centrum, které se musí neustále bránit, potvrzovat a zachraňovat. Z tohoto pocitu oddělení se rodí strach. Ze strachu se rodí kontrola. Z kontroly se rodí násilí, přetvářka, únava a odcizení.`, en: `The fundamental problem is not moral. It is ontological. A human perceives themself as an isolated center that must constantly defend, confirm and save itself. From this feeling of separation, fear is born. From fear, control is born. From control, violence, pretense, exhaustion and alienation are born.` },
  thatIsWhyThereIsSoMuchTechnolo: { cs: `Proto je dnes tolik technologií, ale málo klidu. Tolik komunikace, ale málo skutečného setkání. Tolik spirituality, ale málo skutečné proměny. Oddělené self umí recyklovat i to, co mělo být cestou ven. Umí z meditace udělat výkon. Umí z lásky udělat vlastnictví. Umí z osvobození udělat další projekt ega.`, en: `That is why there is so much technology today, but so little peace. So much communication, but so little real encounter. So much spirituality, but so little real transformation. The separate self can recycle even what was meant to be a way out. It can turn meditation into performance. It can turn love into possession. It can turn liberation into another ego project.` },
  coreThesis: { cs: `Základní teze`, en: `Core Thesis` },
  sufferingDoesNotAriseBecauseTh: { cs: `Utrpení nevzniká proto, že je svět nedokonalý, ale proto, že prožíváme sebe sama jako oddělené od života. Probuzení nezačíná ve správné doktríně, nýbrž v prasknutí tohoto omylu.`, en: `Suffering does not arise because the world is imperfect, but because we experience ourselves as separate from life. Awakening does not begin in the right doctrine, but in the bursting of this error.` },
  thisIsThePowerOfTheLineageOfAm: { cs: `V tom je síla linie Amma, Bhagavan, Oneness a Ekam. Nevychází primárně z toho, co si člověk má myslet, ale z toho, co má zakusit. V okamžiku, kdy se já přestává jevit jako uzavřený ostrov, mění se vše. Způsob, jakým vnímáme druhé. Způsob, jakým držíme bolest. Způsob, jakým zacházíme s technologií, mocí i smyslem.`, en: `This is the power of the lineage of Amma, Bhagavan, Oneness and Ekam. It does not primarily proceed from what a person should think, but from what they should experience. In the moment when the self ceases to appear as a closed island, everything changes. The way we perceive others. The way we hold pain. The way we handle technology, power and meaning.` },
  thereforeEkamDeekshaIsNotABook: { cs: `Ekam Deeksha proto není knihou o další víře. Je knihou o konci jedné struktury vnímání. Tento konec však není katastrofa. Je to porod. Žádný Zlatý věk nevznikne bez této vnitřní revoluce.`, en: `Therefore Ekam Deeksha is not a book about another belief. It is a book about the end of one structure of perception. Yet this end is not a catastrophe. It is a birth. No Golden Age will arise without this inner revolution.` },
  chapter2: { cs: `Kapitola 2`, en: `Chapter 2` },
  itIsNoLongerEnoughToKnowWhatIs: { cs: `Nestačí už vědět, co je špatně. Je třeba rozpoznat, proč nám dosavadní mapy nedokázaly otevřít cestu ven. Proč i po desetiletích psychologie, sebepomoci, managementu vědomí a motivační spirituality zůstává člověk uvnitř sebe stejně rozdělený.`, en: `It is no longer enough to know what is wrong. One must recognize why the maps we have had so far could not open a way out. Why even after decades of psychology, self-help, consciousness management and motivational spirituality, a person remains just as divided within.` },
  limitOfRationality: { cs: `Limit racionality`, en: `Limit of Rationality` },
  reasonCanAnalyzeTheContentOfCo: { cs: `Rozum umí analyzovat obsah vědomí, ale neumí s jistotou rozpustit strukturu, z níž analýza vychází. Umí zkoumat ego, ale ego se snaží opravit pomocí ega.`, en: `Reason can analyze the content of consciousness, but it cannot reliably dissolve the structure from which analysis arises. It can examine the ego, but the ego tries to fix itself using the ego.` },
  motivationalSpirituality: { cs: `Motivační spiritualita`, en: `Motivational Spirituality` },
  theSeparateSelfCanVeryQuicklyL: { cs: `Oddělené já se umí velmi rychle naučit duchovní jazyk. Umí z afirmace udělat obranu, z meditace výkon, z pojmů jako hojnost a poslání kultivovanější sebestřednost.`, en: `The separate self can very quickly learn spiritual language. It can turn affirmation into defense, meditation into performance, concepts like abundance and mission into a more cultivated self-centeredness.` },
  dreamOfTechnicalSalvation: { cs: `Sen o technické spáse`, en: `Dream of Technical Salvation` },
  technologyWithoutConsciousness: { cs: `Technologie bez vědomí nevede ke zrození nové civilizace, ale k urychlení starých mechanismů. Co je uvnitř nezralé, dostává pouze větší dosah.`, en: `Technology without consciousness does not lead to the birth of a new civilization, but to the acceleration of old mechanisms. What is immature inside only gains greater reach.` },
  selfInterpretation: { cs: `Sebe-interpretace`, en: `Self-Interpretation` },
  understandingAMechanismDoesNot: { cs: `Porozumění mechanismu neznamená automaticky vystoupení z mechanismu. Sebepopis bez průlomu zkušenosti se může stát sofistikovanou formou stagnace.`, en: `Understanding a mechanism does not automatically mean stepping out of it. Self-description without a breakthrough of experience can become a sophisticated form of stagnation.` },
  thisIsWhereTheSignificanceOfTh: { cs: `Právě zde začíná význam linie Deekshy. Nepřichází proto, aby znehodnotila rozum, terapii ani techniku. Přichází proto, aby ukázala jejich hranici. Jejím jádrem je přiznání, že člověk potřebuje víc než další obsah. Potřebuje změnu samotného modu vnímání.`, en: `This is where the significance of the Deeksha lineage begins. It does not come to devalue reason, therapy or technique. It comes to show their limit. Its core is the admission that a human needs more than another content. They need a change in the very mode of perception.` },
  chapter3: { cs: `Kapitola 3`, en: `Chapter 3` },
  whatLaterRevealedItselfToTheWo: { cs: `To, co se později ukázalo světu jako Oneness nebo Ekam, nezačínalo jako hotová ideologie. Rodilo se postupně jako experiment s lidskou bolestí, vztahy, výchovou, vnímáním a možností skutečné transformace.`, en: `What later revealed itself to the world as Oneness or Ekam did not begin as a finished ideology. It was born gradually as an experiment with human pain, relationships, upbringing, perception and the possibility of real transformation.` },
  beginning: { cs: `Počátek`, en: `Beginning` },
  pedagogicalAndFormativeImpulse: { cs: `Pedagogický a formativní impuls — snaha pracovat s lidským potenciálem u kořene dříve, než se plně zafixuje do dospělé identity.`, en: `Pedagogical and formative impulse — an effort to work with human potential at the root before it fully fixates into adult identity.` },
  secondPhase: { cs: `Druhá fáze`, en: `Second Phase` },
  shiftFromInstitutionToStateThe: { cs: `Posun od instituce ke stavu. Důležitý přestává být pouze obsah výuky a stále více vystupuje otázka, co se s člověkem děje v přítomnosti, v rituálu, v poli sdílené energie.`, en: `Shift from institution to state. The content of teaching ceases to be the only important thing and the question increasingly emerges: what is happening to a person in presence, in ritual, in the field of shared energy.` },
  globalization: { cs: `Globalizace`, en: `Globalization` },
  theLocalExperimentTransformsIn: { cs: `Místní experiment se proměňuje v mezinárodně sdílenou cestu, která má vlastní jazyk, strukturu procesu i rituální infrastrukturu. Škola i nešola. Instituce i anti-instituce.`, en: `The local experiment transforms into an internationally shared path with its own language, process structure and ritual infrastructure. School and non-school. Institution and anti-institution.` },
  livingFieldToday: { cs: `Živé pole dnes`, en: `Living Field Today` },
  behindTodaySSymbolismOfTheTemp: { cs: `Za dnešní symbolikou chrámu, Golden Orb a planetárního pole nestojí marketingová improvizace, ale desítky let hledání adekvátního tvaru pro sdílení toho, co nelze redukovat na informaci.`, en: `Behind today\'s symbolism of the temple, Golden Orb and planetary field stands not marketing improvisation, but decades of seeking an adequate form for sharing what cannot be reduced to information.` },
  thisHistoricalTrajectoryAllows: { cs: `Tato historická trajektorie nám umožňuje pochopit Ekam střízlivěji a hlouběji. Linie jednoty se nikdy nechtěla zastavit u soukromého zážitku. Vždy nesla civilizační ambici: bez proměny vědomí nevzniká ani nová kultura, ani nová ekonomika, ani nová technologie.`, en: `This historical trajectory allows us to understand Ekam more soberly and deeply. The lineage of unity never wanted to stop at private experience. It always carried a civilizational ambition: without transformation of consciousness, neither new culture, nor new economy, nor new technology arises.` },
  chapter4: { cs: `Kapitola 4`, en: `Chapter 4` },
  ammaAndBhagavanAreNotMerelyFou: { cs: `Amma a Bhagavan nejsou v linii Ekam pouze zakladateli v organizačním smyslu. Reprezentují funkční princip, který tuto linii drží pohromadě — ne organizačně, ale symbolicky a ontologicky.`, en: `Amma and Bhagavan are not merely founders in the organizational sense in the Ekam lineage. They represent a functional principle that holds this lineage together — not organizationally, but symbolically and ontologically.` },
  ammaPrincipleOfLove: { cs: `Amma — princip lásky`, en: `Amma — Principle of Love` },
  ammaEmbodiesUnconditionalAccep: { cs: `Amma ztělesňuje bezpodmínečné přijetí. Láskyplnou přítomnost, která nehodnotí a neodmítá. V linii Ekam je tato energie popsána jako sídlo soucitu — schopnost přijmout člověka přesně tam, kde je, bez požadavku, že nejprve uspěje.`, en: `Amma embodies unconditional acceptance. A loving presence that does not judge and does not reject. In the Ekam lineage, this energy is described as the abode of compassion — the ability to accept a person exactly where they are, without the demand that they first succeed.` },
  bhagavanPrincipleOfInsight: { cs: `Bhagavan — princip vhledu`, en: `Bhagavan — Principle of Insight` },
  bhagavanSriKalkiRepresentsPene: { cs: `Bhagavan Sri Kalki reprezentuje pronikající jasnost, která vidí skrz iluze. Kde Amma zahřeje, Bhagavan osvítí. Dohromady tvoří pole, v němž může proměna vejít do obou svých pohybů: přijetí a osvobození.`, en: `Bhagavan Sri Kalki represents penetrating clarity that sees through illusions. Where Amma warms, Bhagavan illuminates. Together they create a field in which transformation can enter both of its movements: acceptance and liberation.` },
  forManyFollowersAmmaAndBhagava: { cs: `Pro mnoho následovníků ztělesňovali Amma a Bhagavan možnost, že probuzení není mýtus a že lidské vědomí lze vést jinak, než jak to dělá civilizace výkonu, traumatu a obrany.`, en: `For many followers, Amma and Bhagavan embodied the possibility that awakening is not a myth and that human consciousness can be led differently than the civilization of performance, trauma and defense does.` },
  theTransmissionOfTheLineageToS: { cs: `Přenos linie na Sri Krishnaji a Sri Preethaji — jejich děti a nástupce vedení Ekam — není přerušením tohoto principu. Je pokračováním téže polarizace v nové generaci. Pole zůstává. Forma se přizpůsobuje.`, en: `The transmission of the lineage to Sri Krishnaji and Sri Preethaji — their children and successors in leading Ekam — is not an interruption of this principle. It is a continuation of the same polarization in a new generation. The field remains. The form adapts.` },
  chapter5: { cs: `Kapitola 5`, en: `Chapter 5` },
  deekshaASanskritWordForInitiat: { cs: `Deeksha — sanskrtské slovo pro zasvěcení, přenos nebo milost — je v linii Ekam klíčovým operativním pojmem. Nelze ji plně redukovat ani na rituál, ani na psychologický zásah, ani na placebo. Je to popis specifické kvality přítomnosti a přenosu, která se snaží působit na samotnou strukturu vnímání.`, en: `Deeksha — a Sanskrit word for initiation, transmission or grace — is a key operative concept in the Ekam lineage. It cannot be fully reduced to either ritual, or psychological intervention, or placebo. It is a description of a specific quality of presence and transmission that seeks to affect the very structure of perception.` },
  inThePracticeOfOnenessAndEkamD: { cs: `V praxi Oneness a Ekam existuje Deeksha v několika formách. Sparsha Deeksha — přenos dotykem, kdy facilitátor jemně přiloží dlaně na hlavu příjemce. Smarana Deeksha — přenos záměrem a přítomností bez fyzického kontaktu. Oneness Meditation — skupinové pole s vedením. A přenos skrze samotnou architekturu a atmosféru chrámu Ekam.`, en: `In the practice of Oneness and Ekam, Deeksha exists in several forms. Sparsha Deeksha — transmission by touch, when the facilitator gently places their palms on the recipient\'s head. Smarana Deeksha — transmission by intention and presence without physical contact. Oneness Meditation — group field with guidance. And transmission through the very architecture and atmosphere of the Ekam temple.` },
  whatDeekshaClaimsToDo: { cs: `Co Deeksha tvrdí, že dělá`, en: `What Deeksha Claims to Do` },
  quietsTheConstantMentalNoiseOf: { cs: `Ztišuje neustálý mentální hluk odděleného já`, en: `Quiets the constant mental noise of the separate self` },
  opensSpaceForDirectExperienceO: { cs: `Otevírá prostor pro přímou zkušenost jednoty`, en: `Opens space for direct experience of unity` },
  releasesEmotionalKnotsBoundToS: { cs: `Uvolňuje emocionální uzly vázané na oddělené vnímání`, en: `Releases emotional knots bound to separated perception` },
  facilitatesTheTransitionFromId: { cs: `Usnadňuje přechod od identifikace s myslí k prožívání přítomnosti`, en: `Facilitates the transition from identification with mind to experiencing presence` },
  doesNotCreateANewSpiritualPerf: { cs: `Nevytváří nový duchovní výkon — rozpouští potřebu ho vytvářet`, en: `Does not create a new spiritual performance — dissolves the need to create one` },
  directExperienceHoldsAnIrrepla: { cs: `Přímé zkušenosti patří nenahraditelné místo, protože pouze ona může zpochybnit suverenitu mentálního centra. Když člověk na chvíli zakusí stav, v němž není ovládán neustálou obranou — otvírá se mu možnost, že je skutečně možné žít jinak.`, en: `Direct experience holds an irreplaceable place, because only it can challenge the sovereignty of the mental center. When a person momentarily experiences a state in which they are not controlled by constant defense — a possibility opens that it is truly possible to live differently.` },
  chapter6: { cs: `Kapitola 6`, en: `Chapter 6` },
  theEkamTempleInAndhraPradeshIs: { cs: `Chrám Ekam v Andhra Pradesh je fyzickým tělem tohoto pole. Bílý mramor, mohutná střecha, geometrie inspirovaná védskou architekturou a posvátnými vzorci Sri Chakry. Ale chrám není cílem. Je nástrojem — prostorem, který byl záměrně zkonstruován tak, aby v přítomném člověku probouzel ozvěnu toho, co je na proměnu připraveno.`, en: `The Ekam temple in Andhra Pradesh is the physical body of this field. White marble, massive roof, geometry inspired by Vedic architecture and sacred patterns of Sri Chakra. But the temple is not the goal. It is a tool — a space deliberately constructed to awaken in the present person an echo of what is ready for transformation.` },
  theGoldenSeedOfConsciousnessIs: { cs: `Zlatý zárodek vědomí je v centru každého člověka.`, en: `The golden seed of consciousness is in the center of every human being.` },
  theGoldenAgeIsNotAFutureThatWi: { cs: `Zlatý věk není budoucnost, která přijde sama od sebe.`, en: `The Golden Age is not a future that will come by itself.` },
  itIsAStateOfConsciousnessThatM: { cs: `Je to stav vědomí, který musí být probuzen.`, en: `It is a state of consciousness that must be awakened.` },
  goldenOrbTheGoldenSphereInTheC: { cs: `Golden Orb — zlatá koule uprostřed chrámového pole — není dekorativní prvek. Je to kondenzovaný symbol klíčové teze: jako je semeno v jádru plodu, tak je zárodek jednoty v jádru odděleného já. Nezničitelný. Čekající.`, en: `Golden Orb — the golden sphere in the center of the temple field — is not a decorative element. It is a condensed symbol of the key thesis: as the seed is in the core of the fruit, so is the seed of unity in the core of the separate self. Indestructible. Waiting.` },
  ekamAsPlanetaryField: { cs: `Ekam jako planetární pole`, en: `Ekam as Planetary Field` },
  thePhysicalTempleIsOneNodeEkam: { cs: `Fyzický chrám je jedním uzlem. Ekam pracuje s myšlenkou, že skupinová meditace v synchronizaci přes vzdálenost buduje globální pole vědomí — podobně, jak lokální sítě tvoří internet. Kritická masa probuzených vědomí se v této logice mění z osobního osvobození ve civilizační sílu.`, en: `The physical temple is one node. Ekam works with the idea that group meditation in synchronization across distance builds a global field of consciousness — similarly to how local networks form the internet. In this logic, a critical mass of awakened consciousness transforms from personal liberation into civilizational force.` },
  chapter7: { cs: `Kapitola 7`, en: `Chapter 7` },
  hiranyagarbhaGoldenWombGoldenE: { cs: `Hiranyagarbha — zlaté lůno, zlaté vejce — je jedním z nejstarších kosmologických obrazů védské tradice. V Rgvédu se zjevuje jako prvotní zárodek plovoucí v primordálních vodách. Nese Brahmu, duši vesmíru, první světlo, které se rozvinulo v existenci.`, en: `Hiranyagarbha — golden womb, golden egg — is one of the oldest cosmological images of the Vedic tradition. In the Rigveda it appears as the primordial seed floating in primordial waters. It carries Brahma, the soul of the universe, the first light that unfolded into existence.` },
  inTheBeginningWasTheGoldenEggT: { cs: `„Na počátku bylo zlaté vejce, zárodek vesmíru.`, en: `"In the beginning was the golden egg, the seed of the universe.` },
  fromItWasBornTheWholeWorldHeav: { cs: `Z něho se zrodil veškerý svět — nebe, země, světlo, tma."`, en: `From it was born the whole world — heaven, earth, light, darkness."` },
  rigvedaHymnToHiranyagarbha: { cs: `— Rigvéda, hymnus na Hiranyagarbhu`, en: `— Rigveda, Hymn to Hiranyagarbha` },
  inTheContextOfTheEkamLineageHi: { cs: `V kontextu linie Ekam dostává Hiranyagarbha novou vrstvu čtení. Není to pouze kosmologický archetyp. Je to popis stavu, do nějž může vědomí vstoupit: primordální ticho před první myšlenkou. Neutrálnost zárodku. Plnost, která ještě není rozdělena na já a jiné.`, en: `In the context of the Ekam lineage, Hiranyagarbha receives a new layer of reading. It is not merely a cosmological archetype. It is a description of a state into which consciousness can enter: primordial silence before the first thought. Neutrality of the seed. Fullness that is not yet divided into self and other.` },
  vedicCosmology: { cs: `Védská kosmologie`, en: `Vedic Cosmology` },
  theGoldenEggFloatsInPrimordial: { cs: `Zlaté vejce pluje v primordálních vodách. Nese zárodek celého stvořeného světa.`, en: `The golden egg floats in primordial waters. It carries the seed of the entire created world.` },
  ekamLineage: { cs: `Linie Ekam`, en: `Ekam Lineage` },
  goldenOrbAsTheCenterOfTheTempl: { cs: `Golden Orb jako centrum chrámu — kondenzovaný symbol zárodku nového vědomí.`, en: `Golden Orb as the center of the temple — condensed symbol of the seed of new consciousness.` },
  zionPow: { cs: `ZION PoW`, en: `ZION PoW` },
  ekamDeekshaHashPipelineBeginsW: { cs: `Ekam Deeksha hash pipeline začíná fází Hiranyagarbha — inicializací zlatého zárodku z hlavičky bloku.`, en: `Ekam Deeksha hash pipeline begins with the Hiranyagarbha phase — initialization of the golden seed from the block header.` },
  chapter8: { cs: `Kapitola 8`, en: `Chapter 8` },
  zionTerranovaBearsTheNameEkamD: { cs: `ZION TerraNova nese jméno Ekam Deeksha v samotném jádru svého proof-of-work algoritmu — Cosmic Harmony v3. Nejde o náhodné pojmenování. Struktura algoritmu záměrně zrcadlí cestu vědomí od zárodku k celku.`, en: `ZION TerraNova bears the name Ekam Deeksha in the very core of its proof-of-work algorithm — Cosmic Harmony v3. It is not a random naming. The structure of the algorithm intentionally mirrors the path of consciousness from seed to whole.` },
  everyBlockThatAMinerMinesPasse: { cs: `Každý blok, který miner vytěží, prochází šestistupňovým pipeline. Každý stupeň nese jméno védského kosmologického principu. A každý stupeň má technický důvod, který koresponduje s jeho symbolickým názvem.`, en: `Every block that a miner mines passes through a six-stage pipeline. Each stage bears the name of a Vedic cosmological principle. And each stage has a technical reason that corresponds with its symbolic name.` },
  k6StageEkamDeekshaPipeline: { cs: `6-stupňový pipeline Ekam Deeksha`, en: `6-Stage Ekam Deeksha Pipeline` },
  asicResistanceTwoLayerProtecti: { cs: `ASIC rezistence — dvouvrstvá ochrana`, en: `ASIC Resistance — Two-Layer Protection` },
  whyThisNamingIsNotJustDecorati: { cs: `Proč toto pojmenování není jen dekorace`, en: `Why This Naming Is Not Just Decoration` },
  hiranyagarbhaInitializesTheSee: { cs: `Hiranyagarbha inicializuje zárodek výpočtu z primordálního chaosu vstupních dat. Brahma rozvíjí stavový prostor do plné 256 KiB oblasti. Yantra vnáší geometriku posvátného vzorce. Karma aplikuje epochálně proměnné váhy — žádný výpočet není totožný s minulou epochou. Chit integruje vše do čistého stavu vědomí. Samadhi dosahuje finálního sjednocení — platného PoW.`, en: `Hiranyagarbha initializes the seed of computation from the primordial chaos of input data. Brahma expands the state space into the full 256 KiB region. Yantra introduces the geometry of the sacred pattern. Karma applies epochally variable weights — no computation is identical to the previous epoch. Chit integrates everything into the pure state of consciousness. Samadhi achieves final unification — valid PoW.` },
  thusTheBlockchainCarriesThePhi: { cs: `Blockchain tak nese filozofii, která ho pojmenovala, přesně v technické struktuře svého důkazu práce. To je konvergence Kvantové Revoluce a Ekam Deeksha: jedno v blocích, druhé ve vědomí.`, en: `Thus the blockchain carries the philosophy that named it, precisely in the technical structure of its proof of work. This is the convergence of the Quantum Revolution and Ekam Deeksha: one in blocks, the other in consciousness.` },
  chapter9: { cs: `Kapitola 9`, en: `Chapter 9` },
  theGoldenAgeIsNotAUtopiaNotAnA: { cs: `Zlatý věk není utopie, není apokalyptický zlom ani propagandistické heslo. Je to posun vnímání, vztahů a institucí. Klíčové slovo je posun — ne revoluce shora, ne záchrana zvenčí. Proměna zevnitř.`, en: `The Golden Age is not a utopia, not an apocalyptic break, not a propaganda slogan. It is a shift in perception, relationships and institutions. The key word is shift — not revolution from above, not rescue from outside. Transformation from within.` },
  stoppingTheNoise: { cs: `Zastavení hluku`, en: `Stopping the Noise` },
  consciousPauseInterruptionOfTh: { cs: `Vědomá pauza — přerušení automatického proudu myšlenek, notifikací a reakcí. Bez ticha nelze nic rozpoznat.`, en: `Conscious pause — interruption of the automatic stream of thoughts, notifications and reactions. Without silence nothing can be recognized.` },
  recognizingSeparation: { cs: `Rozpoznání separace`, en: `Recognizing Separation` },
  toSeeWhenWeActFromSeparationFr: { cs: `Vidět, kdy jednáme z oddělenosti — ze strachu, obrany, potřeby potvrzení. Samotné rozpoznání začíná měnit vzorec.`, en: `To see when we act from separation — from fear, defense, need for confirmation. Recognition itself begins to change the pattern.` },
  openingTheHeart: { cs: `Otevření srdce`, en: `Opening the Heart` },
  movementFromTheHeadAsTheOnlyCe: { cs: `Pohyb od hlavy jako jediného centra k celému tělu jako poli vnímání. Srdce jako druhý mozek.`, en: `Movement from the head as the only center to the whole body as a field of perception. The heart as a second brain.` },
  activatingSensitivity: { cs: `Aktivace citlivosti`, en: `Activating Sensitivity` },
  theAbilityToBeTrulyPresentWith: { cs: `Schopnost být skutečně přítomen — s druhým člověkem, s přírodou, s vlastním tělem. Bez hodnocení.`, en: `The ability to be truly present — with another person, with nature, with one\'s own body. Without judgment.` },
  transmissionAndDeeksha: { cs: `Přenos a Deeksha`, en: `Transmission and Deeksha` },
  breakingTheIsolationOfSelfInte: { cs: `Prolomení izolace sebe-interpretace přijetím impulzu z pole vědomí, které je hlubší než individuální mysl.`, en: `Breaking the isolation of self-interpretation by receiving an impulse from a field of consciousness that is deeper than the individual mind.` },
  stabilization: { cs: `Stabilizace`, en: `Stabilization` },
  integrationOfTheNewStateIntoEv: { cs: `Integrace nového stavu do každodenního života. Bez stabilizace je každé probuzení jen dočasná výjimka.`, en: `Integration of the new state into everyday life. Without stabilization, every awakening is only a temporary exception.` },
  service: { cs: `Služba`, en: `Service` },
  turnFromSelfCenterednessToCare: { cs: `Obrat od sebestřednosti k péči. Probuzení, které neslouží druhým, se uzavírá zpět do rafinovanějšího ega.`, en: `Turn from self-centeredness to care. Awakening that does not serve others closes back into a more refined ego.` },
  creatingLocalFields: { cs: `Vytváření lokálních polí`, en: `Creating Local Fields` },
  creatingSpacesAndCommunitiesWh: { cs: `Tvoření prostorů a komunit, kde jsou podmínky pro proměnu vědomí přítomny. Každý takový uzel je buňkou nové civilizace.`, en: `Creating spaces and communities where conditions for transformation of consciousness are present. Every such node is a cell of a new civilization.` },
  networking: { cs: `Síťování`, en: `Networking` },
  connectingLocalFieldsIntoAMutu: { cs: `Propojení lokálních polí do vzájemně podporující se sítě. Od izolovaných ostrovů k archipelagu vědomí.`, en: `Connecting local fields into a mutually supporting network. From isolated islands to an archipelago of consciousness.` },
  civilizationalManifestation: { cs: `Civilizační manifestace`, en: `Civilizational Manifestation` },
  newEducationNewEconomyNewPolit: { cs: `Nové vzdělávání, nová ekonomika, nová politika — ne jako ideologický program, ale jako přirozený výsledek dostatečně mnoha proměněných lidí.`, en: `New education, new economy, new politics — not as an ideological program, but as a natural result of sufficiently many transformed people.` },
  thisAlgorithmIsNotLinearInTheS: { cs: `Tento algoritmus není lineární v tom smyslu, že by se kroky přecházelo jednou a navždy. Je to spirála. Vracíme se k tichu znovu a znovu. A každý obrat zvětšuje dosah civilizační změny.`, en: `This algorithm is not linear in the sense that steps would be passed through once and for all. It is a spiral. We return to silence again and again. And each turn increases the reach of civilizational change.` },
  theGoldenAgeDoesNotBeginWhenTh: { cs: `Zlatý věk nezačíná, když se změní vláda.`, en: `The Golden Age does not begin when the government changes.` },
  itDoesNotBeginWhenASufficientl: { cs: `Nezačíná, když se vymyslí dostatečně dobrý systém.`, en: `It does not begin when a sufficiently good system is invented.` },
  itDoesNotEvenBeginWhenTechnolo: { cs: `Nezačíná ani tehdy, když technologie dosáhne dostatečné složitosti.`, en: `It does not even begin when technology reaches sufficient complexity.` },
  theGoldenAgeAlwaysBeginsWhenOn: { cs: `Zlatý věk začíná vždy, když se jeden konkrétní člověk`, en: `The Golden Age always begins when one particular human being` },
  ceasesToExperienceThemselvesAs: { cs: `přestane prožívat jako uzavřený ostrov.`, en: `ceases to experience themselves as a closed island.` },
  andThisIsPreciselyWhatTheEkamD: { cs: `A toto je přesně to, co linie Ekam Deeksha hledá`, en: `And this is precisely what the Ekam Deeksha lineage seeks` },
  fromTheFirstDaysOfJeevashramTo: { cs: `od prvních dnů Jeevashram až po dnešní pole chrámu Ekam.`, en: `from the first days of Jeevashram to today\'s field of the Ekam temple.` },
  theQuantumRevolutionShowedThat: { cs: `Kvantová Revoluce ukázala, že civilizace z vnějšku nemůže být zachráněna bez vnitřní proměny člověka.`, en: `The Quantum Revolution showed that civilization cannot be saved from the outside without the inner transformation of the human being.` },
  ekamDeekshaShowsWhatThisInnerT: { cs: `Ekam Deeksha ukazuje, jak tato vnitřní proměna vypadá —`, en: `Ekam Deeksha shows what this inner transformation looks like —` },
  inHistoryInPhilosophyInTheSpac: { cs: `v historii, v filozofii, v prostoru chrámu, v Deeksha přenosu,`, en: `in history, in philosophy, in the space of the temple, in Deeksha transmission,` },
  inTheGoldenSeedOfHiranyagarbha: { cs: `v zlatém zárodku Hiranyagarbhy`, en: `in the golden seed of Hiranyagarbha` },
  andInEveryBlockOfTheZionBlockc: { cs: `a v každém bloku ZION blockchainu pojmenovaném po tomto přechodu.`, en: `and in every block of the ZION blockchain named after this transition.` },
  bothBooksAreOneBook: { cs: `Obě knihy jsou jednou knihou.`, en: `Both books are one book.` },
  oneSpeaksAboutTheWorldTheOther: { cs: `Jedna mluví o světě. Druhá mluví o člověku, který ho tvoří.`, en: `One speaks about the world. The other speaks about the human who creates it.` },
  withoutBothFieldsNoMapIsSuffic: { cs: `Bez obou polí žádná mapa nestačí.`, en: `Without both fields, no map is sufficient.` },
  ekamOneHereNowYou: { cs: `Ekam. Jedno. Tady. Teď. Ty.`, en: `Ekam. One. Here. Now. You.` },
  exploreFurther: { cs: `Prozkoumej dál`, en: `Explore further` },
  ekamVirtualTour: { cs: `Ekam — virtuální prohlídka`, en: `Ekam — Virtual Tour` },
  zionRoadmap: { cs: `Roadmap ZION`, en: `ZION Roadmap` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
};

export default function EkamDeekshaPage() {
  const { lang } = useLang();
  const [activeChapter, setActiveChapter] = useState('predmluva');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const chapters = useMemo(() => [
    { id: 'predmluva',  number: '',   title: EkamDeekshaCopy.preface[lang === 'cs' ? 'cs' : 'en'],               subtitle: EkamDeekshaCopy.secondBreathOfTheQuantumRevolu[lang === 'cs' ? 'cs' : 'en'] },
    { id: 'kapitel-1', number: '1',  title: EkamDeekshaCopy.theEndOfTheSeparateHuman[lang === 'cs' ? 'cs' : 'en'], subtitle: EkamDeekshaCopy.crisisOfTheSeparateSelf[lang === 'cs' ? 'cs' : 'en'] },
    { id: 'kapitel-2', number: '2',  title: EkamDeekshaCopy.whyOldMapsAreNotEnough[lang === 'cs' ? 'cs' : 'en'],  subtitle: EkamDeekshaCopy.fourLimitsOfModernSeeking[lang === 'cs' ? 'cs' : 'en'] },
    { id: 'kapitel-3', number: '3',  title: EkamDeekshaCopy.historicalLineage[lang === 'cs' ? 'cs' : 'en'],         subtitle: 'Jeevashram · Satyaloka · Oneness' },
    { id: 'kapitel-4', number: '4',  title: 'Amma a Bhagavan',          subtitle: EkamDeekshaCopy.dualUnityPrincipleOfLoveAndIns[lang === 'cs' ? 'cs' : 'en'] },
    { id: 'kapitel-5', number: '5',  title: 'Deeksha',                  subtitle: EkamDeekshaCopy.transmissionAsConsciousnessTec[lang === 'cs' ? 'cs' : 'en'] },
    { id: 'kapitel-6', number: '6',  title: 'Ekam a Golden Orb',        subtitle: EkamDeekshaCopy.templeAndGoldenCenter[lang === 'cs' ? 'cs' : 'en'] },
    { id: 'kapitel-7', number: '7',  title: 'Hiranyagarbha',            subtitle: EkamDeekshaCopy.goldenSeedCosmologyOfCreation[lang === 'cs' ? 'cs' : 'en'] },
    { id: 'kapitel-8', number: '8',  title: 'Ekam Deeksha PoW',         subtitle: EkamDeekshaCopy.algorithmAsGoldenSeedCosmicHar[lang === 'cs' ? 'cs' : 'en'] },
    { id: 'kapitel-9', number: '9',  title: EkamDeekshaCopy.algorithmOfTheGoldenAge[lang === 'cs' ? 'cs' : 'en'],  subtitle: EkamDeekshaCopy.tenStepsFromSeparationToUnity[lang === 'cs' ? 'cs' : 'en'] },
    { id: 'zaver',     number: '',   title: EkamDeekshaCopy.conclusion[lang === 'cs' ? 'cs' : 'en'],                    subtitle: EkamDeekshaCopy.whenTheGoldenAgeBegins[lang === 'cs' ? 'cs' : 'en'] },
  ], [lang]);

  const algoSteps = [
    { id: 0, name: 'Hiranyagarbha', color: 'text-amber-300',   border: 'border-amber-300/40',   bg: 'bg-amber-300/10',   desc: EkamDeekshaCopy.initializationOfTheGoldenSeedB[lang === 'cs' ? 'cs' : 'en'] },
    { id: 1, name: 'Brahma',        color: 'text-violet-300',  border: 'border-violet-300/40',  bg: 'bg-violet-300/10',  desc: EkamDeekshaCopy.expansionOfCreationReadingFrom[lang === 'cs' ? 'cs' : 'en'] },
    { id: 2, name: 'Yantra',        color: 'text-sky-300',     border: 'border-sky-300/40',     bg: 'bg-sky-300/10',     desc: EkamDeekshaCopy.k4Passes256RandomReadsGeometryO[lang === 'cs' ? 'cs' : 'en'] },
    { id: 3, name: 'Karma',         color: 'text-emerald-300', border: 'border-emerald-300/40', bg: 'bg-emerald-300/10', desc: EkamDeekshaCopy.lawOfCauseEpochNpuWeightsRotat[lang === 'cs' ? 'cs' : 'en'] },
    { id: 4, name: 'Chit',          color: 'text-rose-300',    border: 'border-rose-300/40',    bg: 'bg-rose-300/10',    desc: EkamDeekshaCopy.pureConsciousnessFinalMixOfWei[lang === 'cs' ? 'cs' : 'en'] },
    { id: 5, name: 'Samadhi',       color: 'text-amber-200',   border: 'border-amber-200/40',   bg: 'bg-amber-200/10',   desc: EkamDeekshaCopy.unification32ByteResultCompare[lang === 'cs' ? 'cs' : 'en'] },
  ];

  const algoTiers = [
    { tier: 'Tier 1', title: '256 KiB Scratchpad', desc: EkamDeekshaCopy.memoryBoundWorkEveryScannerPas[lang === 'cs' ? 'cs' : 'en'] },
    { tier: 'Tier 2', title: EkamDeekshaCopy.epochNpuWeights[lang === 'cs' ? 'cs' : 'en'],     desc: EkamDeekshaCopy.every2016BlocksOr100BlocksInTe[lang === 'cs' ? 'cs' : 'en'] },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveChapter(entry.target.id);
        });
      },
      { rootMargin: '-100px 0px -70% 0px' }
    );
    chapters.forEach((ch) => {
      const el = document.getElementById(ch.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [chapters]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden border-b border-white/10 bg-linear-to-b from-amber-900/10 via-transparent to-transparent">
        <div className="zion-container py-20 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="zion-badge-gold mb-6">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{EkamDeekshaCopy.continuesTheQuantumRevolution[lang === 'cs' ? 'cs' : 'en']}</span>
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold mb-6 text-gradient">
              Ekam Deeksha
            </h1>
            <p className="text-xl text-gray-400 mb-4">
              {EkamDeekshaCopy.algorithmOfUnityPhilosophyCosm[lang === 'cs' ? 'cs' : 'en']}
            </p>
            <p className="text-base text-gray-500 max-w-2xl mx-auto leading-relaxed">
              {EkamDeekshaCopy.theSecondBookAfterTheQuantumRe[lang === 'cs' ? 'cs' : 'en']}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link href="/ekam" className="zion-button-primary">
                {EkamDeekshaCopy.exploreEkam[lang === 'cs' ? 'cs' : 'en']}
              </Link>
              <Link href="/genesis" className="zion-button-secondary">
                ZION Genesis Book
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="zion-container py-12">

        {/* Mobile nav toggle */}
        <div className="lg:hidden mb-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 zion-section text-white hover:border-amber-300/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Book className="w-5 h-5 text-amber-300" />
              <span className="font-semibold">{EkamDeekshaCopy.chapters[lang === 'cs' ? 'cs' : 'en']}</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {mobileMenuOpen && (
            <div className="mt-4 zion-section p-4 space-y-1">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => { scrollTo(ch.id); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                    activeChapter === ch.id
                      ? 'bg-amber-300/10 text-amber-200 border-l-2 border-amber-300'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {ch.number && <span className="text-xs opacity-60">{EkamDeekshaCopy.ch[lang === 'cs' ? 'cs' : 'en']}{ch.number}: </span>}
                  {ch.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-8">

          {/* Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 zion-section p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Book className="w-3.5 h-3.5" />
                {EkamDeekshaCopy.chapters[lang === 'cs' ? 'cs' : 'en']}
              </h3>
              <nav className="space-y-1">
                {chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => scrollTo(ch.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm leading-snug ${
                      activeChapter === ch.id
                        ? 'bg-amber-300/10 text-amber-200 border-l-2 border-amber-300'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {ch.number && <span className="text-xs opacity-50 block">{EkamDeekshaCopy.ch[lang === 'cs' ? 'cs' : 'en']}{ch.number}</span>}
                    {ch.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* ══ CONTENT ══ */}
          <div className="flex-1 max-w-3xl">

            {/* PŘEDMLUVA */}
            <section id="predmluva" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-amber-300 mb-3">{EkamDeekshaCopy.preface[lang === 'cs' ? 'cs' : 'en']}</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.secondBreathOfTheQuantumRevolu[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-6 text-center">
                <p className="text-xl leading-relaxed text-gray-300">
                  {EkamDeekshaCopy.theQuantumRevolutionNamedTheCi[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.itShowedThatTheOldWorldDoesNot[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.butBecauseItHasReachedTheLimit[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p className="text-base leading-8 text-gray-400">
                  {EkamDeekshaCopy.thisBookFollowsThatMapButItDoe[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.itTurnsTheGaze[lang === 'cs' ? 'cs' : 'en'] }<strong className="text-amber-300">{EkamDeekshaCopy.inward[lang === 'cs' ? 'cs' : 'en']}</strong>.
                </p>
                <p className="text-base leading-8 text-gray-400">
                  {EkamDeekshaCopy.itAsksMorePreciselyWhatMustHap[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.betterSystemsAreNotEnoughAQuan[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.whatIsNeededIsTheEndOfOneStruc[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="my-10 p-8 zion-rainbow-sub" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <p className="text-lg italic text-gray-300 leading-relaxed">
                    {EkamDeekshaCopy.ekamMeansOne[lang === 'cs' ? 'cs' : 'en']}<br />
                    {EkamDeekshaCopy.deekshaMeansTransmissionInitia[lang === 'cs' ? 'cs' : 'en']}<br />
                    {EkamDeekshaCopy.thisBookIsAboutHowThisOnenessI[lang === 'cs' ? 'cs' : 'en']}<br />
                    {EkamDeekshaCopy.spacePhilosophyAndInBlockchain[lang === 'cs' ? 'cs' : 'en']}
                  </p>
                </div>
                <p className="text-gray-400 text-sm leading-7">
                  {EkamDeekshaCopy.behindThisBookStandsTheLineage[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.behindThisLineageStandAmmaAndB[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.andBehindAllOfThisStandsTheOld[lang === 'cs' ? 'cs' : 'en']}<br />
                  <strong className="text-amber-300">Hiranyagarbha</strong> — {EkamDeekshaCopy.theGoldenSeedFromWhichTheUnive[lang === 'cs' ? 'cs' : 'en']}
                </p>
              </div>
            </section>

            {/* KAP 1 */}
            <section id="kapitel-1" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">{EkamDeekshaCopy.chapter1[lang === 'cs' ? 'cs' : 'en']}</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">{EkamDeekshaCopy.theEndOfTheSeparateHuman[lang === 'cs' ? 'cs' : 'en']}</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.crisisOfTheSeparateSelf[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  {EkamDeekshaCopy.thereAreEpochsWhenCivilization[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p>
                  {EkamDeekshaCopy.theFundamentalProblemIsNotMora[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p>
                  {EkamDeekshaCopy.thatIsWhyThereIsSoMuchTechnolo[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="zion-rainbow-sub p-6 my-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <p className="text-amber-200 font-semibold mb-2 flex items-center gap-2"><Layers className="w-4 h-4 text-amber-300" /> {EkamDeekshaCopy.coreThesis[lang === 'cs' ? 'cs' : 'en']}</p>
                  <p className="text-gray-300 text-sm leading-7">
                    {EkamDeekshaCopy.sufferingDoesNotAriseBecauseTh[lang === 'cs' ? 'cs' : 'en']}
                  </p>
                </div>
                <p>
                  {EkamDeekshaCopy.thisIsThePowerOfTheLineageOfAm[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p>
                  {EkamDeekshaCopy.thereforeEkamDeekshaIsNotABook[lang === 'cs' ? 'cs' : 'en']}
                </p>
              </div>
            </section>

            {/* KAP 2 */}
            <section id="kapitel-2" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">{EkamDeekshaCopy.chapter2[lang === 'cs' ? 'cs' : 'en']}</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">{EkamDeekshaCopy.whyOldMapsAreNotEnough[lang === 'cs' ? 'cs' : 'en']}</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.fourLimitsOfModernSeeking[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  {EkamDeekshaCopy.itIsNoLongerEnoughToKnowWhatIs[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="grid sm:grid-cols-2 gap-4 my-6">
                  {([
                    { n: '01', title: EkamDeekshaCopy.limitOfRationality[lang === 'cs' ? 'cs' : 'en'],       body: EkamDeekshaCopy.reasonCanAnalyzeTheContentOfCo[lang === 'cs' ? 'cs' : 'en'], Icon: Atom },
                    { n: '02', title: EkamDeekshaCopy.motivationalSpirituality[lang === 'cs' ? 'cs' : 'en'],  body: EkamDeekshaCopy.theSeparateSelfCanVeryQuicklyL[lang === 'cs' ? 'cs' : 'en'], Icon: Sparkles },
                    { n: '03', title: EkamDeekshaCopy.dreamOfTechnicalSalvation[lang === 'cs' ? 'cs' : 'en'],   body: EkamDeekshaCopy.technologyWithoutConsciousness[lang === 'cs' ? 'cs' : 'en'], Icon: Cpu },
                    { n: '04', title: EkamDeekshaCopy.selfInterpretation[lang === 'cs' ? 'cs' : 'en'],       body: EkamDeekshaCopy.understandingAMechanismDoesNot[lang === 'cs' ? 'cs' : 'en'], Icon: Layers },
                  ] as const).map(({ n, title, body, Icon }) => (
                    <div key={n} className="zion-rainbow-sub p-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold text-gray-500">{n}</span>
                        <Icon className="w-4 h-4 text-amber-300" />
                        <h3 className="text-base font-semibold text-white">{title}</h3>
                      </div>
                      <p className="text-sm leading-7 text-gray-400">{body}</p>
                    </div>
                  ))}
                </div>
                <p>
                  {EkamDeekshaCopy.thisIsWhereTheSignificanceOfTh[lang === 'cs' ? 'cs' : 'en']}
                </p>
              </div>
            </section>

            {/* KAP 3 */}
            <section id="kapitel-3" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">{EkamDeekshaCopy.chapter3[lang === 'cs' ? 'cs' : 'en']}</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">{EkamDeekshaCopy.historicalLineage[lang === 'cs' ? 'cs' : 'en']}</h2>
                <p className="text-gray-400 text-lg italic">Jeevashram · Satyaloka · Oneness University</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  {EkamDeekshaCopy.whatLaterRevealedItselfToTheWo[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="space-y-4 my-6">
                  {([
                    { name: 'Jeevashram',        era: EkamDeekshaCopy.beginning[lang === 'cs' ? 'cs' : 'en'],        text: EkamDeekshaCopy.pedagogicalAndFormativeImpulse[lang === 'cs' ? 'cs' : 'en'] },
                    { name: 'Satyaloka',          era: EkamDeekshaCopy.secondPhase[lang === 'cs' ? 'cs' : 'en'],     text: EkamDeekshaCopy.shiftFromInstitutionToStateThe[lang === 'cs' ? 'cs' : 'en'] },
                    { name: 'Oneness University', era: EkamDeekshaCopy.globalization[lang === 'cs' ? 'cs' : 'en'],    text: EkamDeekshaCopy.theLocalExperimentTransformsIn[lang === 'cs' ? 'cs' : 'en'] },
                    { name: 'Ekam',               era: EkamDeekshaCopy.livingFieldToday[lang === 'cs' ? 'cs' : 'en'], text: EkamDeekshaCopy.behindTodaySSymbolismOfTheTemp[lang === 'cs' ? 'cs' : 'en'] },
                  ] as const).map(({ name, era, text }) => (
                    <div key={name} className="flex gap-4 zion-rainbow-sub p-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                      <div className="shrink-0 mt-3">
                        <div className="w-2 h-2 rounded-full bg-amber-300" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{era}</p>
                        <h3 className="text-lg font-semibold text-amber-200 mb-1">{name}</h3>
                        <p className="text-sm leading-7 text-gray-400">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p>
                  {EkamDeekshaCopy.thisHistoricalTrajectoryAllows[lang === 'cs' ? 'cs' : 'en']}
                </p>
              </div>
            </section>

            {/* KAP 4 */}
            <section id="kapitel-4" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">{EkamDeekshaCopy.chapter4[lang === 'cs' ? 'cs' : 'en']}</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Amma a Bhagavan</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.dualUnityPrincipleOfLoveAndIns[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  {EkamDeekshaCopy.ammaAndBhagavanAreNotMerelyFou[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="grid sm:grid-cols-2 gap-4 my-6">
                  <div className="zion-rainbow-sub p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                    <Heart className="w-6 h-6 text-amber-300 mb-3" />
                    <h3 className="text-xl font-bold text-white mb-2">{EkamDeekshaCopy.ammaPrincipleOfLove[lang === 'cs' ? 'cs' : 'en']}</h3>
                    <p className="text-sm leading-7 text-gray-300">
                      {EkamDeekshaCopy.ammaEmbodiesUnconditionalAccep[lang === 'cs' ? 'cs' : 'en']}
                    </p>
                  </div>
                  <div className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <Sun className="w-6 h-6 text-amber-300 mb-3" />
                    <h3 className="text-xl font-bold text-white mb-2">{EkamDeekshaCopy.bhagavanPrincipleOfInsight[lang === 'cs' ? 'cs' : 'en']}</h3>
                    <p className="text-sm leading-7 text-gray-300">
                      {EkamDeekshaCopy.bhagavanSriKalkiRepresentsPene[lang === 'cs' ? 'cs' : 'en']}
                    </p>
                  </div>
                </div>
                <p>
                  {EkamDeekshaCopy.forManyFollowersAmmaAndBhagava[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p>
                  {EkamDeekshaCopy.theTransmissionOfTheLineageToS[lang === 'cs' ? 'cs' : 'en']}
                </p>
              </div>
            </section>

            {/* KAP 5 */}
            <section id="kapitel-5" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">{EkamDeekshaCopy.chapter5[lang === 'cs' ? 'cs' : 'en']}</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Deeksha</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.transmissionAsConsciousnessTec[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  {EkamDeekshaCopy.deekshaASanskritWordForInitiat[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p>
                  {EkamDeekshaCopy.inThePracticeOfOnenessAndEkamD[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="zion-rainbow-sub p-6 my-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <p className="text-amber-200 font-semibold mb-3">{EkamDeekshaCopy.whatDeekshaClaimsToDo[lang === 'cs' ? 'cs' : 'en']}</p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {[
                      EkamDeekshaCopy.quietsTheConstantMentalNoiseOf[lang === 'cs' ? 'cs' : 'en'],
                      EkamDeekshaCopy.opensSpaceForDirectExperienceO[lang === 'cs' ? 'cs' : 'en'],
                      EkamDeekshaCopy.releasesEmotionalKnotsBoundToS[lang === 'cs' ? 'cs' : 'en'],
                      EkamDeekshaCopy.facilitatesTheTransitionFromId[lang === 'cs' ? 'cs' : 'en'],
                      EkamDeekshaCopy.doesNotCreateANewSpiritualPerf[lang === 'cs' ? 'cs' : 'en'],
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <p>
                  {EkamDeekshaCopy.directExperienceHoldsAnIrrepla[lang === 'cs' ? 'cs' : 'en']}
                </p>
              </div>
            </section>

            {/* KAP 6 */}
            <section id="kapitel-6" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">{EkamDeekshaCopy.chapter6[lang === 'cs' ? 'cs' : 'en']}</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Ekam a Golden Orb</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.templeAndGoldenCenter[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  {EkamDeekshaCopy.theEkamTempleInAndhraPradeshIs[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="text-center py-6">
                  <p className="text-2xl text-amber-300 font-bold mb-3">{EkamDeekshaCopy.theGoldenSeedOfConsciousnessIs[lang === 'cs' ? 'cs' : 'en']}</p>
                  <p className="text-gray-400">{EkamDeekshaCopy.theGoldenAgeIsNotAFutureThatWi[lang === 'cs' ? 'cs' : 'en']}<br />{EkamDeekshaCopy.itIsAStateOfConsciousnessThatM[lang === 'cs' ? 'cs' : 'en']}</p>
                </div>
                <p>
                  {EkamDeekshaCopy.goldenOrbTheGoldenSphereInTheC[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="zion-rainbow-sub p-6 my-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{EkamDeekshaCopy.ekamAsPlanetaryField[lang === 'cs' ? 'cs' : 'en']}</p>
                  <p className="text-sm leading-7 text-gray-300">
                    {EkamDeekshaCopy.thePhysicalTempleIsOneNodeEkam[lang === 'cs' ? 'cs' : 'en']}
                  </p>
                </div>
              </div>
            </section>

            {/* KAP 7 */}
            <section id="kapitel-7" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">{EkamDeekshaCopy.chapter7[lang === 'cs' ? 'cs' : 'en']}</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Hiranyagarbha</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.goldenSeedCosmologyOfCreation[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  {EkamDeekshaCopy.hiranyagarbhaGoldenWombGoldenE[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="zion-rainbow-sub p-6 my-6 text-center" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <Orbit className="w-8 h-8 text-amber-300 mx-auto mb-3" />
                  <p className="text-amber-200 italic text-lg">
                    {EkamDeekshaCopy.inTheBeginningWasTheGoldenEggT[lang === 'cs' ? 'cs' : 'en']}<br />
                    {EkamDeekshaCopy.fromItWasBornTheWholeWorldHeav[lang === 'cs' ? 'cs' : 'en']}
                  </p>
                  <p className="text-gray-500 text-sm mt-2">{EkamDeekshaCopy.rigvedaHymnToHiranyagarbha[lang === 'cs' ? 'cs' : 'en']}</p>
                </div>
                <p>
                  {EkamDeekshaCopy.inTheContextOfTheEkamLineageHi[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="grid sm:grid-cols-3 gap-4 my-4">
                  {([
                    { dim: EkamDeekshaCopy.vedicCosmology[lang === 'cs' ? 'cs' : 'en'], t: EkamDeekshaCopy.theGoldenEggFloatsInPrimordial[lang === 'cs' ? 'cs' : 'en'] },
                    { dim: EkamDeekshaCopy.ekamLineage[lang === 'cs' ? 'cs' : 'en'],        t: EkamDeekshaCopy.goldenOrbAsTheCenterOfTheTempl[lang === 'cs' ? 'cs' : 'en'] },
                    { dim: EkamDeekshaCopy.zionPow[lang === 'cs' ? 'cs' : 'en'],          t: EkamDeekshaCopy.ekamDeekshaHashPipelineBeginsW[lang === 'cs' ? 'cs' : 'en'] },
                  ] as const).map(({ dim, t }) => (
                    <div key={dim} className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                      <p className="text-xs text-amber-300 font-semibold uppercase tracking-wider mb-2">{dim}</p>
                      <p className="text-sm text-gray-400 leading-6">{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* KAP 8 */}
            <section id="kapitel-8" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">{EkamDeekshaCopy.chapter8[lang === 'cs' ? 'cs' : 'en']}</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Ekam Deeksha PoW</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.algorithmAsGoldenSeedCosmicHar[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  {EkamDeekshaCopy.zionTerranovaBearsTheNameEkamD[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p>
                  {EkamDeekshaCopy.everyBlockThatAMinerMinesPasse[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="my-6 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{EkamDeekshaCopy.k6StageEkamDeekshaPipeline[lang === 'cs' ? 'cs' : 'en']}</p>
                  {algoSteps.map((step, i) => (
                    <div key={step.id} className="zion-rainbow-sub p-4 flex gap-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-amber-300/40 text-xs font-bold text-amber-300">
                        {i}
                      </div>
                      <div>
                        <p className="font-bold text-base text-amber-300 mb-1">{step.name}</p>
                        <p className="text-sm text-gray-400 leading-6">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-base font-semibold text-white mt-6 mb-3">{EkamDeekshaCopy.asicResistanceTwoLayerProtecti[lang === 'cs' ? 'cs' : 'en']}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {algoTiers.map(({ tier, title, desc }) => (
                    <div key={tier} className="zion-rainbow-sub p-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                      <p className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">{tier}</p>
                      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                      <p className="text-sm text-gray-400 leading-6">{desc}</p>
                    </div>
                  ))}
                </div>
                <div className="zion-rainbow-sub p-6 mt-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <Atom className="w-6 h-6 text-amber-300 mb-3" />
                  <p className="text-amber-200 font-semibold mb-2">{EkamDeekshaCopy.whyThisNamingIsNotJustDecorati[lang === 'cs' ? 'cs' : 'en']}</p>
                  <p className="text-sm leading-7 text-gray-300">
                    {EkamDeekshaCopy.hiranyagarbhaInitializesTheSee[lang === 'cs' ? 'cs' : 'en']}
                  </p>
                  <p className="text-sm leading-7 text-gray-300 mt-3">
                    {EkamDeekshaCopy.thusTheBlockchainCarriesThePhi[lang === 'cs' ? 'cs' : 'en']}
                  </p>
                </div>
              </div>
            </section>

            {/* KAP 9 */}
            <section id="kapitel-9" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">{EkamDeekshaCopy.chapter9[lang === 'cs' ? 'cs' : 'en']}</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">{EkamDeekshaCopy.algorithmOfTheGoldenAge[lang === 'cs' ? 'cs' : 'en']}</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.tenStepsFromSeparationToUnity[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  {EkamDeekshaCopy.theGoldenAgeIsNotAUtopiaNotAnA[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="space-y-3 my-6">
                  {([
                    { n: 1,  step: EkamDeekshaCopy.stoppingTheNoise[lang === 'cs' ? 'cs' : 'en'],          desc: EkamDeekshaCopy.consciousPauseInterruptionOfTh[lang === 'cs' ? 'cs' : 'en'] },
                    { n: 2,  step: EkamDeekshaCopy.recognizingSeparation[lang === 'cs' ? 'cs' : 'en'],       desc: EkamDeekshaCopy.toSeeWhenWeActFromSeparationFr[lang === 'cs' ? 'cs' : 'en'] },
                    { n: 3,  step: EkamDeekshaCopy.openingTheHeart[lang === 'cs' ? 'cs' : 'en'],            desc: EkamDeekshaCopy.movementFromTheHeadAsTheOnlyCe[lang === 'cs' ? 'cs' : 'en'] },
                    { n: 4,  step: EkamDeekshaCopy.activatingSensitivity[lang === 'cs' ? 'cs' : 'en'],       desc: EkamDeekshaCopy.theAbilityToBeTrulyPresentWith[lang === 'cs' ? 'cs' : 'en'] },
                    { n: 5,  step: EkamDeekshaCopy.transmissionAndDeeksha[lang === 'cs' ? 'cs' : 'en'],          desc: EkamDeekshaCopy.breakingTheIsolationOfSelfInte[lang === 'cs' ? 'cs' : 'en'] },
                    { n: 6,  step: EkamDeekshaCopy.stabilization[lang === 'cs' ? 'cs' : 'en'],               desc: EkamDeekshaCopy.integrationOfTheNewStateIntoEv[lang === 'cs' ? 'cs' : 'en'] },
                    { n: 7,  step: EkamDeekshaCopy.service[lang === 'cs' ? 'cs' : 'en'],                    desc: EkamDeekshaCopy.turnFromSelfCenterednessToCare[lang === 'cs' ? 'cs' : 'en'] },
                    { n: 8,  step: EkamDeekshaCopy.creatingLocalFields[lang === 'cs' ? 'cs' : 'en'],  desc: EkamDeekshaCopy.creatingSpacesAndCommunitiesWh[lang === 'cs' ? 'cs' : 'en'] },
                    { n: 9,  step: EkamDeekshaCopy.networking[lang === 'cs' ? 'cs' : 'en'],                  desc: EkamDeekshaCopy.connectingLocalFieldsIntoAMutu[lang === 'cs' ? 'cs' : 'en'] },
                    { n: 10, step: EkamDeekshaCopy.civilizationalManifestation[lang === 'cs' ? 'cs' : 'en'],   desc: EkamDeekshaCopy.newEducationNewEconomyNewPolit[lang === 'cs' ? 'cs' : 'en'] },
                  ] as const).map(({ n, step, desc }) => (
                    <div key={n} className="flex gap-4 zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-amber-300/10 border border-amber-300/30 text-amber-300 text-xs font-bold">
                        {n}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm mb-1">{step}</p>
                        <p className="text-xs leading-6 text-gray-400">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p>
                  {EkamDeekshaCopy.thisAlgorithmIsNotLinearInTheS[lang === 'cs' ? 'cs' : 'en']}
                </p>
              </div>
            </section>

            {/* ZÁVĚR */}
            <section id="zaver" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-amber-300 mb-3">{EkamDeekshaCopy.conclusion[lang === 'cs' ? 'cs' : 'en']}</h2>
                <p className="text-gray-400 text-lg italic">{EkamDeekshaCopy.whenTheGoldenAgeBegins[lang === 'cs' ? 'cs' : 'en']}</p>
              </div>
              <div className="space-y-6 text-center">
                <p className="text-xl leading-relaxed text-gray-300">
                  {EkamDeekshaCopy.theGoldenAgeDoesNotBeginWhenTh[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.itDoesNotBeginWhenASufficientl[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.itDoesNotEvenBeginWhenTechnolo[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p className="text-base leading-8 text-gray-400">
                  {EkamDeekshaCopy.theGoldenAgeAlwaysBeginsWhenOn[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.ceasesToExperienceThemselvesAs[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.andThisIsPreciselyWhatTheEkamD[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.fromTheFirstDaysOfJeevashramTo[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="my-10 p-8 zion-rainbow-sub" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <Globe className="w-8 h-8 text-amber-300 mx-auto mb-4" />
                  <p className="text-lg italic text-gray-300 leading-relaxed">
                    {EkamDeekshaCopy.theQuantumRevolutionShowedThat[lang === 'cs' ? 'cs' : 'en']}<br /><br />
                    {EkamDeekshaCopy.ekamDeekshaShowsWhatThisInnerT[lang === 'cs' ? 'cs' : 'en']}<br />
                    {EkamDeekshaCopy.inHistoryInPhilosophyInTheSpac[lang === 'cs' ? 'cs' : 'en']}<br />
                    {EkamDeekshaCopy.inTheGoldenSeedOfHiranyagarbha[lang === 'cs' ? 'cs' : 'en']}<br />
                    {EkamDeekshaCopy.andInEveryBlockOfTheZionBlockc[lang === 'cs' ? 'cs' : 'en']}
                  </p>
                </div>
                <p className="text-gray-400 text-sm">
                  {EkamDeekshaCopy.bothBooksAreOneBook[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.oneSpeaksAboutTheWorldTheOther[lang === 'cs' ? 'cs' : 'en']}<br />
                  {EkamDeekshaCopy.withoutBothFieldsNoMapIsSuffic[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p className="text-center text-amber-300 font-semibold text-2xl mt-10">
                  {EkamDeekshaCopy.ekamOneHereNowYou[lang === 'cs' ? 'cs' : 'en']}
                </p>
              </div>
            </section>

            {/* CTA */}
            <div className="zion-cta-banner mb-20">
              <p className="text-gray-300 text-sm mb-4">{EkamDeekshaCopy.exploreFurther[lang === 'cs' ? 'cs' : 'en']}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/ekam" className="zion-button-primary">
                  {EkamDeekshaCopy.ekamVirtualTour[lang === 'cs' ? 'cs' : 'en']}
                </Link>
                <Link href="/roadmap" className="zion-button-secondary">
                  {EkamDeekshaCopy.zionRoadmap[lang === 'cs' ? 'cs' : 'en']}
                </Link>
                <Link href="/docs" className="zion-button-secondary">
                  {EkamDeekshaCopy.documentation[lang === 'cs' ? 'cs' : 'en']}
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
