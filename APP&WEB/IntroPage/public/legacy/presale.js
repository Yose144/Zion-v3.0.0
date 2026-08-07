/**
 * ZION Token Presale - JavaScript
 * Handles package selection, QR generation, and payment processing
 */

// === Configuration ===
const PRESALE_CONFIG = {
    apiBase: './api',
    apiEndpoints: {
        php: {
            presaleOrder: './api/presale-order.php',
            walletLedger: './api/wallet-ledger.php',
            stripeCheckout: './api/stripe-checkout.php'
        },
        python: {
            status: '/presale/status',
            init: '/presale/purchase/init',
            order: (id) => `/presale/order/${id}`,
            statsAdmin: '/presale/stats/admin'
        }
    },
    usePythonForStripe: true,
    stripePublicKey: 'pk_live_51SZiiaPFWMwiTqj6xA1jUJ8UOh1ibb0ZDmqvr5AE9nQsiYfwilyON7zLwjUMuxUgwgBgoKANSEsr7gnmfYcknrY200njapbW7m',
    currency: 'CZK', // CZK pro českou verzi
    tokenPrice: 0.10, // CZK za ZION token (Phase 1: €0.004 = 0.10 Kč)
    tokenPriceEur: 0.004, // EUR za ZION token (Phase 1)
    eurToCzk: 25, // Aktuální kurz
    minAmount: 500, // Min 500 Kč
    maxAmount: 30000, // Max 30000 Kč
    bonusTiers: [
        { min: 0, max: 2489, bonus: 0 },
        { min: 2490, max: 12489, bonus: 0.10 }, // +10% nad 2490 Kč (99 EUR)
        { min: 12490, max: 24989, bonus: 0.20 }, // +20% nad 12490 Kč (499 EUR)
        { min: 24990, max: Infinity, bonus: 0.30 } // +30% nad 24990 Kč (999 EUR)
    ],
    packages: {
        starter: {
            name: 'PIZZA Pack',
            priceCzk: 2490,
            priceEur: 99,
            baseTokens: 24900, // 2490 CZK / 0.10
            bonus: 0.10
        },
        standard: {
            name: 'LAMBO Pack',
            priceCzk: 12490,
            priceEur: 499,
            baseTokens: 124900, // 12490 CZK / 0.10
            bonus: 0.20
        },
        premium: {
            name: 'Guardian Pack',
            priceCzk: 24990,
            priceEur: 999,
            baseTokens: 249900, // 24990 CZK / 0.10
            bonus: 0.30
        }
    }
};

// === State ===
let currentOrder = null;
let stripe = null;

// === Book Cart Functions ===
function addBookToCart() {
    const book = {
        id: 'book-001',
        name: 'Quantová Revoluce & MAINNET ALPHA',
        price: 144,
        priceCzk: 144,
        tokens: 144,
        bonus: 144,
        image: '../images/Zion.jpg',
        quantity: 1
    };
    
    // Get existing cart or create new
    // FIX: Using 'zion_cart' instead of 'zion-cart' to match cart.js
    let cart = JSON.parse(localStorage.getItem('zion_cart') || '[]');
    
    // Check if book already in cart
    const existingIndex = cart.findIndex(item => item.id === book.id);
    if (existingIndex >= 0) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push(book);
    }
    
    // Save cart
    localStorage.setItem('zion_cart', JSON.stringify(cart));
    
    // Update cart badge if exists
    updateCartBadge();
    
    // Show success message
    showBookAddedNotification();
}

function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('zion_cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Update badge if exists
    const badge = document.querySelector('.cart-badge');
    if (badge) {
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

function showBookAddedNotification() {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.innerHTML = `
        <i class="fa-solid fa-check-circle"></i>
        <span>Kniha přidána do košíku!</span>
        <a href="./cart.html" class="view-cart-link">Zobrazit košík</a>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide and remove after 4 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// === Initialize ===
document.addEventListener('DOMContentLoaded', () => {
    initCalculator();
    initModals();
    initPaymentMethodToggle();
    updateCartBadge(); // Update cart badge on load
    
    // Initialize Stripe (only if key is set)
    if (PRESALE_CONFIG.stripePublicKey && !PRESALE_CONFIG.stripePublicKey.includes('XXXX')) {
        stripe = Stripe(PRESALE_CONFIG.stripePublicKey);
    }
    
    // Start live stats polling
    initStatsPolling();
});

// === Calculator ===
function initCalculator() {
    const input = document.getElementById('custom-eur');
    if (!input) return;
    
    input.addEventListener('input', updateCalculator);
    input.addEventListener('change', updateCalculator);
    updateCalculator();
}

function updateCalculator() {
    const input = document.getElementById('custom-eur');
    const tokensEl = document.getElementById('calc-tokens');
    const bonusEl = document.getElementById('calc-bonus');
    const sliderValueDisplay = document.getElementById('slider-value-display');
    const sliderPriceDisplay = document.getElementById('slider-price-display');
    
    if (!input || !tokensEl || !bonusEl) return;
    
    const amount = parseFloat(input.value) || 0;
    
    // Update slider display value (amount in Kč)
    if (sliderValueDisplay) {
        sliderValueDisplay.textContent = formatNumber(amount);
    }
    
    // Calculate tokens for slider price display
    const bonusRate = getBonusRate(amount);
    const baseTokens = Math.floor(amount / PRESALE_CONFIG.tokenPrice);
    const bonusTokens = Math.floor(baseTokens * bonusRate);
    const totalTokens = baseTokens + bonusTokens;
    
    // Update slider price display (tokens)
    if (sliderPriceDisplay) {
        sliderPriceDisplay.textContent = formatNumber(totalTokens);
    }
    
    // Update slider progress bar color
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const percent = ((amount - min) / (max - min)) * 100;
    input.style.setProperty('--slider-percent', `${percent}%`);
    
    tokensEl.textContent = formatNumber(totalTokens);
    bonusEl.textContent = bonusRate > 0 ? `+${Math.round(bonusRate * 100)}% bonus` : '+0% bonus';
    bonusEl.style.color = bonusRate > 0 ? 'var(--rasta-gold)' : '#888';
}

function getBonusRate(eurAmount) {
    for (const tier of PRESALE_CONFIG.bonusTiers) {
        if (eurAmount >= tier.min && eurAmount <= tier.max) {
            return tier.bonus;
        }
    }
    return 0;
}

function formatNumber(num) {
    return num.toLocaleString('cs-CZ');
}

// === Package Selection ===
function selectPackage(packageId) {
    const pkg = PRESALE_CONFIG.packages[packageId];
    if (!pkg) {
        console.error('Invalid package:', packageId);
        return;
    }

    const totalTokens = Math.floor(pkg.baseTokens * (1 + pkg.bonus));

    // Přidat presale balíček do stejného košíku jako eShop (V2/cart.js používá 'zion_cart')
    addPresaleToCart({
        id: `presale-${packageId}`,
        name: `Presale: ${pkg.name}`,
        price: pkg.priceCzk,
        tokens: totalTokens,
        category: 'presale',
        image: './img/logo.jpg',
        quantity: 1
    });
}

function addPresaleToCart(item) {
    if (!item || !item.id) {
        console.error('Invalid presale cart item', item);
        return;
    }

    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('zion_cart') || '[]');
        if (!Array.isArray(cart)) cart = [];
    } catch (e) {
        cart = [];
    }

    const existingIndex = cart.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) {
        cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + (item.quantity || 1);
        // preferovat nejnovější tokens/price pokud se změnily
        cart[existingIndex].price = item.price;
        cart[existingIndex].tokens = item.tokens;
        cart[existingIndex].category = item.category;
        cart[existingIndex].image = item.image;
        cart[existingIndex].name = item.name;
    } else {
        cart.push(item);
    }

    localStorage.setItem('zion_cart', JSON.stringify(cart));
    updateCartBadge();

    // Jemná notifikace + přesměrování do košíku
    try {
        Cart?.showNotification?.('Presale balíček přidán do košíku');
    } catch (_) {
        // ignore
    }
    window.location.href = './cart.html';
}

function buyCustomAmount() {
    const input = document.getElementById('custom-eur');
    let amount = 0;
    
    // Determine currency-aware amount
    if (PRESALE_CONFIG.currency === 'CZK') {
        amount = parseFloat(input?.value) || 200; // Default amount if missing
    } else {
        amount = parseFloat(input?.value) || 200;
    }
    
    if (amount < PRESALE_CONFIG.minAmount) {
        const minDisplay = PRESALE_CONFIG.currency === 'CZK' ? `${PRESALE_CONFIG.minAmount} Kč` : `€${PRESALE_CONFIG.minAmount}`;
        alert(`Minimální částka je ${minDisplay}`);
        return;
    }
    
    if (amount > PRESALE_CONFIG.maxAmount) {
        const maxDisplay = PRESALE_CONFIG.currency === 'CZK' ? `${PRESALE_CONFIG.maxAmount} Kč` : `€${PRESALE_CONFIG.maxAmount}`;
        alert(`Pro částky nad ${maxDisplay} nás kontaktujte přímo.`);
        return;
    }
    
    // Přidat vlastní presale částku do košíku místo okamžitého checkoutu na presale stránce
    const bonusRate = getBonusRate(amount);
    const baseTokens = Math.floor(amount / PRESALE_CONFIG.tokenPrice);
    const bonusTokens = Math.floor(baseTokens * bonusRate);
    const totalTokens = baseTokens + bonusTokens;

    const normalizedAmount = Math.round(amount);
    addPresaleToCart({
        id: `presale-custom-${normalizedAmount}`,
        name: `Presale: Custom (${formatNumber(normalizedAmount)} Kč)` ,
        price: normalizedAmount,
        tokens: totalTokens,
        category: 'presale',
        image: './img/logo.jpg',
        quantity: 1
    });

    return;
}

// === Modal Handling ===
function initModals() {
    // Close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    // Click outside to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModals();
            }
        });
    });
    
    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModals();
        }
    });
}

function openQrModal() {
    if (!currentOrder) return;
    
    const modal = document.getElementById('qr-modal');
    if (!modal) return;
    
    // Update summary
    document.getElementById('summary-package').textContent = currentOrder.packageName;
    document.getElementById('summary-tokens').textContent = formatNumber(currentOrder.totalTokens) + ' ZION';
    document.getElementById('summary-total').textContent = '€' + currentOrder.priceEur;
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Ensure payment info state is consistent on open
    try { togglePaymentInfo(); } catch (_) {}
}

// === API Calls ===
async function handlePurchaseStripe() {
    // Stripe temporarily disabled - use bank transfer
    alert('Platba kartou bude dostupná brzy. Prosím použijte bankovní převod.');
    return;
}

async function handlePurchaseTransfer() {
    if (!currentOrder) return;
    
    // Validate email
    const emailInput = document.getElementById('buyer-email');
    const nameInput = document.getElementById('buyer-name');
    const email = emailInput?.value?.trim() || '';
    const name = nameInput?.value?.trim() || '';
    
    if (!email || !email.includes('@')) {
        alert('Zadejte prosím platný email');
        emailInput?.focus();
        return;
    }
    
    if (!name) {
        alert('Zadejte prosím vaše jméno');
        nameInput?.focus();
        return;
    }
    
    const payload = {
        email: email,
        name: name,
        tokens: currentOrder.totalTokens,
        priceEur: currentOrder.priceEur,
        packageName: currentOrder.packageName,
        baseTokens: currentOrder.baseTokens,
        paymentMethod: 'bank_transfer',
        variableSymbol: currentOrder.variableSymbol
    };
    
    try {
        const endpoint = PRESALE_CONFIG.apiEndpoints.php.presaleOrder;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text); } catch (_) {}
        if (!data) {
            console.error('Presale order raw response:', text);
            throw new Error('Neplatná JSON odpověď z backendu');
        }
        if (data.success && (data.order || data.wallet)) {
            renderTransferDetails(data.order || data);
        } else {
            alert(data.error || data.message || 'Objednávku se nepodařilo vytvořit.');
        }
    } catch (e) {
        console.error(e);
        alert('Chyba při vytváření objednávky převodem: ' + e.message);
    }
}

function renderTransferDetails(order) {
    const modal = document.getElementById('qr-modal');
    if (!modal) return;
    
    const vs = order.payment?.variableSymbol || currentOrder.variableSymbol;
    const amount = order.package?.priceEur || currentOrder.priceEur;
    const qrUrl = order.zion?.qr?.serviceUrl;
    const walletId = order.zion?.wallet?.id || 'N/A';
    const tokens = order.package?.totalTokens || currentOrder.totalTokens;
    const orderId = order.orderId || 'N/A';
    const email = order.customer?.email || currentOrder.customer?.email;
    
    // Replace modal content with success screen
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.maxWidth = '900px';
    modalContent.style.maxHeight = '95vh';
    
    modalContent.innerHTML = `
        <span class="close-modal" style="position: absolute; top: 20px; right: 25px; font-size: 2rem; cursor: pointer; color: var(--rasta-gold);">&times;</span>
        <div style="padding: 40px 30px; text-align: center; overflow-y: auto; max-height: 90vh;">
            <!-- Success Header -->
            <div style="margin-bottom: 30px;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--rasta-green), #2e7d32); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 30px rgba(76, 175, 80, 0.5);">
                    <i class="fa-solid fa-check" style="font-size: 40px; color: white;"></i>
                </div>
                <h2 style="color: var(--rasta-gold); font-size: 2rem; margin-bottom: 10px;">✨ Objednávka vytvořena!</h2>
                <p style="color: var(--rasta-green); font-size: 1.1rem;">Order ID: <strong>${orderId}</strong></p>
            </div>
            
            <!-- Two Column Layout -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
                <!-- Left: Payment Details -->
                <div style="background: rgba(0,0,0,0.3); padding: 25px; border-radius: 16px; border: 2px solid var(--rasta-gold); text-align: left;">
                    <h3 style="color: var(--rasta-gold); margin-bottom: 20px; text-align: center;">
                        <i class="fa-solid fa-building-columns"></i> Platební údaje
                    </h3>
                    <div style="color: #ddd; line-height: 2;">
                        <p><strong>Příjemce:</strong><br/>ZION TerraNova</p>
                        <p><strong>IBAN:</strong><br/>CZ63 2010 0000 0029 0180 9148</p>
                        <p><strong>SWIFT:</strong><br/>FIOBCZPPXXX</p>
                        <p><strong>Částka:</strong><br/><span style="font-size: 1.3em; color: var(--rasta-gold);">€${amount}</span></p>
                        <p><strong>VS:</strong><br/><span style="font-size: 1.5em; color: var(--rasta-green); font-weight: bold;">${vs}</span></p>
                    </div>
                    <div style="background: rgba(255, 215, 0, 0.1); border: 2px solid var(--rasta-gold); border-radius: 10px; padding: 15px; margin-top: 20px;">
                        <p style="margin: 0; color: var(--rasta-gold); font-size: 0.9rem;">
                            <i class="fa-solid fa-exclamation-triangle"></i> <strong>Důležité:</strong> Použijte VS při platbě!
                        </p>
                    </div>
                </div>
                
                <!-- Right: ZION Wallet QR -->
                <div style="background: rgba(0,0,0,0.3); padding: 25px; border-radius: 16px; border: 2px solid var(--rasta-green);">
                    <h3 style="color: var(--rasta-green); margin-bottom: 20px;">
                        <i class="fa-solid fa-qrcode"></i> ZION Wallet
                    </h3>
                    ${qrUrl ? `
                        <div style="background: white; padding: 15px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                            <img src="${qrUrl}" alt="ZION Wallet QR" style="width: 220px; height: 220px; display: block;"/>
                        </div>
                        <p style="color: #888; font-size: 0.85rem; margin-top: 15px;">Naskenujte pro připojení k síti ZION</p>
                    ` : '<p style="color: #888;">QR kód bude vygenerován po připsání platby</p>'}
                    <div style="margin-top: 20px; text-align: left; color: #ddd; font-size: 0.95rem;">
                        <p><strong>Wallet ID:</strong><br/>${walletId}</p>
                        <p><strong>Tokeny:</strong><br/><span style="color: var(--rasta-gold); font-size: 1.2em; font-weight: bold;">${formatNumber(tokens)} ZION</span></p>
                    </div>
                </div>
            </div>
            
            <!-- Email Confirmation -->
            <div style="background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(255, 215, 0, 0.15)); border: 2px solid var(--rasta-green); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                <p style="color: var(--rasta-green); font-size: 1.1rem; margin: 0;">
                    <i class="fa-solid fa-envelope-circle-check" style="font-size: 1.5em; vertical-align: middle; margin-right: 10px;"></i>
                    <strong>Email odeslán na:</strong> ${email}
                </p>
                <p style="color: #bbb; margin: 10px 0 0 0; font-size: 0.95rem;">
                    Zkontrolujte schránku (i spam) pro kompletní platební instrukce a ZION wallet.
                </p>
            </div>
            
            <!-- Action Buttons -->
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="window.print()" class="rasta-btn" style="background: linear-gradient(135deg, var(--rasta-gold), #ff8c00); padding: 14px 30px; border: none; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: bold;">
                    <i class="fa-solid fa-print"></i> Vytisknout údaje
                </button>
                <button onclick="closeModals(); location.reload();" class="rasta-btn" style="background: linear-gradient(135deg, var(--rasta-green), #2e7d32); padding: 14px 30px; border: none; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: bold;">
                    <i class="fa-solid fa-home"></i> Zpět na presale
                </button>
            </div>
        </div>
    `;
    
    // Re-attach close modal handler
    modalContent.querySelector('.close-modal').addEventListener('click', () => {
        closeModals();
        location.reload();
    });
}

function getCurrentPhaseId() {
    // Simplified: infer by price (Phase 1: €0.008, Phase 2: €0.010, Phase 3: €0.012)
    const p = PRESALE_CONFIG.tokenPrice;
    if (p <= 0.0085) return 1;
    if (p <= 0.0105) return 2;
    return 3;
}

// === Live Statistics Polling ===
function initStatsPolling() {
    // Initial load
    updatePresaleStats();
    
    // Poll every 30 seconds
    setInterval(updatePresaleStats, 30000);
}

async function updatePresaleStats() {
    try {
        const endpoint = PRESALE_CONFIG.apiEndpoints.python.status;
        const res = await fetch(endpoint);
        const data = await res.json();
        
        if (!data.success || !data.presale) {
            console.warn('Failed to fetch presale stats');
            return;
        }
        
        const stats = data.presale;
        
        // Update tokens sold
        const soldEl = document.getElementById('tokens-sold');
        if (soldEl) {
            soldEl.textContent = formatNumber(stats.total_sold || 0);
        }
        
        // Update progress percentage
        const progressEl = document.getElementById('presale-progress');
        if (progressEl) {
            const pct = stats.progress_percentage || 0;
            progressEl.textContent = `${pct.toFixed(1)}%`;
        }
        
        // Update progress bar width
        const barEl = document.querySelector('.progress-fill');
        if (barEl) {
            const pct = stats.progress_percentage || 0;
            barEl.style.width = `${pct}%`;
            const textEl = barEl.querySelector('.progress-text');
            if (textEl) {
                textEl.textContent = `${pct.toFixed(1)}%`;
            }
        }
        
        // Update phase info if available
        if (data.current_phase) {
            const phaseEl = document.querySelector('.presale-stats-hero .stat .value');
            if (phaseEl && phaseEl.textContent.includes('€')) {
                phaseEl.textContent = `€${data.current_phase.price_eur}`;
            }
        }
        
    } catch (e) {
        console.error('Error updating presale stats:', e);
    }
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = '';
}

function closeSuccessModal() {
    closeModals();
    currentOrder = null;
}

// === Payment Method Toggle ===
function initPaymentMethodToggle() {
    const methods = document.querySelectorAll('input[name="payment-method"]');
    methods.forEach(method => {
        method.addEventListener('change', togglePaymentInfo);
    });
}

function togglePaymentInfo() {
    const selectedMethod = document.querySelector('input[name="payment-method"]:checked')?.value;
    const cardInfo = document.getElementById('card-payment-info');
    const transferInfo = document.getElementById('transfer-payment-info');
    const payBtn = document.getElementById('pay-btn');
    
    if (selectedMethod === 'card') {
        if (cardInfo) cardInfo.style.display = 'block';
        if (transferInfo) transferInfo.style.display = 'none';
        if (payBtn) payBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Zaplatit kartou';
    } else {
        if (cardInfo) cardInfo.style.display = 'none';
        if (transferInfo) transferInfo.style.display = 'block';
        if (payBtn) payBtn.innerHTML = '<i class="fa-solid fa-check"></i> Potvrdit objednávku';
    }
}

// === QR Generation ===
async function generateQrPreview() {
    const loadingEl = document.getElementById('qr-loading');
    const imageEl = document.getElementById('qr-preview-image');
    const detailsEl = document.getElementById('qr-details');
    
    // Show loading
    loadingEl.style.display = 'flex';
    imageEl.style.display = 'none';
    detailsEl.style.display = 'none';
    
    try {
        // Generate temporary wallet ID for preview
        const previewWalletId = 'preview_' + Math.random().toString(36).substring(7);
        
        const response = await fetch(`${PRESALE_CONFIG.apiBase}/wallet-qr.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                label: 'ZION Presale Preview',
                tokens: currentOrder.totalTokens,
                orderId: previewWalletId,
                expiresInHours: 720 // 30 days
            })
        });
        
        let data = null;
        try {
            data = await response.json();
        } catch (parseErr) {
            console.warn('Backend response not JSON, switching to fallback QR.', parseErr);
        }

        if (data && data.success && data.qr) {
            // Standard backend path
            if (data.qr.dataUrl) {
                imageEl.src = data.qr.dataUrl;
            } else if (data.qr.serviceUrl) {
                imageEl.src = data.qr.serviceUrl;
            }
            document.getElementById('wallet-id').textContent = data.wallet.id;
            document.getElementById('wallet-tokens').textContent = formatNumber(data.wallet.tokens) + ' ZION';
            document.getElementById('wallet-expires').textContent = formatDate(data.wallet.expiresAt);
            currentOrder.wallet = data.wallet;
            currentOrder.qr = data.qr;
        } else {
            // === FALLBACK FRONTEND ONLY MODE ===
            console.warn('Using frontend fallback QR generation. Backend wallet-qr.php unavailable.');
            const fallbackWallet = {
                id: previewWalletId,
                tokens: currentOrder.totalTokens,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
            };
            // Encode minimal payload (NOT A PRIVATE KEY) for placeholder
            const payload = `ZION|PRESALE|${fallbackWallet.id}|TOKENS:${fallbackWallet.tokens}`;
            const qrService = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
            imageEl.src = qrService;
            document.getElementById('wallet-id').textContent = fallbackWallet.id + ' (offline)';
            document.getElementById('wallet-tokens').textContent = formatNumber(fallbackWallet.tokens) + ' ZION';
            document.getElementById('wallet-expires').textContent = formatDate(fallbackWallet.expiresAt);
            currentOrder.wallet = fallbackWallet;
            currentOrder.qr = { serviceUrl: qrService, offline: true };
            // Add warning banner once
            if (!document.getElementById('qr-fallback-warning')) {
                const warn = document.createElement('div');
                warn.id = 'qr-fallback-warning';
                warn.style.marginTop = '12px';
                warn.style.padding = '10px 14px';
                warn.style.border = '1px solid var(--rasta-red)';
                warn.style.borderRadius = '8px';
                warn.style.background = 'rgba(255,69,0,0.15)';
                warn.style.fontSize = '0.85rem';
                warn.innerHTML = '⚠️ Backend není dostupný – QR je pouze dočasný náhled. Po zaplacení nám napište pro potvrzení a generaci finálního walletu.';
                detailsEl.parentElement.insertBefore(warn, detailsEl);
            }
        }
        // Reveal UI
        loadingEl.style.display = 'none';
        imageEl.style.display = 'block';
        detailsEl.style.display = 'block';
    } catch (error) {
        console.error('QR generation error:', error);
        loadingEl.innerHTML = '<p style="color: var(--rasta-red);">⚠️ Chyba při generování QR</p>';
    }
}

// === Payment Processing ===
async function processPayment() {
    const email = document.getElementById('buyer-email')?.value?.trim();
    const name = document.getElementById('buyer-name')?.value?.trim() || '';
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value;
    
    // Validate email
    if (!email || !isValidEmail(email)) {
        alert('Zadejte prosím platnou e-mailovou adresu.');
        return;
    }
    
    currentOrder.customer = { email, name };
    
    const payBtn = document.getElementById('pay-btn');
    payBtn.disabled = true;
    payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zpracovávám...';
    
    try {
        if (paymentMethod === 'card') {
            await processCardPayment();
        } else {
            await processTransferPayment();
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Chyba při zpracování platby: ' + error.message);
    } finally {
        payBtn.disabled = false;
        togglePaymentInfo(); // Reset button text
    }
}

async function processCardPayment() {
    if (!currentOrder?.customer?.email) {
        throw new Error('Chybí e-mail zákazníka');
    }

    // 1) Create presale order first (server-side canonical record)
    const variableSymbol = generateVariableSymbol();
    currentOrder.variableSymbol = variableSymbol;

    const orderPayload = {
        email: currentOrder.customer.email,
        name: currentOrder.customer.name,
        tokens: currentOrder.totalTokens,
        priceEur: currentOrder.priceEur,
        packageName: currentOrder.packageName,
        baseTokens: currentOrder.baseTokens,
        paymentMethod: 'card',
        variableSymbol
    };

    const orderRes = await fetch(PRESALE_CONFIG.apiEndpoints.php.presaleOrder, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
    });

    const orderRaw = await orderRes.text();
    let orderData = null;
    try { orderData = JSON.parse(orderRaw); } catch (_) {}
    if (!orderData?.success || !orderData?.order?.orderId) {
        console.error('Presale order raw response:', orderRaw);
        throw new Error(orderData?.error || orderData?.message || 'Nepodařilo se vytvořit presale objednávku.');
    }

    const orderId = orderData.order.orderId;

    // 2) Create Stripe Checkout session
    const successUrl = `${window.location.origin}/V2/presale.html?success=1&order=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${window.location.origin}/V2/presale.html?cancelled=1&order=${encodeURIComponent(orderId)}`;

    const stripeRes = await fetch(`${PRESALE_CONFIG.apiBase}/stripe-checkout.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            presale: true,
            orderId,
            amountEur: currentOrder.priceEur,
            tokens: currentOrder.totalTokens,
            packageName: currentOrder.packageName,
            customerEmail: currentOrder.customer.email,
            successUrl,
            cancelUrl
        })
    });

    const stripeRaw = await stripeRes.text();
    let stripeData = null;
    try { stripeData = JSON.parse(stripeRaw); } catch (_) {}
    if (!stripeData?.success || !stripeData?.url) {
        console.error('Stripe checkout raw response:', stripeRaw);
        throw new Error(stripeData?.error || stripeData?.details || 'Stripe checkout selhal.');
    }

    window.location.href = stripeData.url;
}

async function processTransferPayment() {
    // Create presale order with bank transfer payment
    const variableSymbol = generateVariableSymbol();
    currentOrder.variableSymbol = variableSymbol;
    
    const payload = {
        email: currentOrder.customer.email,
        name: currentOrder.customer.name,
        tokens: currentOrder.totalTokens,
        priceEur: currentOrder.priceEur,
        packageName: currentOrder.packageName,
        baseTokens: currentOrder.baseTokens,
        paymentMethod: 'bank_transfer',
        variableSymbol: variableSymbol
    };
    
    const response = await fetch(PRESALE_CONFIG.apiEndpoints.php.presaleOrder, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) {}
    if (!data) {
        console.error('Presale order raw response:', raw);
        throw new Error('Neplatná JSON odpověď z backendu');
    }
    
    if (data.success && data.order) {
        // Show success with transfer details
        renderTransferDetails(data.order);
        // Close the main modal, keep showing transfer details in the modal
    } else {
        throw new Error(data.error || data.message || 'Objednávku se nepodařilo vytvořit.');
    }
}

function showSuccessModal(orderId, tokens, qrUrl) {
    closeModals();
    
    const modal = document.getElementById('success-modal');
    if (!modal) return;
    
    document.getElementById('success-order-id').textContent = orderId;
    document.getElementById('success-tokens').textContent = formatNumber(tokens) + ' ZION';
    
    if (qrUrl) {
        document.getElementById('success-qr-image').src = qrUrl;
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// === Utilities ===
function generateVariableSymbol() {
    // Generate 10-digit variable symbol
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return timestamp + random;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// === Export for testing ===
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PRESALE_CONFIG,
        getBonusRate,
        formatNumber,
        generateVariableSymbol
    };
}
