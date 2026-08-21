# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "fpdf2>=2.8",
# ]
# ///

from fpdf import FPDF
from fpdf.enums import XPos, YPos

class GenesisPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, "ZION — Kniha Zrození · Verze pro lidstvo", align="C")
        self.ln(5)
        self.set_draw_color(180, 140, 60)
        self.set_line_width(0.3)
        self.line(20, self.get_y(), 190, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Strana {self.page_no()}", align="C")

    def chapter_title(self, title, subtitle=None):
        self.set_font("DejaVu", "B", 18)
        self.set_text_color(180, 140, 60)
        self.cell(0, 12, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        if subtitle:
            self.set_font("DejaVu", "I", 11)
            self.set_text_color(100, 100, 100)
            self.cell(0, 8, subtitle, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(4)
        self.set_draw_color(180, 140, 60)
        self.set_line_width(0.5)
        self.line(20, self.get_y(), 80, self.get_y())
        self.ln(6)

    def body_text(self, text, bold=False):
        self.set_font("DejaVu", "B" if bold else "", 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def verse_text(self, text):
        self.set_font("DejaVu", "I", 10)
        self.set_text_color(80, 80, 80)
        self.set_left_margin(30)
        self.multi_cell(0, 6, text)
        self.set_left_margin(20)
        self.ln(3)

    def drop_cap(self, letter):
        # Draw large first letter
        self.set_font("DejaVu", "B", 28)
        self.set_text_color(180, 140, 60)
        self.cell(12, 12, letter)
        self.set_xy(32, self.get_y() - 12)

    def section_break(self):
        self.ln(8)
        self.set_draw_color(180, 140, 60)
        self.set_line_width(0.3)
        center = 105
        self.line(center - 15, self.get_y(), center + 15, self.get_y())
        self.ln(8)

    def golden_box(self, title, lines):
        self.set_fill_color(255, 250, 240)
        self.set_draw_color(180, 140, 60)
        self.set_line_width(0.5)
        start_y = self.get_y()
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(140, 100, 40)
        self.cell(0, 8, f"  {title}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("DejaVu", "", 10)
        self.set_text_color(60, 60, 60)
        for line in lines:
            self.cell(0, 6, f"  {line}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        end_y = self.get_y() + 2
        self.rect(20, start_y, 170, end_y - start_y, style="DF")
        self.set_xy(20, start_y + 2)
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(140, 100, 40)
        self.cell(0, 8, f"  {title}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("DejaVu", "", 10)
        self.set_text_color(60, 60, 60)
        for line in lines:
            self.cell(0, 6, f"  {line}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(4)

pdf = GenesisPDF()
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

FONT_DIR = "C:/Users/yosef/Desktop/Zion/2.9.6-main/docs/Wp-Mainet/dejavu/dejavu-fonts-ttf-2.37/ttf/"
pdf.add_font("DejaVu", "", FONT_DIR + "DejaVuSansCondensed.ttf", uni=True)
pdf.add_font("DejaVu", "B", FONT_DIR + "DejaVuSansCondensed-Bold.ttf", uni=True)
pdf.add_font("DejaVu", "I", FONT_DIR + "DejaVuSansCondensed-Oblique.ttf", uni=True)
pdf.add_font("DejaVu", "BI", FONT_DIR + "DejaVuSansCondensed-BoldOblique.ttf", uni=True)

# Titulní strana
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

# ============= KAPITOLA I =============
pdf.chapter_title("Kapitola I", "O počátku a o tom, proč vše začalo znovu")

pdf.body_text(
    "Byl rok 2024, když se poprvé zrodila myšlenka. Ne v laboratoři. Ne na konferenci. "
    "Ale v tichu — v tom hlubokém tichu, které přichází, když člověk pochopí, že svět, "
    "jaký známe, není jediný možný."
)

pdf.verse_text(
    "Cosmic Dharma — Kosmická Dharmová myšlenka."
    "\nVědomí jako konsensuální mechanismus."
    "\n144 miliard ZION. Ne jeden navíc."
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

# ============= KAPITOLA II =============
pdf.chapter_title("Kapitola II", "O Ekam Deeksha — algoritmu, který čte jako modlitbu")

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

pdf.verse_text(
    "V kódu věříme. 144 miliard ZION. Ne jeden satoshi navíc."
)

pdf.section_break()

# ============= KAPITOLA III =============
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

# ============= KAPITOLA IV =============
pdf.chapter_title("Kapitola IV", "O Zlatém Vejci a Velké Hře")

pdf.body_text(
    "V roce 2035, přesně deset let po genesis, se stane něco výjimečného."
)

pdf.verse_text(
    "Někde v blockchainu ZION je ukryt Easter Egg."
    "\nTen, kdo ho jako první najde, zdědí celé jmění."
    "\n— Maitreya Buddha, 2025"
)

pdf.body_text(
    "Velká cena činí dohromady 1,75 miliardy ZION. Rozdělena do tří úrovní:"
)

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

# ============= KAPITOLA V =============
pdf.chapter_title("Kapitola V", "O šesti vrstvách — od země ke hvězdám")

pdf.body_text(
    "ZION není jeden blockchain. Je to katedrála ze šesti vrstev."
)

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

# ============= KAPITOLA VI =============
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

pdf.body_text(
    "Toto jsou konstituční kameny. Základní pravdy, které nelze zvrátit ani největším hlasováním."
)

pdf.section_break()

# ============= KAPITOLA VII =============
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
    "Pražský node (91.98.122.165) běží od května 2026. Výška řetězce přesahuje 26 910 bloků. "
    "RPC, pool, Prometheus metriky, webová stránka — vše aktivní. Dvanáct Docker kontejnerů. Izolovaný režim, "
    "dokud nepřipojíme další peery."
)

pdf.section_break()

# ============= KAPITOLA VIII =============
pdf.chapter_title("Kapitola VIII", "O cestě vpřed")

pdf.body_text(
    "Q3 2026: Externí bezpečnostní audit. Bug bounty. Mobilní peněženka (iOS + Android)."
)
pdf.body_text(
    "Q4 2026: Mainnet Genesis — blok #0. wZION na Base, Arbitrum, BSC. Veřejná vydání binárek."
)
pdf.body_text(
    "2027: NCL + WARP živě. 1 000 NCL úloh denně. On-chain DAO hlasování."
)
pdf.body_text(
    "2028: L4 OASIS XP rollout."
)
pdf.body_text(
    "2030: L5 ZION Free World Foundation — volná energie, humanitární mise."
)
pdf.body_text(
    "2036: První Decade Decay — odměna klesne na 4 320 ZION."
)
pdf.body_text(
    "2040+: L6 ZION Issobella — kosmická divize."
)
pdf.body_text(
    "2126: Tail emission navěky. Síť nikdy nezemře."
)

pdf.ln(10)

pdf.set_font("DejaVu", "I", 11)
pdf.set_text_color(100, 100, 100)
pdf.multi_cell(0, 7,
    "Toto není whitepaper. Toto je kniha zrození. "
    "Zapsáno v kódu. Ověřitelné on-chain. Neměnné. "
    "A otevřené pro každého, kdo chce být součástí."
)

pdf.ln(8)

pdf.verse_text(
    "Gate, Gate, Paragate, Parasamgate, Bodhi Svaha."
    "\n— Dedicace genesis bloku, 2026"
)

pdf.ln(10)
pdf.set_font("DejaVu", "", 9)
pdf.set_text_color(150, 150, 150)
pdf.cell(0, 6, "© 2026 ZION Open-Source Contributors · MIT Licence · github.com/Yose144/2.9.6", align="C")

out_path = "C:/Users/yosef/Desktop/Zion/2.9.6-main/docs/Wp-Mainet/ZION_Kniha_Zrozeni_v3.0.pdf"
pdf.output(out_path)
print(f"PDF vygenerováno: {out_path}")
