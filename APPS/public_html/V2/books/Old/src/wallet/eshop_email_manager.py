"""
ZION eShop Email Manager
=========================
Send beautiful Rasta-themed emails for eshop orders with SMTP.

Features:
- Rasta gradient theme emails
- Order confirmation
- Payment instructions
- Shipping notifications
- Template variable replacement
- SMTP with retry logic

Author: ZION Team
Created: 2025-12-09
"""

import os
import sys
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.utils import formataddr
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime
from dataclasses import dataclass

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class EmailConfig:
    """SMTP configuration."""
    smtp_host: str = "smtp.forpsi.com"
    smtp_port: int = 587
    smtp_user: str = "shop@newearth.cz"
    smtp_password: str = ""  # Set via env or config
    sender_email: str = "shop@newearth.cz"
    sender_name: str = "ZION eShop"
    support_email: str = "admin@newearth.cz"
    shop_url: str = "https://newearth.cz/V2"


@dataclass
class OrderItem:
    """Order line item."""
    name: str
    quantity: int
    price: float
    total: float
    sku: Optional[str] = None
    image_url: Optional[str] = None


@dataclass
class OrderData:
    """Complete order information."""
    order_id: str
    customer_name: str
    customer_email: str
    order_date: str
    total_price: float
    items: List[OrderItem]
    payment_method: str
    payment_status: str
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = None
    shipping_cost: float = 0.0
    notes: Optional[str] = None
    zion_tokens: Optional[int] = None  # Total ZION token bonus
    zion_wallet_id: Optional[str] = None  # Wallet ID (zw_...)
    zion_wallet_address: Optional[str] = None  # Blockchain address (zion1...)
    zion_mnemonic: Optional[str] = None  # 12-word seed phrase for wallet recovery
    zion_qr_url: Optional[str] = None  # URL to QR code image


class EshopEmailManager:
    """Manage eshop order emails with Rasta theme."""
    
    def __init__(self, config: Optional[EmailConfig] = None):
        """Initialize email manager.
        
        Args:
            config: Email configuration (uses defaults if not provided)
        """
        self.config = config or EmailConfig()
        
        # Load SMTP password from environment if not set
        if not self.config.smtp_password:
            self.config.smtp_password = os.getenv('ZION_SMTP_PASSWORD', '')
        
        # Template directory - detect if running from project root or server
        # Server: /home/html/newearth.cz/public_html/V2/src/wallet/eshop_email_manager.py
        # Local: /path/to/project/src/wallet/eshop_email_manager.py
        current_path = Path(__file__).resolve()
        
        # Find the V2 directory (go up until we find it or hit root)
        v2_dir = None
        for parent in current_path.parents:
            if parent.name == 'V2' and (parent / 'email-templates').exists():
                v2_dir = parent
                break
        
        if v2_dir:
            # Found V2 directory with email-templates
            self.template_dir = v2_dir / "email-templates"
        else:
            # Fallback - assume local development structure
            self.template_dir = current_path.parent.parent.parent / "public_html" / "V2" / "email-templates"
        
        logger.info(f"Template directory: {self.template_dir}")
    
    def _load_template(self, template_name: str) -> str:
        """Load email template from file.
        
        Args:
            template_name: Name of template file
            
        Returns:
            Template HTML content
        """
        template_path = self.template_dir / template_name
        
        if not template_path.exists():
            logger.error(f"Template not found: {template_path}")
            raise FileNotFoundError(f"Email template not found: {template_name}")
        
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def _format_order_items_html(self, items: List[OrderItem]) -> str:
        """Format order items as HTML table.
        
        Args:
            items: List of order items
            
        Returns:
            HTML table with items
        """
        html = '<table width="100%" cellpadding="10" cellspacing="0">'
        
        for item in items:
            html += f'''
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="color: #fff; font-size: 15px; padding: 14px 0;">
                    <strong>{item.name}</strong>
                    {f'<br><span style="color: #999; font-size: 13px;">SKU: {item.sku}</span>' if item.sku else ''}
                </td>
                <td style="color: #9af59a; font-size: 15px; text-align: center; padding: 14px 0;">
                    {item.quantity}×
                </td>
                <td style="color: #FFD700; font-size: 16px; text-align: right; padding: 14px 0; font-weight: 600;">
                    {item.total:,.2f} Kč
                </td>
            </tr>
            '''
        
        html += '</table>'
        return html
    
    def _format_shipping_info_html(self, order: OrderData) -> str:
        """Format shipping information HTML.
        
        Args:
            order: Order data
            
        Returns:
            HTML shipping info section (or empty if no shipping)
        """
        if not order.shipping_address:
            return ''
        
        # Format address (replace newlines outside f-string for Python 3.10 compatibility)
        formatted_address = order.shipping_address.replace('\n', '<br>')
        
        return f'''
        <div style="background: linear-gradient(145deg, rgba(255,215,0,0.12), rgba(0,0,0,0.35)); border: 2px solid rgba(255,215,0,0.25); border-radius: 18px; padding: 32px; margin-bottom: 36px; box-shadow: inset 0 2px 8px rgba(255,215,0,0.08);">
            <h3 style="color: #FFD700; margin: 0 0 20px 0; font-size: 22px; text-align: center; letter-spacing: 1px; font-weight: 700;">
                📦 Dodací adresa
            </h3>
            <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,215,0,0.2); color: #fff; font-size: 15px; line-height: 1.7;">
                {formatted_address}
                {f'<br><br><strong style="color: #9af59a;">Způsob doručení:</strong> {order.shipping_method}' if order.shipping_method else ''}
                {f'<br><strong style="color: #FFD700;">Poštovné:</strong> {order.shipping_cost:,.2f} Kč' if order.shipping_cost > 0 else ''}
            </div>
        </div>
        '''
    
    def _get_payment_status_color(self, status: str) -> str:
        """Get color for payment status badge.
        
        Args:
            status: Payment status
            
        Returns:
            CSS color
        """
        status_colors = {
            'zaplaceno': '#00ff7f',
            'paid': '#00ff7f',
            'čeká na platbu': '#FFD700',
            'pending': '#FFD700',
            'zrušeno': '#c01026',
            'cancelled': '#c01026',
            'vráceno': '#999',
            'refunded': '#999'
        }
        return status_colors.get(status.lower(), '#FFD700')
    
    def _get_payment_instructions(self, payment_method: str, payment_status: str, order_id: str = '', total_price: float = 0) -> str:
        """Get payment instructions HTML based on method and status.
        
        Args:
            payment_method: Payment method
            payment_status: Payment status
            order_id: Order ID for variable symbol
            total_price: Total price for payment
            
        Returns:
            HTML with payment instructions
        """
        if payment_status.lower() in ['zaplaceno', 'paid']:
            return '<tr><td colspan="2" style="color: #00ff7f; font-size: 14px; padding-top: 12px; text-align: center;"><strong>✅ Platba přijata</strong></td></tr>'
        
        if payment_method.lower() in ['bankovní převod', 'bank_transfer', 'bank transfer', 'transfer']:
            # Bank account details (Omnity.One s.r.o. / Fio banka)
            account_number = "2901809148/2010"
            iban = "CZ6320100000002901809148"
            
            # Generate QR code URL for SPD format
            amount_str = f"{total_price:.2f}"
            # Clean order_id for variable symbol (numbers only, max 10 digits)
            vs_clean = ''.join(filter(str.isdigit, order_id))[:10] if order_id else ''
            spd_parts = [
                "SPD*1.0",
                f"ACC:{iban}",
                f"AM:{amount_str}",
                "CC:CZK",
                f"MSG:Objednavka {order_id}",
            ]
            if vs_clean:
                spd_parts.append(f"X-VS:{vs_clean}")
            spd_string = "*".join(spd_parts)
            
            # QuickChart QR API
            import urllib.parse
            qr_url = f"https://quickchart.io/qr?text={urllib.parse.quote(spd_string)}&size=200&margin=2"
            
            return f'''
            <tr>
                <td colspan="2" style="padding-top: 16px;">
                    <div style="background: rgba(255,215,0,0.1); border-radius: 8px; padding: 16px; border: 1px solid rgba(255,215,0,0.3);">
                        <p style="color: #FFD700; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">💳 Instrukce k platbě:</p>
                        <table style="width: 100%;">
                            <tr>
                                <td style="vertical-align: top; padding-right: 16px;">
                                    <p style="color: #fff; font-size: 13px; margin: 0; line-height: 1.8;">
                                        <strong>Číslo účtu:</strong> {account_number}<br>
                                        <strong>IBAN:</strong> {iban}<br>
                                        <strong>Variabilní symbol:</strong> {order_id}<br>
                                        <strong>Částka:</strong> {total_price:,.2f} Kč<br>
                                        <strong>Zpráva:</strong> Objednávka {order_id}<br>
                                    </p>
                                </td>
                                <td style="vertical-align: top; text-align: center;">
                                    <img src="{qr_url}" alt="QR platba" style="width: 150px; height: 150px; border-radius: 8px; background: #fff; padding: 4px;">
                                    <p style="color: #9af59a; font-size: 11px; margin: 8px 0 0 0;">Naskenujte v bankovní aplikaci</p>
                                </td>
                            </tr>
                        </table>
                        <p style="color: #9af59a; font-size: 12px; margin: 12px 0 0 0; text-align: center;">
                            Platbu prosím uhraďte do 7 dnů. Po přijetí platby Vás budeme kontaktovat.
                        </p>
                    </div>
                </td>
            </tr>
            '''
        
        return ''
    
    def send_order_confirmation(self, order: OrderData, test_mode: bool = False, invoice_path: Optional[str] = None) -> bool:
        """Send order confirmation email with Rasta theme.
        
        Args:
            order: Order data
            test_mode: If True, print email instead of sending
            invoice_path: Optional path to PDF invoice to attach
            
        Returns:
            True if sent successfully
        """
        try:
            # Load template
            template = self._load_template('eshop-order-confirmation-rasta.html')
            
            # Format order items
            items_html = self._format_order_items_html(order.items)
            
            # Format shipping info
            shipping_html = self._format_shipping_info_html(order)
            
            # Payment status color
            payment_status_color = self._get_payment_status_color(order.payment_status)
            
            # Payment instructions (with order_id and total_price for bank transfer QR)
            payment_instructions = self._get_payment_instructions(
                order.payment_method, 
                order.payment_status,
                order.order_id,
                order.total_price
            )
            
            # Processing info
            if order.payment_status.lower() in ['zaplaceno', 'paid']:
                processing_info = "Vaši objednávku nyní zpracováváme a připravujeme k odeslání"
                delivery_info = "Očekávaná dodací lhůta 3-5 pracovních dnů"
            else:
                processing_info = "Po obdržení platby začneme okamžitě zpracovávat Vaši objednávku"
                delivery_info = "Po zaplacení očekávaná dodací lhůta 3-5 pracovních dnů"
            
            # Replace template variables
            html_content = template.replace('{{ORDER_ID}}', order.order_id)
            html_content = html_content.replace('{{CUSTOMER_NAME}}', order.customer_name)
            html_content = html_content.replace('{{CUSTOMER_EMAIL}}', order.customer_email)
            html_content = html_content.replace('{{ORDER_DATE}}', order.order_date)
            html_content = html_content.replace('{{TOTAL_PRICE}}', f'{order.total_price:,.2f}')
            html_content = html_content.replace('{{ORDER_ITEMS}}', items_html)
            html_content = html_content.replace('{{SHIPPING_INFO}}', shipping_html)
            html_content = html_content.replace('{{PAYMENT_METHOD}}', order.payment_method)
            html_content = html_content.replace('{{PAYMENT_STATUS}}', order.payment_status)
            html_content = html_content.replace('{{PAYMENT_STATUS_COLOR}}', payment_status_color)
            html_content = html_content.replace('{{PAYMENT_INSTRUCTIONS}}', payment_instructions)
            html_content = html_content.replace('{{PROCESSING_INFO}}', processing_info)
            html_content = html_content.replace('{{DELIVERY_INFO}}', delivery_info)
            html_content = html_content.replace('{{SUPPORT_EMAIL}}', self.config.support_email)
            html_content = html_content.replace('{{SHOP_URL}}', self.config.shop_url)
            html_content = html_content.replace('{{UNSUBSCRIBE_URL}}', f'{self.config.shop_url}/unsubscribe')
            
            # Replace ZION token variables (format tokens with thousands separator)
            zion_tokens_display = f'{order.zion_tokens:,}' if order.zion_tokens else '0'
            zion_wallet_id_display = order.zion_wallet_id or 'N/A'
            zion_wallet_address_display = order.zion_wallet_address or 'N/A'
            zion_mnemonic_display = order.zion_mnemonic or 'N/A'
            
            # QR Code section (if URL exists)
            if order.zion_qr_url:
                qr_section = f'''
        <div style="text-align: center; margin: 24px 0; padding: 20px; background: #0a0a0a; border-radius: 16px; border: 2px solid rgba(255,215,0,0.3);">
            <p style="color: #FFD700; font-size: 16px; font-weight: bold; margin: 0 0 15px 0;">
                📱 QR Kód pro Import do Mobilní Peněženky
            </p>
            <img src="{order.zion_qr_url}" 
                 alt="ZION Wallet QR Code" 
                 style="width: 280px; max-width: 100%; height: auto; border-radius: 12px; border: 3px solid #FFD700; background: #fff;" />
            <p style="color: #00ff7f; font-size: 13px; margin: 15px 0 5px 0;">
                ✅ Naskenujte v ZION Mobile Wallet aplikaci
            </p>
            <p style="color: #888; font-size: 11px; margin: 0;">
                QR kód obsahuje váš 12-slovní seed phrase pro obnovení peněženky
            </p>
        </div>'''
            else:
                qr_section = ''
            
            html_content = html_content.replace('{{ZION_TOKENS}}', zion_tokens_display)
            html_content = html_content.replace('{{ZION_WALLET_ID}}', zion_wallet_id_display)
            html_content = html_content.replace('{{ZION_WALLET_ADDRESS}}', zion_wallet_address_display)
            html_content = html_content.replace('{{ZION_MNEMONIC}}', zion_mnemonic_display)
            html_content = html_content.replace('{{QR_CODE_SECTION}}', qr_section)
            
            # Create email message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f'✅ ZION eShop - Potvrzení objednávky #{order.order_id}'
            msg['From'] = formataddr((self.config.sender_name, self.config.sender_email))
            msg['To'] = order.customer_email
            msg['Reply-To'] = self.config.support_email
            
            # Attach HTML
            msg.attach(MIMEText(html_content, 'html', 'utf-8'))
            
            # Attach invoice PDF if provided
            if invoice_path and os.path.exists(invoice_path):
                try:
                    with open(invoice_path, 'rb') as pdf_file:
                        pdf_attachment = MIMEApplication(pdf_file.read(), _subtype='pdf')
                        pdf_filename = f'faktura_{order.order_id}.pdf'
                        pdf_attachment.add_header('Content-Disposition', 'attachment', filename=pdf_filename)
                        msg.attach(pdf_attachment)
                        logger.info(f"Attached invoice: {pdf_filename}")
                except Exception as e:
                    logger.error(f"Failed to attach invoice {invoice_path}: {e}")
            
            if test_mode:
                logger.info("=" * 80)
                logger.info("TEST MODE - Email would be sent:")
                logger.info(f"From: {msg['From']}")
                logger.info(f"To: {msg['To']}")
                logger.info(f"Subject: {msg['Subject']}")
                logger.info("=" * 80)
                return True
            
            # Send via SMTP
            with smtplib.SMTP(self.config.smtp_host, self.config.smtp_port) as server:
                server.starttls()
                server.login(self.config.smtp_user, self.config.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Order confirmation sent to {order.customer_email} for order {order.order_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send order confirmation: {e}")
            return False


def create_test_order() -> OrderData:
    """Create test order data for testing."""
    return OrderData(
        order_id="ZION_TEST_001",
        customer_name="Rasta Testovací",
        customer_email="test@newearth.cz",
        order_date=datetime.now().strftime("%d.%m.%Y %H:%M"),
        total_price=1599.00,
        items=[
            OrderItem(
                name="ZION T-Shirt - Rasta Edition",
                quantity=2,
                price=499.00,
                total=998.00,
                sku="ZION-TSHIRT-RASTA-L"
            ),
            OrderItem(
                name="ZION Logo Cap",
                quantity=1,
                price=299.00,
                total=299.00,
                sku="ZION-CAP-001"
            ),
            OrderItem(
                name="ZION Sticker Pack",
                quantity=1,
                price=99.00,
                total=99.00,
                sku="ZION-STICKERS-PACK"
            ),
        ],
        payment_method="Bankovní převod",
        payment_status="Čeká na platbu",
        shipping_address="Rasta Testovací\nZionova 42\n120 00 Praha 2\nČeská republika",
        shipping_method="Česká pošta - Balík na poštu",
        shipping_cost=99.00,
        notes="Prosím zabalit jako dárek"
    )


if __name__ == "__main__":
    # Test email sending
    logger.info("🧪 Testing ZION eShop email system...")
    
    email_manager = EshopEmailManager()
    test_order = create_test_order()
    
    # Send test email (test mode = just print)
    success = email_manager.send_order_confirmation(test_order, test_mode=True)
    
    if success:
        logger.info("✅ Email test passed!")
    else:
        logger.error("❌ Email test failed!")
