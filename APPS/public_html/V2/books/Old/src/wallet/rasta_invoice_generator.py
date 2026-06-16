"""
ZION eShop - Rasta Invoice Generator
=====================================
Generuje PDF faktury s Rasta-themed designem a Omnity.One logem.

Features:
- Rasta gradient borders (Green → Gold → Red)
- Professional invoice layout
- QR code for payment
- Company branding
- PDF generation via ReportLab

Author: ZION Team
Created: 2025-12-09
"""

import os
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from dataclasses import dataclass

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm, cm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate,
        Table,
        TableStyle,
        Paragraph,
        Spacer,
        Image as RLImage,
        PageBreak,
    )
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
    from reportlab.lib.utils import ImageReader
    try:
        from PIL import Image as PILImage
    except Exception:
        PILImage = None
    import qrcode
    from io import BytesIO
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    print("⚠️  ReportLab not installed. Install with: pip install reportlab qrcode")


# Rasta colors
RASTA_GREEN = colors.HexColor('#1c7b1c')
RASTA_GOLD = colors.HexColor('#FFD700')
RASTA_RED = colors.HexColor('#c01026')
DARK_BG = colors.HexColor('#1a1a1a')
LIGHT_TEXT = colors.HexColor('#ffffff')


@dataclass
class InvoiceItem:
    """Invoice line item.
    
    NOTE: unit_price is the FINAL price INCLUDING VAT (as displayed in e-shop).
    The invoice decomposes it into base + VAT for tax purposes.
    """
    name: str
    quantity: int
    unit_price: float  # Cena S DPH (konečná cena z e-shopu)
    vat_rate: float = 0.21  # 21% DPH
    
    @property
    def total_with_vat(self) -> float:
        """Total price WITH VAT (= unit_price * quantity, the amount customer pays)."""
        return self.quantity * self.unit_price
    
    @property
    def total_without_vat(self) -> float:
        """Total price WITHOUT VAT (base for tax calculation)."""
        return round(self.total_with_vat / (1 + self.vat_rate), 2)
    
    @property
    def vat_amount(self) -> float:
        """VAT amount."""
        return round(self.total_with_vat - self.total_without_vat, 2)


@dataclass
class CompanyInfo:
    """Company information."""
    name: str = "Omnity.One s.r.o."
    ico: str = "09120050"
    dic: str = "CZ09120050"
    address: str = "Horní Čermná"
    city: str = "561 56"
    country: str = "Česká republika"
    bank_account: str = "2901809148 / 2010"
    iban: str = "CZ63 2010 0000 0029 0180 9148"
    swift: str = "FIOBCZPPXXX"
    email: str = "admin@newearth.cz"
    web: str = "https://zionterranova.com"


@dataclass
class InvoiceData:
    """Complete invoice data."""
    invoice_number: str
    order_id: str
    issue_date: str
    due_date: str
    customer_name: str
    customer_address: str
    customer_ico: Optional[str] = None
    customer_dic: Optional[str] = None
    items: List[InvoiceItem] = None
    payment_method: str = "Bankovní převod"
    variable_symbol: Optional[str] = None
    notes: Optional[str] = None
    
    def __post_init__(self):
        if self.items is None:
            self.items = []
        if self.variable_symbol is None:
            self.variable_symbol = self.invoice_number.replace('/', '')
    
    @property
    def subtotal(self) -> float:
        """Total without VAT (tax base)."""
        return round(sum(item.total_without_vat for item in self.items), 2)
    
    @property
    def vat_total(self) -> float:
        """Total VAT amount."""
        return round(sum(item.vat_amount for item in self.items), 2)
    
    @property
    def total(self) -> float:
        """Total with VAT (= what customer pays)."""
        return round(sum(item.total_with_vat for item in self.items), 2)


class RastaInvoiceGenerator:
    """Generate Rasta-themed PDF invoices."""
    
    def __init__(self, logo_path: Optional[str] = None):
        """Initialize invoice generator.
        
        Args:
            logo_path: Path to company logo (Omnity.One)
        """
        if not REPORTLAB_AVAILABLE:
            raise ImportError("ReportLab required. Install: pip install reportlab qrcode")
        
        # Auto-detect logo if not provided
        if logo_path is None:
            logo_candidates = [
                "/home/html/newearth.cz/public_html/V2/img/logo144.png",
                "/home/html/newearth.cz/public_html/images/logo144.png",
                Path(__file__).parent.parent.parent / "public_html" / "V2" / "img" / "logo144.png",
                Path(__file__).parent.parent.parent / "Logo" / "zion_logo.png",
            ]
            for candidate in logo_candidates:
                candidate_path = Path(candidate) if not isinstance(candidate, Path) else candidate
                if candidate_path.exists():
                    logo_path = str(candidate_path)
                    break
        
        resolved_logo = str(logo_path) if logo_path else None
        if resolved_logo and not os.path.exists(resolved_logo):
            resolved_logo = None
        self.logo_path = resolved_logo
        self.company = CompanyInfo()
        self.base_font = 'Helvetica'
        self.bold_font = 'Helvetica-Bold'
        self._register_fonts()
        self.styles = getSampleStyleSheet()
        self._setup_styles()

    def _register_fonts(self):
        """Register Unicode-capable font to fix diacritics rendering."""
        project_root = Path(__file__).parent.parent.parent
        bundled_fonts = project_root / "public_html" / "V2" / "assets" / "fonts"
        font_candidates = [
            ("ZionDejaVu", bundled_fonts / "DejaVuSans.ttf", bundled_fonts / "DejaVuSans-Bold.ttf"),
            ("DejaVuSans", Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
            ("LiberationSans", Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"), Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf")),
            ("ArialUnicode", Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"), None),
            ("ArialUnicodeWin", Path("C:/Windows/Fonts/arialuni.ttf"), None),
        ]
        
        for font_name, regular_path, bold_path in font_candidates:
            regular_path = Path(regular_path)
            if not regular_path.exists():
                continue
            try:
                pdfmetrics.registerFont(TTFont(font_name, str(regular_path)))
                if bold_path:
                    bold_path = Path(bold_path)
                    if bold_path.exists():
                        pdfmetrics.registerFont(TTFont(f"{font_name}-Bold", str(bold_path)))
                        self.bold_font = f"{font_name}-Bold"
                    else:
                        self.bold_font = font_name
                else:
                    self.bold_font = font_name
                self.base_font = font_name
                return
            except Exception as exc:
                print(f"⚠️  Failed to register font {font_name}: {exc}", file=sys.stderr)
        
        print("⚠️  Using default Helvetica font (diacritics may be limited)", file=sys.stderr)
    
    def _setup_styles(self):
        """Setup custom paragraph styles."""
        # Use Czech font if available, otherwise Helvetica-Bold
        bold_font = getattr(self, 'bold_font', 'Helvetica-Bold')
            
        # Title style - kompaktnější
        self.styles.add(ParagraphStyle(
            name='RastaTitle',
            parent=self.styles['Heading1'],
            fontSize=22,
            textColor=RASTA_GOLD,
            alignment=TA_CENTER,
            spaceAfter=4,
            fontName=bold_font
        ))
        
        # Subtitle style - kompaktnější
        self.styles.add(ParagraphStyle(
            name='RastaSubtitle',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=RASTA_GREEN,
            alignment=TA_CENTER,
            spaceAfter=8,
            fontName=bold_font
        ))
        
        # Header style - menší
        self.styles.add(ParagraphStyle(
            name='RastaHeader',
            parent=self.styles['Heading2'],
            fontSize=10,
            textColor=RASTA_GOLD,
            fontName=bold_font,
            spaceAfter=3
        ))
        
        # Normal text - menší
        self.styles.add(ParagraphStyle(
            name='RastaText',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.black,
            fontName=self.base_font
        ))
        
        # Small text
        self.styles.add(ParagraphStyle(
            name='RastaSmall',
            parent=self.styles['Normal'],
            fontSize=7,
            textColor=colors.grey,
            fontName=self.base_font
        ))
    
    def generate(self, invoice: InvoiceData, output_path: str) -> str:
        """Generate PDF invoice.
        
        Args:
            invoice: Invoice data
            output_path: Path to save PDF
            
        Returns:
            Path to generated PDF
        """
        # Create PDF document - menší marginy pro single-page
        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=2.5*cm,  # Více místa pro Rasta border
            bottomMargin=2.5*cm  # Více místa pro Rasta border
        )
        
        # Build content
        story = []
        
        # HEADER: Logo + Company Name v řádku (robustní načtení loga)
        def _load_logo_flowable(target_w_mm: float, target_h_mm: float) -> Optional[RLImage]:
            if not (self.logo_path and os.path.exists(self.logo_path)):
                return None
            # 1) Zkusit Pillow (řeší PNG/alpha spolehlivě)
            if PILImage is not None:
                try:
                    img = PILImage.open(self.logo_path)
                    # Pokud má průhlednost, správně ji sloučíme s bílým pozadím
                    has_alpha = (
                        img.mode in ('RGBA', 'LA') or (
                            img.mode == 'P' and 'transparency' in getattr(img, 'info', {})
                        )
                    )
                    if has_alpha:
                        img = img.convert('RGBA')
                        white_bg = PILImage.new('RGBA', img.size, (255, 255, 255, 255))
                        white_bg.paste(img, (0, 0), img)
                        img = white_bg.convert('RGB')
                    else:
                        img = img.convert('RGB')
                    buf = BytesIO()
                    # PNG bez alfy (už sloučeno na bílé) zachová kvalitu a ostré hrany
                    img.save(buf, format='PNG')
                    buf.seek(0)
                    return RLImage(buf, width=target_w_mm*mm, height=target_h_mm*mm)
                except Exception as e:
                    print(f"⚠️  PIL logo load failed: {e}", file=sys.stderr)
            # 2) Fallback přes ImageReader
            try:
                ir = ImageReader(self.logo_path)
                return RLImage(ir, width=target_w_mm*mm, height=target_h_mm*mm)
            except Exception as e:
                print(f"⚠️  ImageReader logo load failed: {e}", file=sys.stderr)
                return None

        header_data = []
        logo_flow = _load_logo_flowable(32.0, 32.0)  # 32mm, vejde se do 3.5cm sloupce
        if logo_flow is not None:
            header_data = [[
                logo_flow,
                Paragraph(f"""
                    <font size="16" color="#1c7b1c"><b>{self.company.name}</b></font><br/>
                    <font size="9">ZION Terra Nova | Peace & One Love ☮️❤️</font>
                """, self.styles['RastaText']),
                Paragraph(f"""
                    <font size="18" color="#FFD700"><b>FAKTURA</b></font><br/>
                    <font size="12" color="#1c7b1c"><b>#{invoice.invoice_number}</b></font>
                """, ParagraphStyle('InvoiceTitle', parent=self.styles['Normal'], alignment=TA_RIGHT, fontName=self.bold_font))
            ]]
            header_table = Table(header_data, colWidths=[3.5*cm, 8.5*cm, 6*cm])
        else:
            header_data = [[
                Paragraph(f"""
                    <font size="16" color="#1c7b1c"><b>{self.company.name}</b></font><br/>
                    <font size="9">ZION Terra Nova</font>
                """, self.styles['RastaText']),
                Paragraph(f"""
                    <font size="18" color="#FFD700"><b>FAKTURA</b></font><br/>
                    <font size="12" color="#1c7b1c"><b>#{invoice.invoice_number}</b></font>
                """, ParagraphStyle('InvoiceTitle', parent=self.styles['Normal'], alignment=TA_RIGHT, fontName=self.bold_font))
            ]]
            header_table = Table(header_data, colWidths=[12*cm, 6*cm])
        
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (-1, 0), (-1, 0), 'RIGHT'),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 4*mm))
        
        # Company a customer info - vedle sebe
        story.append(self._create_compact_info_table(invoice))
        story.append(Spacer(1, 4*mm))
        
        # Items table
        story.append(self._create_items_table(invoice))
        story.append(Spacer(1, 3*mm))
        
        # Totals
        story.append(self._create_totals_table(invoice))
        story.append(Spacer(1, 4*mm))
        
        # Payment s QR
        if invoice.payment_method.lower() in ['bankovní převod', 'bank_transfer', 'bank transfer']:
            story.append(self._create_payment_with_qr(invoice))
        else:
            story.append(self._create_payment_info(invoice))
        
        story.append(Spacer(1, 2*mm))
        
        # Footer
        story.append(self._create_footer())
        
        # Build PDF s Rasta borderem
        doc.build(story, onFirstPage=self._draw_rasta_border, onLaterPages=self._draw_rasta_border)
        
        return output_path
    
    def _create_rasta_header(self):
        """Create Rasta gradient header."""
        # Note: ReportLab doesn't support gradients easily, so we use colored lines
        data = [['']]
        table = Table(data, colWidths=[17*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), RASTA_GREEN),
            ('LINEABOVE', (0, 0), (-1, -1), 3, RASTA_GOLD),
            ('LINEBELOW', (0, 0), (-1, -1), 3, RASTA_RED),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        return table
    
    def _create_header_with_logo(self):
        """Create header with logo and company name side by side."""
        data = []
        
        if self.logo_path and os.path.exists(self.logo_path):
            logo = RLImage(self.logo_path, width=25*mm, height=25*mm)
            company_text = Paragraph(f"""
                <font size="14" color="#1c7b1c"><b>{self.company.name}</b></font><br/>
                <font size="8" color="#666">ZION Terra Nova | Peace & One Love ☮️❤️</font>
            """, self.styles['RastaText'])
            data = [[logo, company_text]]
        else:
            company_text = Paragraph(f"""
                <font size="14" color="#1c7b1c"><b>{self.company.name}</b></font><br/>
                <font size="8" color="#666">ZION Terra Nova | Peace & One Love ☮️❤️</font>
            """, self.styles['RastaText'])
            data = [[company_text]]
        
        table = Table(data, colWidths=[4*cm, 14*cm] if len(data[0]) == 2 else [18*cm])
        table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'LEFT') if len(data[0]) == 2 else ('ALIGN', (0, 0), (0, 0), 'CENTER'),
        ]))
        
        return table
    
    def _create_compact_info_table(self, invoice: InvoiceData):
        """Kompaktní info table - všechny údaje na jednom místě."""
        customer_addr = invoice.customer_address.replace('\n', ', ')
        
        data = [
            # Dodavatel a Odběratel vedle sebe
            [
                Paragraph("<font size='9' color='#1c7b1c'><b>DODAVATEL:</b></font>", self.styles['RastaText']),
                Paragraph("<font size='9' color='#1c7b1c'><b>ODBĚRATEL:</b></font>", self.styles['RastaText']),
            ],
            [
                Paragraph(f"""
                    <font size='8'>
                    <b>{self.company.name}</b><br/>
                    {self.company.address}, {self.company.city}<br/>
                    IČO: {self.company.ico}, DIČ: {self.company.dic}<br/>
                    {self.company.email}
                    </font>
                """, self.styles['RastaText']),
                Paragraph(f"""
                    <font size='8'>
                    <b>{invoice.customer_name}</b><br/>
                    {customer_addr}
                    {f'<br/>IČO: {invoice.customer_ico}' if invoice.customer_ico else ''}
                    {f', DIČ: {invoice.customer_dic}' if invoice.customer_dic else ''}
                    </font>
                """, self.styles['RastaText'])
            ],
            # Faktura details
            [
                Paragraph(f"""
                    <font size='8'>
                    <b>Datum vystavení:</b> {invoice.issue_date} | 
                    <b>Splatnost:</b> {invoice.due_date}<br/>
                    <b>Číslo objednávky:</b> {invoice.order_id}
                    </font>
                """, self.styles['RastaText']),
                Paragraph(f"""
                    <font size='8'>
                    <b>Způsob platby:</b> {invoice.payment_method}<br/>
                    <b>Variabilní symbol:</b> {invoice.variable_symbol}
                    </font>
                """, self.styles['RastaText'])
            ]
        ]
        
        table = Table(data, colWidths=[9*cm, 9*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f0f0')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        return table
    
    def _create_items_table(self, invoice: InvoiceData):
        """Create items table - kompaktní."""
        # Headers with colored text (no background, avoids black boxes)
        header_style = ParagraphStyle(
            'HeaderStyle',
            parent=self.styles['RastaText'],
            textColor=RASTA_GREEN,
            fontName=self.bold_font,
            fontSize=9
        )
        
        # Headers - green text, no background
        data = [[
            Paragraph("<b>Položka</b>", header_style),
            Paragraph("<b>Ks</b>", header_style),
            Paragraph("<b>Cena/ks</b>", header_style),
            Paragraph("<b>Bez DPH</b>", header_style),
            Paragraph("<b>DPH 21%</b>", header_style),
            Paragraph("<b>S DPH</b>", header_style),
        ]]
        
        # Items with black text
        for item in invoice.items:
            data.append([
                Paragraph(item.name, self.styles['RastaText']),
                Paragraph(str(item.quantity), self.styles['RastaText']),
                Paragraph(f"{item.unit_price:,.2f} Kč", self.styles['RastaText']),
                Paragraph(f"{item.total_without_vat:,.2f} Kč", self.styles['RastaText']),
                Paragraph(f"{item.vat_amount:,.2f} Kč", self.styles['RastaText']),
                Paragraph(f"<b>{item.total_with_vat:,.2f} Kč</b>", self.styles['RastaText']),
            ])
        
        table = Table(data, colWidths=[6*cm, 1.5*cm, 2*cm, 2.5*cm, 2.5*cm, 2.5*cm])
        table.setStyle(TableStyle([
            # Light gray background for header row instead of green
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f5f5f5')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('LINEBELOW', (0, 0), (-1, 0), 2, RASTA_GOLD),  # Gold line under header
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        return table
    
    def _create_totals_table(self, invoice: InvoiceData):
        """Create totals table - kompaktní."""
        data = [
            [
                Paragraph("<b>Celkem bez DPH:</b>", self.styles['RastaText']),
                Paragraph(f"<b>{invoice.subtotal:,.2f} Kč</b>", self.styles['RastaText'])
            ],
            [
                Paragraph("<b>DPH 21%:</b>", self.styles['RastaText']),
                Paragraph(f"<b>{invoice.vat_total:,.2f} Kč</b>", self.styles['RastaText'])
            ],
            [
                Paragraph("<font size='11' color='#FFD700'><b>CELKEM K ÚHRADĚ:</b></font>", self.styles['RastaText']),
                Paragraph(f"<font size='11' color='#FFD700'><b>{invoice.total:,.2f} Kč</b></font>", self.styles['RastaText'])
            ]
        ]
        
        table = Table(data, colWidths=[13*cm, 5*cm], hAlign='RIGHT')
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LINEABOVE', (0, 2), (-1, 2), 2, RASTA_GOLD),
            ('LINEBELOW', (0, 2), (-1, 2), 2, RASTA_GOLD),
        ]))
        
        return table
    
    def _generate_qr_code(self, invoice: InvoiceData) -> Optional[RLImage]:
        """Generate QR code for bank transfer (Czech QR payment standard).
        
        Args:
            invoice: Invoice data
            
        Returns:
            ReportLab Image with QR code or None if generation fails
        """
        try:
            # Czech QR payment format (SPD - Short Payment Descriptor)
            # Format: SPD*1.0*ACC:CZ63201000000029018091 48*AM:1689.16*CC:CZK*MSG:Faktura 202512091234*X-VS:202512091234
            iban = self.company.iban.replace(' ', '')
            # VS musí být numerický, max 10 znaků (banky jinak QR ignorují)
            vs_raw = invoice.variable_symbol or ''
            vs_clean = ''.join(ch for ch in str(vs_raw) if ch.isdigit())
            if len(vs_clean) > 10:
                vs_clean = vs_clean[-10:]
            if not vs_clean:
                # fallback: použij čísla z invoice_number nebo timestamp
                inv_digits = ''.join(ch for ch in invoice.invoice_number if ch.isdigit())
                vs_clean = (inv_digits[-10:] if inv_digits else datetime.now().strftime('%d%m%H%M%S')[-10:])
            # Zpráva: odstranit diakritiku, nepovolené znaky a limitovat délku
            def _strip_diacritics(s: str) -> str:
                nfkd = unicodedata.normalize('NFKD', s)
                return ''.join(c for c in nfkd if not unicodedata.combining(c))
            raw_msg = f"Faktura {invoice.invoice_number}"
            msg = _strip_diacritics(raw_msg)
            msg = msg.replace('*', ' ')  # hvězdička je oddělovač v SPD
            # ponecháme pouze běžné tisknutelné ASCII
            allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;-_#/@()[]{}+")
            msg = ''.join(ch for ch in msg if ch in allowed)
            if len(msg) > 60:
                msg = msg[:60]
            # Příjemce (RN): bez diakritiky a bez hvězdiček
            rn_raw = self.company.name
            rn = _strip_diacritics(rn_raw).replace('*', ' ')
            rn = ''.join(ch for ch in rn if ch in allowed)
            if len(rn) > 35:
                rn = rn[:35]
            # Datum splatnosti ve formátu YYYYMMDD, pokud k dispozici
            dt = None
            try:
                # invoice.due_date může být 'YYYY-MM-DD' nebo 'DD.MM.YYYY'
                dd = invoice.due_date
                if '-' in dd:
                    # YYYY-MM-DD
                    dt = dd.replace('-', '')
                elif '.' in dd:
                    # DD.MM.YYYY -> YYYYMMDD
                    parts = dd.split('.')
                    if len(parts) >= 3 and parts[2]:
                        dt = parts[2] + parts[1].zfill(2) + parts[0].zfill(2)
            except Exception:
                dt = None
            # Alternativní účet v domácím formátu (ALT-ACC)
            alt_acc = None
            try:
                # očekáváme formát "2901809148 / 2010" nebo "2901809148/2010"
                ba = self.company.bank_account.replace(' ', '')
                if '/' in ba:
                    alt_acc = ba
            except Exception:
                alt_acc = None
            amount = f"{invoice.total:.2f}"
            # Sestavení SPD s volitelnými poli
            fields = [
                "SPD*1.0",
                f"ACC:{iban}",
                f"AM:{amount}",
                "CC:CZK",
                f"X-VS:{vs_clean}",
                f"MSG:{msg}",
                f"RN:{rn}",
            ]
            if dt:
                fields.append(f"DT:{dt}")
            if alt_acc:
                fields.append(f"ALT-ACC:{alt_acc}")
            qr_data = "*".join(fields)
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=None,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=8,
                border=4,
            )
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            # Create image
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to BytesIO for ReportLab
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            
            # Create ReportLab Image
            rl_img = RLImage(buffer, width=35*mm, height=35*mm)
            return rl_img
            
        except Exception as e:
            print(f"⚠️  Failed to generate QR code: {e}")
            return None
    
    def _create_payment_with_qr(self, invoice: InvoiceData):
        """Create payment info with QR code side by side."""
        qr_image = self._generate_qr_code(invoice)
        
        payment_text = Paragraph(f"""
            <font size='10' color='#1c7b1c'><b>Platební údaje / Payment Details:</b></font><br/>
            <b>Číslo účtu:</b> {self.company.bank_account}<br/>
            <b>IBAN:</b> {self.company.iban}<br/>
            <b>SWIFT:</b> {self.company.swift}<br/>
            <b>Variabilní symbol:</b> {invoice.variable_symbol}<br/>
            <b>Částka:</b> {invoice.total:,.2f} Kč<br/>
            <b>Splatnost:</b> {invoice.due_date}<br/>
            <br/>
            <font size='7' color='#666'><i>
            Naskenujte QR kód mobilní bankovní aplikací<br/>
            pro rychlou platbu / Scan QR for quick payment
            </i></font>
        """, self.styles['RastaText'])
        
        if qr_image:
            data = [[payment_text, qr_image]]
            table = Table(data, colWidths=[13*cm, 5*cm])
            table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'CENTER'),
                ('BOX', (0, 0), (-1, -1), 1, RASTA_GREEN),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
        else:
            data = [[payment_text]]
            table = Table(data, colWidths=[18*cm])
            table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOX', (0, 0), (-1, -1), 1, RASTA_GREEN),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ]))
        
        return table
    
    def _create_payment_info(self, invoice: InvoiceData):
        """Create payment information."""
        return Paragraph(f"""
            <font color='#1c7b1c'><b>Platební údaje:</b></font><br/>
            Číslo účtu: {self.company.bank_account}<br/>
            IBAN: {self.company.iban}<br/>
            SWIFT: {self.company.swift}<br/>
            Variabilní symbol: {invoice.variable_symbol}<br/>
            Částka k úhradě: <b>{invoice.total:,.2f} Kč</b><br/>
            Splatnost: {invoice.due_date}
        """, self.styles['RastaText'])
    
    def _create_footer(self):
        """Create invoice footer - kompaktní."""
        return Paragraph(
            "<i>Peace & One Love ☮️❤️ | ZION Terra Nova | www.newearth.cz | Děkujeme za Vaši důvěru!</i>",
            ParagraphStyle(
                'Footer',
                parent=self.styles['Normal'],
                fontSize=7,
                textColor=colors.grey,
                alignment=TA_CENTER,
                fontName=self.base_font
            )
        )
    
    def _draw_rasta_border(self, canvas, doc):
        """Draw Rasta gradient border - nahoře i dole (Zelená, Zlatá, Červená)."""
        canvas.saveState()
        
        # Page dimensions
        width, height = A4
        
        # === TOP BORDER (Green → Gold → Red) ===
        # Zelená nahoře
        canvas.setFillColor(RASTA_GREEN)
        canvas.rect(0, height - 15, width, 15, fill=1, stroke=0)
        
        # Zlatá prostřední
        canvas.setFillColor(RASTA_GOLD)
        canvas.rect(0, height - 25, width, 10, fill=1, stroke=0)
        
        # Červená spodní část top border
        canvas.setFillColor(RASTA_RED)
        canvas.rect(0, height - 32, width, 7, fill=1, stroke=0)
        
        # === BOTTOM BORDER (Red → Gold → Green) ===
        # Červená dole
        canvas.setFillColor(RASTA_RED)
        canvas.rect(0, 0, width, 15, fill=1, stroke=0)
        
        # Zlatá prostřední
        canvas.setFillColor(RASTA_GOLD)
        canvas.rect(0, 15, width, 10, fill=1, stroke=0)
        
        # Zelená horní část bottom border
        canvas.setFillColor(RASTA_GREEN)
        canvas.rect(0, 25, width, 7, fill=1, stroke=0)
        
        canvas.restoreState()


def create_test_invoice() -> InvoiceData:
    """Create test invoice for development."""
    from datetime import datetime, timedelta
    
    issue_date = datetime.now()
    due_date = issue_date + timedelta(days=14)
    
    return InvoiceData(
        invoice_number=f"2025{issue_date.strftime('%m%d%H%M')}",
        order_id=f"ZION_{issue_date.strftime('%Y%m%d_%H%M%S')}",
        issue_date=issue_date.strftime("%d.%m.%Y"),
        due_date=due_date.strftime("%d.%m.%Y"),
        customer_name="Test Zákazník",
        customer_address="Testovací 123\n120 00 Praha 2\nČeská republika",
        items=[
            InvoiceItem(
                name="ZION T-Shirt - Rasta Edition (L)",
                quantity=2,
                unit_price=499.00
            ),
            InvoiceItem(
                name="ZION Logo Cap",
                quantity=1,
                unit_price=299.00
            ),
            InvoiceItem(
                name="Doprava - Česká pošta",
                quantity=1,
                unit_price=99.00
            )
        ],
        payment_method="Bankovní převod",
        notes="Děkujeme za Vaši objednávku!"
    )


if __name__ == "__main__":
    # Test invoice generation
    print("🧪 Testing Rasta Invoice Generator...")
    
    if not REPORTLAB_AVAILABLE:
        print("❌ ReportLab not installed!")
        print("   Install: pip install reportlab")
        exit(1)
    
    # Create test invoice
    test_invoice = create_test_invoice()
    
    # Generate PDF
    output_dir = Path(__file__).parent.parent / "public_html" / "V2" / "invoices"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = output_dir / f"invoice_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    generator = RastaInvoiceGenerator()
    result = generator.generate(test_invoice, str(output_path))
    
    print(f"✅ Invoice generated: {result}")
    print(f"📄 Total: {test_invoice.total:,.2f} Kč (including {test_invoice.vat_total:,.2f} Kč VAT)")
