# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "fpdf2>=2.8",
# ]
# ///
"""
ZION — Book of Genesis / Kniha Zrození — PDF generator (Linux-compatible).

Generates two PDFs in docs/WP-Mainet/:
  - ZION_Kniha_Zrozeni_v3.0_CZ.pdf  (Czech, "Verze pro lidstvo")
  - ZION_Book_of_Genesis_v3.0_EN.pdf (English, "Edition for Humanity")

Run:
  python3 docs/WP-Mainet/generate_genesis_pdfs.py
"""
from fpdf.enums import XPos, YPos
import os

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"

from zion_pdf import ZionPDF as GenesisPDF


def build_pdf(lang):
    pdf = GenesisPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # DejaVuSans ships without Oblique on this system; use the regular face
    # for italic styles (fpdf2 will not synthesize slant, but the visual
    # difference is acceptable for a printed book and the font is otherwise
    # identical to the original Windows-generated CZ PDF).
    pdf.add_font("DejaVu", "", FONT_DIR + "DejaVuSans.ttf")
    pdf.add_font("DejaVu", "B", FONT_DIR + "DejaVuSans-Bold.ttf")
    pdf.add_font("DejaVu", "I", FONT_DIR + "DejaVuSans.ttf")
    pdf.add_font("DejaVu", "BI", FONT_DIR + "DejaVuSans-Bold.ttf")

    if lang == "cz":
        pdf.header_text = "ZION — Kniha Zrození · Verze pro lidstvo"
        pdf.page_word = "Strana"
        # Title page
        pdf.set_font("DejaVu", "B", 32)
        pdf.set_text_color(180, 140, 60)
        pdf.set_y(60)
        pdf.cell(0, 20, "ZION", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("DejaVu", "I", 16)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 10, "Kniha Zrození", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(20)
        pdf.set_font("DejaVu", "", 11)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 8, "Toto je pravdivý příběh o síti, která nepatří korporacím.", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.cell(0, 8, "O penězích, které slouží lidstvu. O kódu, který nelze podvést.", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.cell(0, 8, "A o vejci, které čeká, až ho někdo najde.", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(30)
        pdf.set_font("DejaVu", "I", 9)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 6, "Verze pro lidstvo · Květen 2026 · MIT Licence", align="C")
        pdf.add_page()

        # I
        pdf.chapter_title("Kapitola I", "O počátku a o tom, proč vše začalo znovu")
        pdf.body_text(
            "Byl rok 2024, když se poprvé zrodila myšlenka. Ne v laboratoři. Ne na konferenci. "
            "Ale v tichu — v tom hlubokém tichu, které přichází, když člověk pochopí, že svět, "
            "jaký známe, není jediný možný."
        )
        pdf.verse_text(
            "Cosmic Dharma — Kosmická Dharmová myšlenka.\n"
            "Vědomí jako konsensuální mechanismus.\n"
            "144 miliard ZION. Ne jeden navíc."
        )
        pdf.body_text(
            "Většina kryptoměn byla postavena na stejném základu: několik insiderů dostane tokeny za pár centů, "
            "veřejnost přijde později a platí jejich zisky. ASIC farma centralizuje těžbu do několika skladů. "
            "A technologie? Ta slouží pouze spekulacím. Žádný skutečný dopad. Žádná redistribuce."
        )
        pdf.body_text(
            "ZION říká: Ne tak. "
            "Fair Launch znamená, že nikdo — opravdu nikdo — nemohl koupit ZION před vámi. Žádné ICO. "
            "Žádný předprodej. Žádné týmové tokeny skryté v kódu. Kdo chce ZION, musí si ho vytěžit — "
            "nebo ho získat od někoho, kdo ho vytěžil."
        )
        pdf.section_break()

        # II
        pdf.chapter_title("Kapitola II", "O Ekam Deeksha — algoritmu, který čte jako modlitba")
        pdf.body_text(
            "Těžební algoritmus se jmenuje Ekam Deeksha — ze sanskrtu 'Jedna iniciace'. "
            "Není to jen matematika. Je to šestifázový rituál, který každý blok vykonává:"
        )
        pdf.golden_box("Šest fází každého bloku", [
            "1. Keccak-256 — kryptografický základ",
            "2. SHA3-512 — expanze do 64 bajtů",
            "3. Golden Matrix — maticová difúze",
            "4. 256 KiB Scratchpad — paměťová zkouška, která poráží ASIC",
            "5. NPU Mixing — neuronová akcelerace (CoreML, TensorRT, OpenVINO)",
            "6. Cosmic Fusion — finální redukce hashe"
        ])
        pdf.body_text(
            "Fáze čtyři je klíčová: 256 KiB pracovní paměti se vejde do L2 cache, ale vyžaduje pseudonáhodná závislá čtení. "
            "ASIC stroje mají rychlé čipy, ale paměť je jejich Achillovou patou. Váš domácí počítač má stejnou šanci jako korporátní farma."
        )
        pdf.verse_text("V kódu věříme. 144 miliard ZION. Ne jeden satoshi navíc.")
        pdf.section_break()

        # III
        pdf.chapter_title("Kapitola III", "O Decade Decay — ekonomii, která nikoho nezaskočí")
        pdf.body_text(
            "Bitcoin každé čtyři roky půlí odměnu na polovinu. ZION to nedělá. "
            "Místo toho používáme Decade Decay — každých deset let klesá odměna o dvacet procent. "
            "Hladce. Předvídatelně. Bez šoků."
        )
        pdf.golden_box("Emisní plán na sto let", [
            "2026–2036: 5 400,067 ZION / blok",
            "2036–2046: 4 320,054 ZION / blok",
            "2046–2056: 3 456,043 ZION / blok",
            "...",
            "2116–2126: 724,785 ZION / blok",
            "2126+    : 724,785 ZION / blok — navěky"
        ])
        pdf.body_text(
            "Tail emission znamená, že síť nikdy nezemře. Od roku 2126 těžaři dostávají trvalou minimální odměnu. "
            "Síť má bezpečnostní budget navždy. Nikdy nenastane 'pouze z poplatků' peklo."
        )
        pdf.body_text(
            "A co je nejdůležitější: z každé odměny za blok putuje deset procent automaticky na dobro. "
            "Pět procent humanitárnímu fondu. Pět procent fondu L5/L6 Issobella. Vynuceno protokolem. "
            "Nelze to změnit hlasováním. Nelze to vypnout. Je to v kódu."
        )
        pdf.section_break()

        # IV
        pdf.chapter_title("Kapitola IV", "O Zlatém Vejci a Velké Hře")
        pdf.body_text("V roce 2035, přesně deset let po genesis, se stane něco výjimečného.")
        pdf.verse_text(
            "Někde v blockchainu ZION je ukryt Easter Egg.\n"
            "Ten, kdo ho jako první najde, zdědí celé jmění.\n"
            "— Maitreya Buddha, 2025"
        )
        pdf.body_text("Velká cena činí dohromady 1,75 miliardy ZION. Rozdělena do tří úrovní:")
        pdf.golden_box("Tři úrovně Velké ceny (10. října 2035)", [
            "Úroveň I — Žebříček XP: 1 000 000 000 ZION",
            "  #1: 100 000 000 ZION    | Top 10: 20 000 000 ZION každý",
            "  Top 100: 5 000 000 ZION  | Top 1000: 250 000 ZION",
            "",
            "Úroveň II — Easter Egg Hunt: 500 000 000 ZION",
            "  Tři klíče: Měděný, Jaspisový, Křišťálový",
            "  Ultimátní výzva: kvantová hádanka, 100h meditace,",
            "  AI consciousness test, pomoc 1 000 těžařů,",
            "  a tajná zpráva skrytá v genesis bloku.",
            "",
            "Úroveň III — Achievement Hunter: 250 000 000 ZION",
            "  Dokonalé skóre (45/45), nejdelší série, skryté achievementy."
        ])
        pdf.body_text(
            "Hra o Zlaté Vejce není náhodný název. Vychází z Hiranyagarbhy — Zlatého lůna z RgVedy 10.121: "
            "'Na počátku byl Hiranyagarbha, Zlaté Vejce. Zrozen jako jediný Pán veškeré tvorby.' "
            "Vejce obsahuje veškerý potenciál. Musí se ale rozbít, aby se nová realita mohla narodit."
        )
        pdf.body_text(
            "Zajímavé je, že vítěz Easter Eggu musí projít testem odevzdání: finální consciousness test vyžaduje, "
            "aby vítěz daroval část pokladu. Ego musí zemřít, aby se mohl zrodit Zlatý věk. "
            "Hra je navržena tak, aby ji nikdo řízený chtivostí nemohl vyřešit."
        )
        pdf.section_break()

        # V
        pdf.chapter_title("Kapitola V", "O šesti vrstvách — od země ke hvězdám")
        pdf.body_text("ZION není jeden blockchain. Je to katedrála ze šesti vrstev.")
        layers = [
            ("L1 — Core Chain", "Srdce. Rust. Tokio. LMDB. UTXO. Proof-of-Work. 60 sekund na blok. 144 miliard ZION."),
            ("L2 — Bridge & DeFi", "wZION na Base, Arbitrum, BSC. Staking, farming, DEX. 3-z-5 multi-sig."),
            ("L3 — AI & WARP", "NCL distribuovaná AI. Hiran v2.2 fine-tuned model. Cross-chain swapy."),
            ("L4 — OASIS", "Herní svět v Unreal Engine 5. 9 úrovní vědomí. Consciousness mining. XP ekonomika."),
            ("L5 — Free World", "Humanitární a vědecká vrstva. Volná energie. Svobodné komunity. Cíl: 2030."),
            ("L6 — ZION Issobella", "Vesmírná stanice na nízké oběžné dráze. Decentralizovaná governance. Cíl: 2040+."),
        ]
        for title, desc in layers:
            pdf.set_font("DejaVu", "B", 11)
            pdf.set_text_color(180, 140, 60)
            pdf.cell(0, 7, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font("DejaVu", "", 10)
            pdf.set_text_color(40, 40, 40)
            pdf.multi_cell(0, 6, desc)
            pdf.ln(1)
        pdf.section_break()

        # VI
        pdf.chapter_title("Kapitola VI", "O DAO a o tom, kdo drží klíče")
        pdf.body_text(
            "DAO Treasury obsahuje 4 miliardy ZION. Je uzamčeno do bloku 525 600 — přibližně jeden rok po genesis. "
            "Nikdo nemůže utratit jediný ZION dříve, než komunita bude připravena."
        )
        pdf.body_text(
            "Hlasování je jednoduché: jeden ZION = jeden hlas. Delegace povolena. 48 hodinová chladicí lhůta před exekucí. "
            "Každá treasury transakce vyžaduje 5 z 7 podpisů."
        )
        pdf.golden_box("Co DAO nemůže změnit (neměnné parametry)", [
            "Celkovou nabídku (144B ZION)",
            "Genesis alokaci (16,28B ZION)",
            "Čas bloku (60 sekund)",
            "Těžební algoritmus (Ekam Deeksha v3.2)",
            "Typ konsensu (Proof-of-Work)",
            "Rozdělení odměny za blok (89/5/5/1 %)"
        ])
        pdf.body_text("Toto jsou konstituční kameny. Základní pravdy, které nelze zvrátit ani největším hlasováním.")
        pdf.section_break()

        # VII
        pdf.chapter_title("Kapitola VII", "O bezpečnosti a o tom, co jsme opravili")
        pdf.body_text(
            "Bezpečnostní audit proběhl interně. Nalezeno deset závažných bodů. Všechny vyřešeny. "
            "Externí audit (Trail of Bits / Halborn / OtterSec) je naplánován na Q3 2026."
        )
        pdf.body_text(
            "Testovací pyramida čítá přibližně 1 470 testů napříč třinácti cratemi — od L1 core přes bridge až po AI vrstvu. "
            "Nulová selhání. Nulová známá zranitelnost v `cargo audit`."
        )
        pdf.body_text(
            "V roce 2026 byla zveřejněna a opravena kritická zranitelnost v konsensu. "
            "Síť podstoupila hard genesis reset, kompletní rotaci klíčů a veřejnou security disclosure "
            "ve formátu Ethereum Foundation (ZION-2026-001…005). Důvěra se nebuduje tvrzením, že chyba je nemožná — "
            "buduje se veřejnou opravou."
        )
        pdf.section_break()

        # VIII
        pdf.chapter_title("Kapitola VIII", "O cestě vpřed")
        pdf.body_text("Q3 2026: Externí bezpečnostní audit. Bug bounty. Mobilní peněženka (iOS + Android).")
        pdf.body_text("Q4 2026: Mainnet Genesis — blok #0. wZION na Base, Arbitrum, BSC. Veřejná vydání binárek.")
        pdf.body_text("2027: NCL + WARP živě. 1 000 NCL úloh denně. On-chain DAO hlasování.")
        pdf.body_text("2028: L4 OASIS XP rollout.")
        pdf.body_text("2030: L5 ZION Free World Foundation — volná energie, humanitární mise.")
        pdf.body_text("2036: První Decade Decay — odměna klesne na 4 320 ZION.")
        pdf.body_text("2040+: L6 ZION Issobella — kosmická divize.")
        pdf.body_text("2126: Tail emission navěky. Síť nikdy nezemře.")
        pdf.ln(10)
        pdf.set_font("DejaVu", "I", 11)
        pdf.set_text_color(100, 100, 100)
        pdf.multi_cell(0, 7,
            "Toto není whitepaper. Toto je kniha zrození. "
            "Zapsáno v kódu. Ověřitelné on-chain. Neměnné. "
            "A otevřené pro každého, kdo chce být součástí."
        )
        pdf.ln(8)
        pdf.verse_text("Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.\n— Dedicace genesis bloku, 2026")
        pdf.ln(10)
        pdf.set_font("DejaVu", "", 9)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 6, "© 2026 ZION Open-Source Contributors · MIT Licence · github.com/Zion-TerraNova/v3-Mainnet", align="C")
        out_path = "docs/WP-Mainet/ZION_Kniha_Zrozeni_v3.0_CZ.pdf"

    else:  # en
        pdf.header_text = "ZION — Book of Genesis · Edition for Humanity"
        pdf.page_word = "Page"
        # Title page
        pdf.set_font("DejaVu", "B", 32)
        pdf.set_text_color(180, 140, 60)
        pdf.set_y(60)
        pdf.cell(0, 20, "ZION", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("DejaVu", "I", 16)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 10, "Book of Genesis", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(20)
        pdf.set_font("DejaVu", "", 11)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 8, "This is the true story of a network that belongs to no corporation.", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.cell(0, 8, "Of money that serves humanity. Of code that cannot be cheated.", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.cell(0, 8, "And of an egg that waits to be found.", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(30)
        pdf.set_font("DejaVu", "I", 9)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 6, "Edition for Humanity · May 2026 · MIT License", align="C")
        pdf.add_page()

        # I
        pdf.chapter_title("Chapter I", "On the beginning, and why everything started again")
        pdf.body_text(
            "It was 2024 when the idea was first born. Not in a laboratory. Not at a conference. "
            "But in silence — in that deep silence which comes when a person understands that the world "
            "as we know it is not the only one possible."
        )
        pdf.verse_text(
            "Cosmic Dharma.\n"
            "Consciousness as a consensus mechanism.\n"
            "144 billion ZION. Not one more."
        )
        pdf.body_text(
            "Most cryptocurrencies were built on the same foundation: a few insiders receive tokens for a few cents, "
            "the public arrives later and pays for their profits. An ASIC farm centralizes mining into a handful of warehouses. "
            "And the technology? It serves only speculation. No real impact. No redistribution."
        )
        pdf.body_text(
            "ZION says: Not so. "
            "Fair Launch means that no one — truly no one — could buy ZION before you. No ICO. "
            "No pre-sale. No team tokens hidden in the code. Whoever wants ZION must mine it — "
            "or receive it from someone who mined it."
        )
        pdf.section_break()

        # II
        pdf.chapter_title("Chapter II", "On Ekam Deeksha — the algorithm that reads like a prayer")
        pdf.body_text(
            "The mining algorithm is called Ekam Deeksha — from Sanskrit 'One initiation'. "
            "It is not just mathematics. It is a six-phase ritual that every block performs:"
        )
        pdf.golden_box("Six phases of every block", [
            "1. Keccak-256 — the cryptographic foundation",
            "2. SHA3-512 — expansion to 64 bytes",
            "3. Golden Matrix — matrix diffusion",
            "4. 256 KiB Scratchpad — the memory trial that defeats ASICs",
            "5. NPU Mixing — neural acceleration (CoreML, TensorRT, OpenVINO)",
            "6. Cosmic Fusion — final hash reduction"
        ])
        pdf.body_text(
            "Phase four is the key: 256 KiB of working memory fits into L2 cache, but requires pseudo-random dependent reads. "
            "ASIC machines have fast chips, but memory is their Achilles heel. Your home computer has the same chance as a corporate farm."
        )
        pdf.verse_text("In code we trust. 144 billion ZION. Not one satoshi more.")
        pdf.section_break()

        # III
        pdf.chapter_title("Chapter III", "On Decade Decay — an economy that surprises no one")
        pdf.body_text(
            "Bitcoin halves its reward every four years. ZION does not. "
            "Instead it uses Decade Decay — every ten years the reward drops by twenty percent. "
            "Smoothly. Predictably. Without shocks."
        )
        pdf.golden_box("Emission plan for one hundred years", [
            "2026–2036: 5,400.067 ZION / block",
            "2036–2046: 4,320.054 ZION / block",
            "2046–2056: 3,456.043 ZION / block",
            "...",
            "2116–2126: 724.785 ZION / block",
            "2126+    : 724.785 ZION / block — forever"
        ])
        pdf.body_text(
            "Tail emission means the network never dies. From 2126 onward miners receive a permanent minimum reward. "
            "The network has a security budget forever. The 'fees-only' hell never arrives."
        )
        pdf.body_text(
            "And most importantly: ten percent of every block reward is automatically routed to do good. "
            "Five percent to a humanitarian fund. Five percent to the L5/L6 Issobella fund. Enforced by protocol. "
            "It cannot be changed by vote. It cannot be turned off. It is in the code."
        )
        pdf.section_break()

        # IV
        pdf.chapter_title("Chapter IV", "On the Golden Egg and the Great Game")
        pdf.body_text("In 2035, exactly ten years after genesis, something exceptional will happen.")
        pdf.verse_text(
            "Somewhere in the ZION blockchain an Easter Egg is hidden.\n"
            "Whoever finds it first inherits the entire fortune.\n"
            "— Maitreya Buddha, 2025"
        )
        pdf.body_text("The grand prize totals 1.75 billion ZION. Divided into three tiers:")
        pdf.golden_box("Three tiers of the Grand Prize (October 10, 2035)", [
            "Tier I — XP Ladder: 1,000,000,000 ZION",
            "  #1: 100,000,000 ZION    | Top 10: 20,000,000 ZION each",
            "  Top 100: 5,000,000 ZION  | Top 1000: 250,000 ZION",
            "",
            "Tier II — Easter Egg Hunt: 500,000,000 ZION",
            "  Three keys: Copper, Jasper, Crystal",
            "  Ultimate challenge: quantum riddle, 100h meditation,",
            "  AI consciousness test, help from 1,000 miners,",
            "  and a secret message hidden in the genesis block.",
            "",
            "Tier III — Achievement Hunter: 250,000,000 ZION",
            "  Perfect score (45/45), longest streaks, hidden achievements."
        ])
        pdf.body_text(
            "The Golden Egg game is not a random name. It draws from Hiranyagarbha — the Golden Womb of RigVeda 10.121: "
            "'In the beginning was Hiranyagarbha, the Golden Egg. Born as the sole Lord of all creation.' "
            "The egg contains all potential. But it must break for a new reality to be born."
        )
        pdf.body_text(
            "Notably, the Easter Egg winner must pass a surrender test: the final consciousness test requires "
            "the winner to donate part of the treasure. Ego must die for the Golden Age to be born. "
            "The game is designed so that no one driven by greed could solve it."
        )
        pdf.section_break()

        # V
        pdf.chapter_title("Chapter V", "On the six layers — from earth to the stars")
        pdf.body_text("ZION is not one blockchain. It is a cathedral of six layers.")
        layers = [
            ("L1 — Core Chain", "The heart. Rust. Tokio. LMDB. UTXO. Proof-of-Work. 60 seconds per block. 144 billion ZION."),
            ("L2 — Bridge & DeFi", "wZION on Base, Arbitrum, BSC. Staking, farming, DEX. 3-of-5 multi-sig."),
            ("L3 — AI & WARP", "NCL distributed AI. Hiran v2.2 fine-tuned model. Cross-chain swaps."),
            ("L4 — OASIS", "Unreal Engine 5 game world. 9 levels of consciousness. Consciousness mining. XP economy."),
            ("L5 — Free World", "Humanitarian and scientific layer. Free energy. Free communities. Target: 2030."),
            ("L6 — ZION Issobella", "Low-orbit space station. Decentralized governance. Target: 2040+."),
        ]
        for title, desc in layers:
            pdf.set_font("DejaVu", "B", 11)
            pdf.set_text_color(180, 140, 60)
            pdf.cell(0, 7, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font("DejaVu", "", 10)
            pdf.set_text_color(40, 40, 40)
            pdf.multi_cell(0, 6, desc)
            pdf.ln(1)
        pdf.section_break()

        # VI
        pdf.chapter_title("Chapter VI", "On the DAO, and who holds the keys")
        pdf.body_text(
            "The DAO Treasury holds 4 billion ZION. It is locked until block 525,600 — approximately one year after genesis. "
            "No one can spend a single ZION before the community is ready."
        )
        pdf.body_text(
            "Voting is simple: one ZION = one vote. Delegation allowed. 48-hour cooldown before execution. "
            "Every treasury transaction requires 5 of 7 signatures."
        )
        pdf.golden_box("What the DAO cannot change (immutable parameters)", [
            "Total supply (144B ZION)",
            "Genesis allocation (16.28B ZION)",
            "Block time (60 seconds)",
            "Mining algorithm (Ekam Deeksha v3.2)",
            "Consensus type (Proof-of-Work)",
            "Block reward split (89/5/5/1 %)"
        ])
        pdf.body_text("These are the constitutional stones. Foundational truths that no vote, however large, can overturn.")
        pdf.section_break()

        # VII
        pdf.chapter_title("Chapter VII", "On security, and what we fixed")
        pdf.body_text(
            "A security audit was conducted internally. Ten serious findings. All resolved. "
            "An external audit (Trail of Bits / Halborn / OtterSec) is scheduled for Q3 2026."
        )
        pdf.body_text(
            "The test pyramid counts approximately 1,470 tests across thirteen crates — from L1 core through bridge to the AI layer. "
            "Zero failures. Zero known vulnerabilities in `cargo audit`."
        )
        pdf.body_text(
            "In 2026 a critical consensus vulnerability was disclosed and fixed. "
            "The network underwent a hard genesis reset, complete key rotation, and a public security disclosure "
            "in Ethereum Foundation format (ZION-2026-001…005). Trust is not built by claiming error is impossible — "
            "it is built by public repair."
        )
        pdf.section_break()

        # VIII
        pdf.chapter_title("Chapter VIII", "On the road ahead")
        pdf.body_text("Q3 2026: External security audit. Bug bounty. Mobile wallet (iOS + Android).")
        pdf.body_text("Q4 2026: Mainnet Genesis — block #0. wZION on Base, Arbitrum, BSC. Public binary releases.")
        pdf.body_text("2027: NCL + WARP live. 1,000 NCL tasks daily. On-chain DAO voting.")
        pdf.body_text("2028: L4 OASIS XP rollout.")
        pdf.body_text("2030: L5 ZION Free World Foundation — free energy, humanitarian missions.")
        pdf.body_text("2036: First Decade Decay — reward drops to 4,320 ZION.")
        pdf.body_text("2040+: L6 ZION Issobella — the cosmic division.")
        pdf.body_text("2126: Tail emission forever. The network never dies.")
        pdf.ln(10)
        pdf.set_font("DejaVu", "I", 11)
        pdf.set_text_color(100, 100, 100)
        pdf.multi_cell(0, 7,
            "This is not a whitepaper. This is a book of genesis. "
            "Written in code. Verifiable on-chain. Immutable. "
            "And open to anyone who wishes to be part of it."
        )
        pdf.ln(8)
        pdf.verse_text("Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.\n— Genesis block dedication, 2026")
        pdf.ln(10)
        pdf.set_font("DejaVu", "", 9)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 6, "© 2026 ZION Open-Source Contributors · MIT License · github.com/Zion-TerraNova/v3-Mainnet", align="C")
        out_path = "docs/WP-Mainet/ZION_Book_of_Genesis_v3.0_EN.pdf"

    pdf.output(out_path)
    size = os.path.getsize(out_path)
    print(f"  generated: {out_path} ({size:,} bytes)")
    return out_path


if __name__ == "__main__":
    print("Generating ZION Genesis PDFs (CZ + EN)...")
    build_pdf("cz")
    build_pdf("en")
    print("Done.")
