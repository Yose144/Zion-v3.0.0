# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "fpdf2>=2.8",
# ]
# ///
"""
ZION TerraNova — Fable Edition (WpLite) PDF generator (Linux-compatible).

Generates two PDFs in docs/WP-Mainet/:
  - Zion-WpLite_CZ.pdf  (Czech, "Fable Edition" v3.0.5)
  - Zion-WpLite_EN.pdf  (English, "Fable Edition" v3.0.5)

The fable is a story-style whitepaper: each chapter is a fairy-tale passage
followed by a "Chronicle entry" with verifiable on-chain facts.

Run:
  python3 docs/WP-Mainet/generate_wplite_pdfs.py
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
import os

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"


class FablePDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, self.header_text, align="C")
        self.ln(5)
        self.set_draw_color(180, 140, 60)
        self.set_line_width(0.3)
        self.line(20, self.get_y(), 190, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"{self.page_word} {self.page_no()}", align="C")

    def title_page(self, title, subtitle, tagline_lines, edition_line):
        self.set_font("DejaVu", "B", 28)
        self.set_text_color(180, 140, 60)
        self.set_y(55)
        self.cell(0, 18, title, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("DejaVu", "I", 14)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, subtitle, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(8)
        self.set_font("DejaVu", "I", 10)
        self.set_text_color(120, 120, 120)
        for line in tagline_lines:
            self.cell(0, 7, line, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(25)
        self.set_font("DejaVu", "I", 9)
        self.set_text_color(150, 150, 150)
        self.cell(0, 6, edition_line, align="C")

    def chapter_heading(self, num_text, title):
        self.ln(4)
        self.set_font("DejaVu", "B", 15)
        self.set_text_color(180, 140, 60)
        self.cell(0, 10, num_text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("DejaVu", "B", 13)
        self.set_text_color(80, 60, 30)
        self.multi_cell(0, 8, title)
        self.ln(2)
        self.set_draw_color(180, 140, 60)
        self.set_line_width(0.4)
        self.line(20, self.get_y(), 100, self.get_y())
        self.ln(5)

    def story(self, paragraphs):
        """Render story paragraphs. Items starting with '*' are italic verse."""
        for p in paragraphs:
            if p.startswith("*") and p.endswith("*"):
                self.set_font("DejaVu", "I", 10)
                self.set_text_color(90, 90, 90)
                self.set_left_margin(30)
                self.multi_cell(0, 6, p.strip("*"))
                self.set_left_margin(20)
                self.ln(2)
            else:
                self.set_font("DejaVu", "", 10.5)
                self.set_text_color(40, 40, 40)
                self.multi_cell(0, 6, p)
                self.ln(2)

    def chronicle(self, title, body_lines, table_rows=None):
        """Render a 'Chronicle entry' box with verifiable facts."""
        self.ln(2)
        self.set_fill_color(255, 250, 235)
        self.set_draw_color(180, 140, 60)
        self.set_line_width(0.4)
        box_x = 20
        box_w = 170
        inner_w = box_w - 8  # padding
        start_y = self.get_y()
        # Pre-measure height
        height = 10  # title
        for line in body_lines:
            height += 6
        if table_rows:
            height += 8  # table header
            for _ in table_rows:
                height += 6
        height += 4
        # Draw box
        self.rect(box_x, start_y, box_w, height, style="DF")
        # Title bar
        self.set_xy(box_x, start_y + 2)
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(140, 90, 30)
        self.cell(0, 7, f"  {title}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        # Body — use explicit width, not margin-dependent
        self.set_x(box_x + 4)
        self.set_font("DejaVu", "", 9.5)
        self.set_text_color(60, 60, 60)
        for line in body_lines:
            self.set_x(box_x + 4)
            self.multi_cell(inner_w, 5.5, line)
        if table_rows:
            self.ln(1)
            self.set_font("DejaVu", "B", 9)
            self.set_text_color(120, 80, 30)
            self.set_x(box_x + 4)
            self.cell(inner_w, 5, "  " + "  |  ".join(table_rows[0]), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_font("DejaVu", "", 9)
            self.set_text_color(60, 60, 60)
            for row in table_rows[1:]:
                self.set_x(box_x + 4)
                self.cell(inner_w, 5, "  " + "  |  ".join(row), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(4)

    def section_break(self):
        self.ln(6)
        self.set_draw_color(180, 140, 60)
        self.set_line_width(0.3)
        center = 105
        self.line(center - 12, self.get_y(), center + 12, self.get_y())
        self.ln(6)


def build_pdf(lang):
    pdf = FablePDF()
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.add_page()
    pdf.add_font("DejaVu", "", FONT_DIR + "DejaVuSans.ttf")
    pdf.add_font("DejaVu", "B", FONT_DIR + "DejaVuSans-Bold.ttf")
    pdf.add_font("DejaVu", "I", FONT_DIR + "DejaVuSans.ttf")
    pdf.add_font("DejaVu", "BI", FONT_DIR + "DejaVuSans-Bold.ttf")

    if lang == "cz":
        pdf.header_text = "ZION TerraNova · Bajka o zahradě, která se naučila počítat"
        pdf.page_word = "Strana"
        pdf.title_page(
            "ZION TerraNova",
            "Bajka o zahradě, která se naučila počítat",
            [
                "Whitepaper vyprávěný jako pohádka pro dospělé.",
                "Každá pravdivá bajka má dvě vrstvy: příběh, který si zapamatuje dítě,",
                "a pravdu, kterou si ověří dospělý. Tento dokument má obě.",
            ],
            "Verze 5 · „Fable Edition“ · v3.0.5 Mainnet Beta · červenec 2026",
        )
        pdf.add_page()
        # How to read
        pdf.chapter_heading("Jak číst tuto knihu", "")
        pdf.story([
            "Bajka běží v kapitolách. Po každé kapitole následuje **Zápis v kronice** — suchá, ověřitelná fakta, která příběhu odpovídají. Nic v kronice není básnická licence. Všechno v ní lze najít v kódu, na řetězci nebo v auditních záznamech.",
            "Kdo chce jen příběh, ať čte kurzívu srdce. Kdo chce jen čísla, ať čte kroniku. Kdo chce ZION celý, ať čte obojí — protože ZION je právě to: mýtus a kód, které se odmítly rozejít.",
        ])
        pdf.section_break()

        # Ch 1
        pdf.chapter_heading("Kapitola první", "Město, kde řeka tekla do kopce")
        pdf.story([
            "Bylo jednou jedno město a tím městem protékala řeka peněz.",
            "Řeky obvykle tečou dolů, k polím a k lidem. Ale tahle řeka byla postavena chytře: tekla do kopce, k zámku. Čím víc lidé dole pracovali, tím víc vody se hromadilo nahoře. Ti na zámku tomu říkali ekonomika. Ti dole tomu říkali čtvrtek.",
            "Občas někdo dole postavil vlastní studnu a prohlásil: „Tohle je nová řeka! Tahle poteče spravedlivě!“ A lidé se sběhli a radovali se. Jenže pak se ukázalo, že stavitel studny si nechal první vodu pro sebe, prodal ji svým přátelům za pár kapek, a když se studna naplnila důvěrou ostatních, prodali všechno a odešli stavět další studnu do vedlejšího města.",
            "Tolik studní. Tolik slibů. A řeka pořád tekla do kopce.",
            "Až jednoho dne seděl na kraji města zahradník a nedělal nic. Neprotestoval. Nestavěl studnu. Jen se díval na vyschlou zem a v tom tichu mu přišla otázka, která je začátkem každého skutečného příběhu:",
            "*Co kdyby voda neměla majitele — jen pravidla, která nikdo neumí ohnout?*",
            "A protože byl zahradník, nenapadla ho banka ani revoluce. Napadlo ho semeno.",
        ])
        pdf.chronicle("Zápis v kronice — Semeno", [
            "Semeno se jmenuje ZION TerraNova. Je to nativní Layer-1 blockchain napsaný od nuly v jazyce Rust.",
            "Fair launch: žádné ICO, žádný předprodej, žádné tokeny pro zakladatele. První vodu nedostal nikdo — každý ZION musí být vytěžen prací nebo získán od někoho, kdo ho vytěžil.",
            "Hard cap: 144 000 000 000 ZION. Ne jeden navíc. Zapsáno v emission.rs jako konstanta, ne jako slib.",
            "Stav dnes: Mainnet Beta, protokol zion-v3-node/3.0.5, veřejný launch cíl 31. 12. 2026.",
            "Licence: MIT. Kdokoli smí semeno prozkoumat, zasadit vlastní, nebo dokázat, že je shnilé.",
        ])
        pdf.section_break()

        # Ch 2
        pdf.chapter_heading("Kapitola druhá", "Čtyři poutníci u brány")
        pdf.story([
            "Semeno ale nestačí. Zahradník to věděl — viděl už příliš mnoho semen, ze kterých vyrostl plevel s hezkým jménem.",
            "A tak k jeho zahradě přišli, jak už to v bajkách bývá, čtyři poutníci. Každý nesl jednu knihu a jednu otázku.",
            "První nesl oheň a knihu Genesis. Zeptal se: Proč sázíš? — Protože semeno zasazené ze strachu vyroste v plot a semeno zasazené z chamtivosti vyroste v past. Jen semeno zasazené se záměrem sloužit životu má šanci vyrůst ve strom, pod kterým si sedne i cizinec.",
            "Druhá nesla vítr a knihu Kvantové revoluce. Zeptala se: Víš, proč umřely ty zahrady před tebou? — A ukázala mu vzorec: každá z nich odměňovala toho, kdo bere, a doufala, že dávání přijde samo. Nepřišlo nikdy. Vítr nelže: co je nemocné, to pojmenuje.",
            "Třetí nesl vodu a knihu Ekam Deeksha. Neptal se na zahradu. Zeptal se: A co ty? Až zahrada poroste a lidé ti začnou říkat pane zahradníku — kdo z tebe zbyde? — Protože voda smývá masky. Revoluce, která nepromění revolucionáře, jen přemaluje zámek.",
            "Čtvrtá nesla hlínu a knihu Terra Nova. Ta řekla jen: Ukaž ruce. — Protože vize se pozná podle mozolů. Nová Země není místo, kam se utíká. Je to místo, které se kope, zalévá, prohrává a znovu sází.",
            "Zahradník všechny čtyři knihy položil pod semeno jako čtyři kořeny.",
            "A od toho dne platí v zahradě pravidlo: kdo cituje jen jednu knihu, tomu nevěř. Oheň bez hlíny je požár. Hlína bez ohně je bláto. Voda bez větru zahnívá. Vítr bez vody jen víří prach.",
        ])
        pdf.chronicle("Zápis v kronice — Čtyři knihy", [
            "Osu projektu tvoří čtyři skutečné knihy komplexu ZION:",
        ], table_rows=[
            ["Kniha", "Živel", "Otázka", "Co dává"],
            ["Genesis", "oheň", "Proč stavíme?", "záměr, legitimitu"],
            ["Kvantová revoluce", "vzduch", "Co bylo rozbité?", "diagnózu extrakce"],
            ["Ekam Deeksha", "voda", "Kdo staví?", "proměnu stavitele"],
            ["Terra Nova", "země", "Jak to postavit?", "architekturu, praxi"],
        ])
        pdf.section_break()

        # Ch 3
        pdf.chapter_heading("Kapitola třetí", "Strom, který platí za vlastní stín")
        pdf.story([
            "Semeno vzešlo. A rostlo jinak než všechno, co město znalo.",
            "Každou minutu — přesně, jako tep — vyrostl stromu jeden letokruh. A v každém letokruhu se urodilo přesně odměřené ovoce. Ne podle nálady krále. Ne podle hlasování rady. Podle pravidla vypáleného do dřeva.",
            "A teď to nejpodivnější, kvůli čemu se do zahrady začali sjíždět lidé z dalekých měst: Strom se dělil sám.",
            "Z každé úrody dal devět dílů z deseti tomu, kdo strom hlídal a zaléval — protože práce se má ctít, ne oslavovat řečmi. Ale desetinu poslal pryč, ven ze zahrady, dřív než se jí kdokoli stačil dotknout. Půlku té desetiny hladovým. Půlku dětem, které se ještě nenarodily. A jedno jediné procento spálil v ohni — aby ani správce zahrady nikdy nezbohatl jen z toho, že stojí u brány.",
            "„To je naivní,“ smáli se kupci. „Strom, který rozdává, zchudne.",
            "„Ne,“ řekl zahradník. „Strom, který rozdává podle pravidla, nezchudne nikdy. Zchudne strom, který rozdává podle nálady — protože nálada se dá koupit.",
            "A ještě jednu moudrost měl strom v sobě: nerostl překotně. Každých deset let zpomalil o pětinu — klidně, předvídatelně, bez paniky. Žádné náhlé půlení úrody, po kterém hlídači v noci utíkají k jinému stromu. A na konci té dlouhé křivky, za sto let, mu zůstane věčná malá úroda — dost na to, aby ho vždycky mělo smysl hlídat.",
            "Strom nebyl štědrý. Strom byl spočítaný. A právě proto se mu dalo věřit.",
        ])
        pdf.chronicle("Zápis v kronice — Ekonomika stromu", [
            "On-chain vynucení splitu je živé: coinbase každého bloku má čtyři výstupy s deterministickým poměrem 89/5/5/1 a uzly blok s jiným poměrem odmítnou.",
        ], table_rows=[
            ["Parametr", "Hodnota", "Kde je zapsán"],
            ["Čas bloku", "60 sekund", "konsensus L1"],
            ["Základní odměna", "5 400,067 ZION", "BASE_REWARD"],
            ["Split úrody", "89/5/5/1 %", "fee_split() v emission.rs"],
            ["Emisní křivka", "Decade Decay −20 %/dekádu", "emission.rs"],
            ["Věčná úroda", "724,784723 ZION/blok od ~2126", "TAIL_REWARD"],
            ["Poplatky", "100 % spáleny", "deflační mechanismus"],
            ["Jednotka", "1 ZION = 1 000 000 flowers", "po forku 3.0.3"],
            ["Premine", "16,78 mld. ZION transparentně", "genesis blok"],
        ])
        pdf.section_break()

        # Ch 4
        pdf.chapter_heading("Kapitola čtvrtá", "Zámek posílá stroje")
        pdf.story([
            "Zámek si stromu dlouho nevšímal. Pak si všiml — a udělal to, co zámky dělají vždycky: poslal stroje.",
            "Obrovské, jednoúčelové stroje, které umí jedinou věc, ale dělají ji milionkrát rychleji než člověk. V jiných zahradách to fungovalo: stroje vytlačily lidi, hlídání stromů se přestěhovalo do tří skladů na světě, a z řeky bez majitele se zase stala řeka do kopce — jen s novým erbem.",
            "Ale tenhle strom měl v kůře zvláštní hádanku.",
            "Nechtěl jen rychlost. Chtěl paměť. Kdo chtěl utrhnout ovoce, musel projít bludištěm, které se nedá zapamatovat dopředu — muselo se projít celé, krok za krokem, a každý krok závisel na tom předchozím. Obří stroje ze zámku měly rychlé ruce, ale malou hlavu. Domácí počítač obyčejného člověka měl najednou skoro stejnou šanci jako mašina za miliony.",
            "„Je to navždy?“ ptali se lidé.",
            "„Ne,“ odpověděl zahradník po pravdě. „Nic není navždy. Ale je to záměr, který se měří a udržuje — a když zámek postaví chytřejší stroj, změníme bludiště. Slibovat věčnou nedobytnost umí jen ten, kdo lže. My slibujeme věčnou práci na hradbách.",
        ])
        pdf.chronicle("Zápis v kronice — Bludiště", [
            "Těžební algoritmus se jmenuje Ekam Deeksha — sanskrtsky jedna iniciace. Vícefázový pipeline (Keccak-256 → SHA3-512 → maticová difúze → paměťově vázaný scratchpad s pseudonáhodnými závislými čteními → NPU mixing → finální fúze) je navržen tak, aby paměťová náročnost srážela výhodu specializovaných ASIC čipů.",
            "ASIC-resistance je aktivní inženýrský cíl (interně hodnocený ~90 %), ne dogma — parametry lze zvyšovat soft-forkem.",
            "Podpisy Ed25519, hashování BLAKE3, obtížnost LWMA (okno 60 bloků).",
            "Síť validuje práci, ne identitu, majetek ani názor. To je pojistka proti každé budoucí tyranii dobrých úmyslů.",
        ])
        pdf.section_break()

        # Ch 5
        pdf.chapter_heading("Kapitola pátá", "Noc, kdy do zahrady vlezl had")
        pdf.story([
            "Teď přichází kapitola, kterou by marketingová bajka vynechala. Právě proto tu je.",
            "Jedné letní noci roku 2026 se do zahrady dostal had. Našel skulinu ve staré zdi — klíč, který ležel tam, kde ležet neměl — a začal do letokruhů vpisovat ovoce, které nikdy nevyrostlo. Falešnou úrodu. Peníze z ničeho — tedy přesně tu nemoc, kterou strom přišel léčit.",
            "A teď dávej pozor, protože tady se pozná charakter příběhu.",
            "Zahradníci hada objevili. A neudělali to, co dělá zámek — nezamlčeli to, nepřejmenovali to, nenajali herolda, aby vytroubil, že je vše v pořádku.",
            "Udělali tři věci, v tomto pořadí:",
            "1. Řekli to nahlas. Sepsali veřejnou listinu o tom, kudy had vlezl, co poškodil a čí chyba to byla.",
            "2. Spálili nakažené dřevo. Celý strom, až ke kořenu. Vyměnili každý klíč, každý zámek, každou skulinu ve zdi.",
            "3. Zasadili znovu. Ze stejného semene, se stejnými pravidly — ale s tvrdší kůrou, ve které už každý zápis musí prokázat svůj podpis a každý výdaj svůj původ.",
            "Kupci z města kroutili hlavou: Přiznali chybu! Teď jim nikdo nebude věřit!",
            "Stalo se přesně naopak. Protože lidé z dolního města znali zámky celý život a věděli jedno: instituce, která nikdy nepřizná chybu, chybuje pořád. Zahrada, která spálí vlastní strom, aby zachránila pravdu, je první místo v tomhle městě, kde pravda váží víc než pověst.",
            "Nový strom roste dodnes. A jizva po požáru není ostuda — je to letokruh, který se ukazuje návštěvníkům jako první.",
        ])
        pdf.chronicle("Zápis v kronice — Had a nový kořen", [
            "V roce 2026 byly nalezeny a zveřejněny kritické zranitelnosti (mj. chybějící ověření podpisů u P2P account transakcí a chybějící validace zůstatku odesílatele umožňující inflaci) plus kompromitace serveru a klíčů.",
            "Reakce: veřejná security disclosure ve formátu Ethereum Foundation (ZION-2026-001 … 005), oprava konsensu, kompletní rotace klíčů a hard genesis reset (2026-07-06).",
            "Nový kanonický kořen: 4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e",
            "Od resetu: služby aktivní, E2E testy potvrzeny na živé síti, externí audit plánován.",
            "Poučení zapsané do kultury projektu: důvěra se nebuduje tvrzením, že chyba je nemožná — buduje se veřejnou opravou.",
        ])
        pdf.section_break()

        # Ch 6
        pdf.chapter_heading("Kapitola šestá", "Šest větví a hvězda")
        pdf.story([
            "Strom rostl a větvil se. Ne náhodně — jako katedrála.",
            "První větev, nejníž a nejsilnější, drží pravdu. Na ní sedí hlídači s počítadly a nic, co neprošlo jejich pravidly, se nestane skutečností. Bez téhle větve je všechno ostatní jen malování na vzduch.",
            "Druhá větev natahuje mosty do sousedních zahrad — aby ovoce mohlo cestovat i tam, kde rostou jiné stromy, a přitom nikdy nezapomnělo, odkud je. Mosty jsou krásné a mosty jsou nebezpečné; proto na každém stojí pět strážných a most se otevře, jen když se shodnou všichni.",
            "Třetí větev je míza a nervy — poslové mezi světy a tichý strážce, který nikdy nespí a hlásí, když se v noci něco hýbe, co se hýbat nemá.",
            "Čtvrtá větev je hřiště. Ano, hřiště — protože zahradník věděl, že lidé se nejvíc naučí, když si hrají. Na téhle větvi se hraje velká hra o spolupráci, trpělivost a devět pater vědomí. Hra nikdy nesoudí, kdo je dobrý člověk. Jen nabízí zrcadlo.",
            "Pátá větev teprve pučí a je ze všech nejdůležitější: má jednou nést plody do skutečné hlíny — ke studnám, školám a komunitám, které si řeknou o pomoc a dostanou ji s otevřenou účetní knihou, ne s tiskovou zprávou.",
            "A úplně nahoře, nad korunou, není větev, ale hvězda.",
            "Jmenuje se Issobella. Je pojmenovaná po lásce a je strašně daleko. Někteří říkají, že je to observatoř, která jednou poletí nad zemí. Jiní říkají, že je to jen světlo, ke kterému strom rovná kmen, aby nerostl křivě.",
            "Obojí je pravda. Hvězda dostává svůj díl z každé úrody — ne proto, že by ho už uměla utratit, ale proto, aby si zahrada každou minutu, s každým letokruhem, připomněla: nestavíme pro tenhle trh. Stavíme pro děti, které se ještě nenarodily.",
        ])
        pdf.chronicle("Zápis v kronice — Šest vrstev", [
            "Fond Issobella (5 % z každého bloku) se plní už dnes — horizont není výmluva, je to účet, který roste.",
        ], table_rows=[
            ["Vrstva", "Jméno", "Obsah", "Stav"],
            ["L1", "Core", "Rust node, pool, miner, PoW, UTXO+account", "ŽIVÉ — Mainnet Beta"],
            ["L2", "Bridge & DeFi", "wZION na 6 EVM sítích, staking, farming, DAO", "ŽIVÉ / ROZESTAVĚNÉ"],
            ["L3", "WARP & AI", "cross-chain router, ZionDex, AI monitoring", "ROZESTAVĚNÉ"],
            ["L4", "OASIS", "UE5 + Rust herní svět, XP, 9 úrovní vědomí", "ROZESTAVĚNÉ"],
            ["L5", "Free World", "humanitární mise s on-chain dopadem", "HORIZONT (~2030)"],
            ["L6", "Issobella", "orbitální výzkumný horizont", "HORIZONT (2040+)"],
        ])
        pdf.section_break()

        # Ch 7
        pdf.chapter_heading("Kapitola sedmá", "Otázka, kterou strom ještě neumí zodpovědět")
        pdf.story([
            "Jednoho večera si k zahradníkovi přisedlo dítě a zeptalo se na tu nejtěžší věc:",
            "„Strom platí těm, kdo kopou. Ale babička nekope. Babička nosí vodu nemocným a učí děti číst. Proč jí strom nic nedá?",
            "Zahradník dlouho mlčel. Tohle byla otázka, na kterou špatná odpověď zničí všechno.",
            "„Protože,“ řekl nakonec pomalu, „kopání se dá změřit a nedá se předstírat. Ale péče… kdybych já rozhodoval, čí péče je pravá, stal by se ze mě zámek. Kdyby o tom hlasoval dav, vyhrál by ten, kdo se umí nejlíp ukazovat. A kdyby to měřil stroj, lidé by se naučili pečovat pro stroj, ne pro babiččiny nemocné.",
            "„Takže to nejde?",
            "„Jde to. Ale pomalu a pozpátku. Nejdřív se naučíme měřit péči o strom samotný — hlídání mostů, hledání hadů, opravování zdí, vedení otevřených knih. To se ověřit dá. A když se za mnoho let ukáže, že to funguje a nikdo si z toho neudělal trůn — teprve pak, možná, se strom naučí vidět i babiččinu vodu.",
            "„A když se to nepovede?",
            "„Tak zůstane u kopání. Poctivé kopání je lepší než falešná svatost. Strom, který by se pokusil měřit dobro a spletl se, by byl horší než zámek — byl by to zámek, který si myslí, že je nebe.",
            "Dítě přikývlo, jako přikyvují děti, které pochopily víc, než dokážou říct.",
            "A nad zahradou, tiše, svítila Issobella.",
        ])
        pdf.chronicle("Zápis v kronice — Od Proof-of-Work k Proof-of-Care", [
            "Dnes: ZION je Proof-of-Work síť. Konsensus nevaliduje víru, morálku, meditaci ani úroveň vědomí — a nemá to dělat. To je bezpečnostní vlastnost, ne nedostatek.",
            "Horizont: Proof-of-Care (Protokol Péče) — možnost odměňovat ověřitelnou užitečnou péči (monitoring sítě, detekce anomálií, audit kontraktů, transparentní evidence humanitárního dopadu) vedle výpočetní práce.",
            "PoC smí být aktivován pouze při splnění sedmi podmínek: kryptografická ověřitelnost, dobrovolnost, ochrana soukromí, odolnost proti botům, dostupnost, veřejný audit a odvolání, a žádné oslabení PoW bezpečnosti L1, dokud model není mnohonásobně prověřen.",
            "Technické zárodky už existují (NPU mixing v PoW, AI monitoring, care-proof výzkum, Sefirot Vow pro validátory) — a jsou v dokumentaci vedeny poctivě jako rozestavěné, ne hotové.",
        ])
        pdf.section_break()

        # Ch 8
        pdf.chapter_heading("Kapitola osmá", "Co znamená vrátit se do ráje")
        pdf.story([
            "Na konci bajek bývá ponaučení. Tady je.",
            "Lidé z města se zahradníka často ptali: „Slibuješ nám ráj?",
            "A on vždycky odpověděl: „Ne. Ráj se nedá slíbit. Ráj se dá jen přestat ničit.",
            "Protože ráj — v téhle bajce i mimo ni — nikdy nebylo místo bez práce. Byl to stav, kdy se svět obnovoval rychleji, než ho lidé stačili spotřebovávat. Kdy voda patřila žízni a ne erbu. Kdy znalost byla studna na návsi a ne trezor. Kdy člověk nemusel volit mezi přežitím a svědomím.",
            "Z toho ráje nás nevyhnal žádný anděl s mečem. Odešli jsme sami, krok za krokem, pokaždé když jsme postavili další řeku tekoucí do kopce.",
            "A proto se do něj taky dá vrátit. Krok za krokem. Blokem za blokem.",
            "Strom života není v téhle bajce dekorace. Je to návod: kořeny, které nelžou. Kmen, který se nedá koupit. Míza, která teče všem větvím. Koruna, která si hraje. Plody, které padají i za plot. A hvězda, která hlídá, aby strom nerostl křivě.",
            "ZION není ráj. ZION je zahradnické nářadí.",
            "Ráj jsi ty, až ho vezmeš do ruky.",
        ])
        pdf.section_break()

        # Epilogue
        pdf.chapter_heading("Doslov pro nedůvěřivé", "(a dobře, že jste)")
        pdf.story([
            "Tahle bajka by nestála za papír, kdyby se nedala vyvrátit. Dá se. Všechno podstatné je veřejné:",
        ])
        pdf.chronicle("Co si ověřit a kde", [
            "Nevěř bajce. Ověř kroniku. A když kronika obstojí — pak si tu bajku vyprávěj dál, protože příběhy, které obstály před kalkulačkou, jsou to nejcennější, co civilizace má.",
        ], table_rows=[
            ["Co si ověřit", "Kde"],
            ["Protokol", "zion-v3-node/3.0.5"],
            ["Genesis hash", "4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e"],
            ["Celková nabídka", "144 000 000 000 ZION (emission.rs)"],
            ["Premine", "16 780 000 000 ZION, transparentní výstupy v bloku 0"],
            ["Split 89/5/5/1", "čtyřvýstupová coinbase, vynuceno konsensem"],
            ["Základní odměna", "5 400,067 ZION · blok 60 s"],
            ["Decade Decay + tail", "−20 %/dekádu, poté 724,784723 ZION/blok navěky"],
            ["Zdrojový kód", "github.com/Zion-TerraNova/v3-Mainnet (MIT)"],
            ["Web / Explorer", "zionterranova.com · /explorer"],
            ["Pool", "pool.zionterranova.com:8444"],
            ["Security disclosure", "ZION-2026-001…005, veřejná, formát EF"],
        ])
        pdf.ln(6)
        pdf.story([
            "*ZION TerraNova · Fable Edition · psáno se čtyřmi knihami pod kořenem.*",
            "*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*",
        ])
        out_path = "docs/WP-Mainet/Zion-WpLite_CZ.pdf"

    else:  # en
        pdf.header_text = "ZION TerraNova · A Fable of the Garden That Learned to Count"
        pdf.page_word = "Page"
        pdf.title_page(
            "ZION TerraNova",
            "A Fable of the Garden That Learned to Count",
            [
                "A whitepaper told as a fairy tale for grown-ups.",
                "Every truthful fable has two layers: a story a child remembers,",
                "and a truth an adult verifies. This document has both.",
            ],
            "Version 5 · \"Fable Edition\" · v3.0.5 Mainnet Beta · July 2026",
        )
        pdf.add_page()
        pdf.chapter_heading("How to read this book", "")
        pdf.story([
            "The fable runs in chapters. After each chapter comes a Chronicle entry — dry, verifiable facts that correspond to the story. Nothing in the chronicle is poetic license. Everything in it can be found in the code, on the chain, or in the audit records.",
            "Whoever wants only the story, let them read the verse of the heart. Whoever wants only the numbers, let them read the chronicle. Whoever wants the whole of ZION, let them read both — because ZION is precisely that: a myth and a code that refused to part ways.",
        ])
        pdf.section_break()

        # Ch 1
        pdf.chapter_heading("Chapter one", "The town where the river flowed uphill")
        pdf.story([
            "Once upon a time there was a town, and through that town flowed a river of money.",
            "Rivers usually flow downhill, toward the fields and the people. But this river had been built cleverly: it flowed uphill, toward the castle. The harder the people below worked, the more water accumulated above. Those in the castle called it economics. Those below called it Thursday.",
            "Every so often someone below would build their own well and declare: \"This is a new river! This one will flow fairly!\" And the people would gather and rejoice. But then it turned out that the well-builder had kept the first water for himself, sold it to his friends for a few drops, and when the well filled with the trust of the rest, they sold everything and left to build another well in the next town.",
            "So many wells. So many promises. And the river kept flowing uphill.",
            "Until one day a gardener sat at the edge of town and did nothing. He did not protest. He did not build a well. He just looked at the parched earth, and in that silence came the question that begins every real story:",
            "*What if water had no owner — only rules that no one could bend?*",
            "And because he was a gardener, he did not think of a bank or a revolution. He thought of a seed.",
        ])
        pdf.chronicle("Chronicle entry — The Seed", [
            "The seed is called ZION TerraNova. It is a native Layer-1 blockchain written from scratch in Rust.",
            "Fair launch: no ICO, no pre-sale, no founder tokens. No one got the first water — every ZION must be mined by work or received from someone who mined it.",
            "Hard cap: 144,000,000,000 ZION. Not one more. Written in emission.rs as a constant, not as a promise.",
            "Status today: Mainnet Beta, protocol zion-v3-node/3.0.5, public launch target 31 Dec 2026.",
            "License: MIT. Anyone may examine the seed, plant their own, or prove it is rotten.",
        ])
        pdf.section_break()

        # Ch 2
        pdf.chapter_heading("Chapter two", "Four pilgrims at the gate")
        pdf.story([
            "But a seed is not enough. The gardener knew this — he had already seen too many seeds grow into weeds with pretty names.",
            "And so, as happens in fables, four pilgrims came to his garden. Each carried one book and one question.",
            "The first carried fire and the Book of Genesis. He asked: Why do you plant? — Because a seed planted in fear grows into a fence, and a seed planted in greed grows into a trap. Only a seed planted with the intent to serve life has a chance to grow into a tree under which even a stranger may sit.",
            "The second carried wind and the Book of Quantum Revolution. She asked: Do you know why the gardens before you died? — And she showed him the formula: each of them rewarded the one who takes, and hoped that giving would come on its own. It never did. The wind does not lie: it names what is sick.",
            "The third carried water and the Book of Ekam Deeksha. He did not ask about the garden. He asked: And you? When the garden grows and people start calling you lord gardener — what will be left of you? — Because water washes away masks. A revolution that does not transform the revolutionary only repaints the castle.",
            "The fourth carried clay and the Book of Terra Nova. She said only: Show me your hands. — Because a vision is known by its calluses. A New Earth is not a place to flee to. It is a place that is dug, watered, lost, and planted again.",
            "The gardener laid all four books under the seed as four roots.",
            "And from that day a rule held in the garden: trust no one who quotes only one book. Fire without clay is a wildfire. Clay without fire is mud. Water without wind stagnates. Wind without water only stirs dust.",
        ])
        pdf.chronicle("Chronicle entry — The Four Books", [
            "The axis of the project is formed by four real books of the ZION complex:",
        ], table_rows=[
            ["Book", "Element", "Question", "What it gives"],
            ["Genesis", "fire", "Why do we build?", "intent, legitimacy"],
            ["Quantum Revolution", "air", "What was broken?", "diagnosis of extraction"],
            ["Ekam Deeksha", "water", "Who builds?", "transformation of the builder"],
            ["Terra Nova", "earth", "How to build it?", "architecture, practice"],
        ])
        pdf.section_break()

        # Ch 3
        pdf.chapter_heading("Chapter three", "The tree that pays for its own shade")
        pdf.story([
            "The seed sprouted. And it grew differently from anything the town knew.",
            "Every minute — precisely, like a heartbeat — the tree grew one ring. And in every ring exactly measured fruit was born. Not by the king's mood. Not by a council's vote. By a rule burned into the wood.",
            "And now the strangest thing, the thing that started drawing people from distant towns to the garden: the tree divided itself.",
            "From every harvest it gave nine parts out of ten to the one who guarded and watered the tree — because work should be honored, not celebrated with speeches. But a tenth it sent away, out of the garden, before anyone could touch it. Half of that tenth to the hungry. Half to children not yet born. And a single percent it burned in fire — so that no garden steward would ever grow rich just from standing at the gate.",
            "\"That's naive,\" the merchants laughed. \"A tree that gives away will go poor.\"",
            "\"No,\" said the gardener. \"A tree that gives by rule never goes poor. A tree that gives by mood goes poor — because mood can be bought.\"",
            "And the tree held one more wisdom: it did not grow headlong. Every ten years it slowed by a fifth — calmly, predictably, without panic. No sudden halving of the harvest that sends guards fleeing to another tree in the night. And at the end of that long curve, after a hundred years, it keeps a perpetual small harvest — enough that it is always worth guarding.",
            "The tree was not generous. The tree was calculated. And that is precisely why it could be trusted.",
        ])
        pdf.chronicle("Chronicle entry — The Tree's Economy", [
            "On-chain enforcement of the split is live: the coinbase of every block has four outputs with a deterministic 89/5/5/1 ratio, and nodes reject any block with a different ratio.",
        ], table_rows=[
            ["Parameter", "Value", "Where it is written"],
            ["Block time", "60 seconds", "L1 consensus"],
            ["Base reward", "5,400.067 ZION", "BASE_REWARD"],
            ["Harvest split", "89/5/5/1 %", "fee_split() in emission.rs"],
            ["Emission curve", "Decade Decay −20 %/decade", "emission.rs"],
            ["Perpetual harvest", "724.784723 ZION/block from ~2126", "TAIL_REWARD"],
            ["Fees", "100 % burned", "deflationary mechanism"],
            ["Unit", "1 ZION = 1,000,000 flowers", "after fork 3.0.3"],
            ["Premine", "16.78B ZION transparently", "genesis block"],
        ])
        pdf.section_break()

        # Ch 4
        pdf.chapter_heading("Chapter four", "The castle sends machines")
        pdf.story([
            "The castle long ignored the tree. Then it noticed — and did what castles always do: it sent machines.",
            "Huge, single-purpose machines that could do only one thing, but did it a million times faster than a human. In other gardens it had worked: the machines drove out the people, the guarding of trees moved into three warehouses in the world, and the \"river with no owner\" became a river flowing uphill again — only with a new crest.",
            "But this tree had a strange riddle in its bark.",
            "It did not want only speed. It wanted memory. Whoever wished to pick fruit had to pass through a maze that could not be memorized in advance — it had to be walked entirely, step by step, and each step depended on the one before. The giant machines from the castle had fast hands but a small head. The home computer of an ordinary person suddenly had almost the same chance as a machine worth millions.",
            "\"Is it forever?\" people asked.",
            "\"No,\" the gardener answered truthfully. \"Nothing is forever. But it is an intent that is measured and maintained — and when the castle builds a smarter machine, we change the maze. Only those who lie promise eternal impregnability. We promise eternal work on the walls.\"",
        ])
        pdf.chronicle("Chronicle entry — The Maze", [
            "The mining algorithm is called Ekam Deeksha — Sanskrit for \"one initiation\". A multi-phase pipeline (Keccak-256 → SHA3-512 → matrix diffusion → memory-bound scratchpad with pseudo-random dependent reads → NPU mixing → final fusion) is designed so that memory hardness erodes the advantage of specialized ASIC chips.",
            "ASIC-resistance is an active engineering goal (internally rated ~90 %), not dogma — parameters can be raised by soft-fork.",
            "Ed25519 signatures, BLAKE3 hashing, LWMA difficulty (60-block window).",
            "The network validates work, not identity, wealth, or opinion. That is the safeguard against every future tyranny of good intentions.",
        ])
        pdf.section_break()

        # Ch 5
        pdf.chapter_heading("Chapter five", "The night the snake crept into the garden")
        pdf.story([
            "Now comes the chapter that a marketing fable would skip. That is exactly why it is here.",
            "One summer night in 2026 a snake crept into the garden. It found a crack in the old wall — a key lying where it should not — and began to carve into the rings fruit that had never grown. A false harvest. Money from nothing — precisely the disease the tree had come to heal.",
            "And now pay attention, because this is where the character of the story shows.",
            "The gardeners found the snake. And they did not do what the castle does — they did not hide it, rename it, or hire a herald to trumpet that all was well.",
            "They did three things, in this order:",
            "1. They said it out loud. They wrote a public record of how the snake got in, what it damaged, and whose fault it was.",
            "2. They burned the infected wood. The whole tree, down to the root. They replaced every key, every lock, every crack in the wall.",
            "3. They planted again. From the same seed, with the same rules — but with harder bark, in which every entry now had to prove its signature and every expenditure its origin.",
            "The merchants in town shook their heads: They admitted a mistake! Now no one will trust them!",
            "The exact opposite happened. Because the people of the lower town had known castles all their lives and knew one thing: an institution that never admits a mistake is mistaken all the time. A garden that burns its own tree to save the truth is the first place in this town where truth weighs more than reputation.",
            "The new tree grows to this day. And the scar from the fire is not a disgrace — it is the ring shown to visitors first.",
        ])
        pdf.chronicle("Chronicle entry — The Snake and the New Root", [
            "In 2026 critical vulnerabilities were found and disclosed (including missing signature verification on P2P account transactions and missing sender-balance validation allowing inflation) plus server and key compromise.",
            "Response: public security disclosure in Ethereum Foundation format (ZION-2026-001 … 005), consensus fix, complete key rotation, and a hard genesis reset (2026-07-06).",
            "New canonical root: 4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e",
            "Since the reset: services active, E2E tests confirmed on the live network, external audit scheduled.",
            "The lesson written into the project's culture: trust is not built by claiming error is impossible — it is built by public repair.",
        ])
        pdf.section_break()

        # Ch 6
        pdf.chapter_heading("Chapter six", "Six branches and a star")
        pdf.story([
            "The tree grew and branched. Not randomly — like a cathedral.",
            "The first branch, lowest and strongest, holds the truth. On it sit the guards with their tally counters, and nothing that has not passed their rules becomes reality. Without this branch everything else is just painting on air.",
            "The second branch stretches bridges into neighboring gardens — so that fruit can travel even where other trees grow, and never forget where it came from. Bridges are beautiful and bridges are dangerous; so on each stand five guards, and the bridge opens only when all agree.",
            "The third branch is sap and nerves — messengers between worlds and a silent watchman who never sleeps and reports when something moves in the night that should not.",
            "The fourth branch is a playground. Yes, a playground — because the gardener knew that people learn most when they play. On this branch a great game is played about cooperation, patience, and nine tiers of consciousness. The game never judges who is a good person. It only offers a mirror.",
            "The fifth branch is only budding and is the most important of all: it will one day carry fruit into real soil — to wells, schools, and communities that ask for help and receive it with an open ledger, not a press release.",
            "And at the very top, above the crown, there is no branch but a star.",
            "Its name is Issobella. It is named after love and it is terribly far away. Some say it is an observatory that will one day fly above the earth. Others say it is only a light toward which the tree straightens its trunk so it does not grow crooked.",
            "Both are true. The star receives its share of every harvest — not because it can already spend it, but so that the garden reminds itself every minute, with every ring: we are not building for this market. We are building for the children not yet born.",
        ])
        pdf.chronicle("Chronicle entry — The Six Layers", [
            "The Issobella fund (5 % of every block) is already filling — the horizon is not an excuse, it is an account that grows.",
        ], table_rows=[
            ["Layer", "Name", "Contents", "Status"],
            ["L1", "Core", "Rust node, pool, miner, PoW, UTXO+account", "LIVE — Mainnet Beta"],
            ["L2", "Bridge & DeFi", "wZION on 6 EVM chains, staking, farming, DAO", "LIVE / BUILDING"],
            ["L3", "WARP & AI", "cross-chain router, ZionDex, AI monitoring", "BUILDING"],
            ["L4", "OASIS", "UE5 + Rust game world, XP, 9 consciousness tiers", "BUILDING"],
            ["L5", "Free World", "humanitarian missions with on-chain impact", "HORIZON (~2030)"],
            ["L6", "Issobella", "orbital research horizon", "HORIZON (2040+)"],
        ])
        pdf.section_break()

        # Ch 7
        pdf.chapter_heading("Chapter seven", "The question the tree cannot yet answer")
        pdf.story([
            "One evening a child sat down beside the gardener and asked the hardest thing:",
            "\"The tree pays those who dig. But grandma doesn't dig. Grandma carries water to the sick and teaches children to read. Why does the tree give her nothing?\"",
            "The gardener was silent for a long time. This was a question where a wrong answer destroys everything.",
            "\"Because,\" he said at last, slowly, \"digging can be measured and cannot be faked. But care… if I decided whose care is real, I would become a castle. If a crowd voted on it, the one who can show off best would win. And if a machine measured it, people would learn to care for the machine, not for grandma's sick.",
            "\"So it can't be done?\"",
            "\"It can. But slowly and backwards. First we learn to measure care for the tree itself — guarding bridges, finding snakes, fixing walls, keeping open books. That can be verified. And when, after many years, it turns out that it works and no one made a throne out of it — only then, maybe, the tree will learn to see grandma's water too.",
            "\"And if it fails?\"",
            "\"Then it stays with digging. Honest digging is better than false holiness. A tree that tried to measure good and got it wrong would be worse than a castle — it would be a castle that thinks it is heaven.\"",
            "The child nodded, the way children nod when they have understood more than they can say.",
            "And above the garden, quietly, Issobella shone.",
        ])
        pdf.chronicle("Chronicle entry — From Proof-of-Work to Proof-of-Care", [
            "Today: ZION is a Proof-of-Work network. Consensus does not validate faith, morality, meditation, or level of consciousness — and it should not. That is a security property, not a deficiency.",
            "Horizon: Proof-of-Care (the Care Protocol) — a way to reward verifiable useful care (network monitoring, anomaly detection, contract audit, transparent humanitarian impact tracking) alongside computational work.",
            "PoC may be activated only when seven conditions are met: cryptographic verifiability, voluntariness, privacy protection, bot-resistance, accessibility, public audit and recall, and no weakening of L1 PoW security until the model is multiply proven.",
            "Technical seeds already exist (NPU mixing in PoW, AI monitoring, care-proof research, Sefirot Vow for validators) — and are honestly documented as work in progress, not finished.",
        ])
        pdf.section_break()

        # Ch 8
        pdf.chapter_heading("Chapter eight", "What it means to return to paradise")
        pdf.story([
            "At the end of fables there is a moral. Here it is.",
            "The people of the town often asked the gardener: \"Do you promise us paradise?\"",
            "And he always answered: \"No. Paradise cannot be promised. Paradise can only be stopped being destroyed.\"",
            "Because paradise — in this fable and outside it — was never a place without work. It was a state where the world renewed itself faster than people could consume it. Where water belonged to thirst and not to a crest. Where knowledge was a well in the square and not a vault. Where a person did not have to choose between survival and conscience.",
            "No angel with a sword drove us out of that paradise. We left on our own, step by step, every time we built another river flowing uphill.",
            "And so we can return to it. Step by step. Block by block.",
            "The tree of life is not a decoration in this fable. It is a manual: roots that do not lie. A trunk that cannot be bought. Sap that flows to all branches. A crown that plays. Fruit that falls even outside the fence. And a star that watches so the tree does not grow crooked.",
            "ZION is not paradise. ZION is gardening tools.",
            "Paradise is you, when you pick them up.",
        ])
        pdf.section_break()

        # Epilogue
        pdf.chapter_heading("Epilogue for the skeptical", "(and good that you are)")
        pdf.story([
            "This fable would not be worth the paper it is printed on if it could not be refuted. It can. Everything essential is public:",
        ])
        pdf.chronicle("What to verify and where", [
            "Do not trust the fable. Verify the chronicle. And when the chronicle holds — then keep telling the fable, because stories that survived the calculator are the most precious thing civilization has.",
        ], table_rows=[
            ["What to verify", "Where"],
            ["Protocol", "zion-v3-node/3.0.5"],
            ["Genesis hash", "4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e"],
            ["Total supply", "144,000,000,000 ZION (emission.rs)"],
            ["Premine", "16,780,000,000 ZION, transparent outputs in block 0"],
            ["89/5/5/1 split", "four-output coinbase, consensus-enforced"],
            ["Base reward", "5,400.067 ZION · 60s block"],
            ["Decade Decay + tail", "−20 %/decade, then 724.784723 ZION/block forever"],
            ["Source code", "github.com/Zion-TerraNova/v3-Mainnet (MIT)"],
            ["Website / Explorer", "zionterranova.com · /explorer"],
            ["Pool", "pool.zionterranova.com:8444"],
            ["Security disclosure", "ZION-2026-001…005, public, EF format"],
        ])
        pdf.ln(6)
        pdf.story([
            "*ZION TerraNova · Fable Edition · written with four books under the root.*",
            "*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*",
        ])
        out_path = "docs/WP-Mainet/Zion-WpLite_EN.pdf"

    pdf.output(out_path)
    size = os.path.getsize(out_path)
    print(f"  generated: {out_path} ({size:,} bytes)")
    return out_path


if __name__ == "__main__":
    print("Generating ZION WpLite PDFs (CZ + EN)...")
    build_pdf("cz")
    build_pdf("en")
    print("Done.")
