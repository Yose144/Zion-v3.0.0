/* ========================================
   ZION eShop - Checkout Logic
   Zásilkovna, Stripe, Bankovní převod
   ======================================== */

// Globální konfigurace načtená z serveru
let SHOP_CONFIG = {
    zasilkovna: { apiKey: null },
    stripe: { publishableKey: null }
};

// Načíst konfiguraci při startu
async function loadShopConfig() {
    try {
        const response = await fetch('./api/public-config.php');
        if (response.ok) {
            SHOP_CONFIG = await response.json();
            console.log('Shop config loaded');
        }
    } catch (error) {
        console.warn('Could not load shop config:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const locale = (document.documentElement.lang || 'cs').toLowerCase();
    const isEn = locale.startsWith('en');
    const FX_EUR_TO_CZK = 25;

    function formatEur(amount, options = {}) {
        const value = Number(amount) || 0;
        const digits = options.maximumFractionDigits ?? (Number.isInteger(value) ? 0 : 2);
        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: digits
        }).format(value);
        return `€${formatted}`;
    }

    function formatMoney(amount, currency) {
        if ((currency || '').toUpperCase() === 'EUR') return formatEur(amount);
        return `${Number(amount) || 0} Kč`;
    }

    function czkToEurItemPrice(czk) {
        return Math.round((Number(czk) || 0) / FX_EUR_TO_CZK);
    }

    function czkToEurShipping(czk) {
        return Math.round(((Number(czk) || 0) / FX_EUR_TO_CZK) * 100) / 100;
    }

    function getCurrency() {
        return isEn ? 'EUR' : 'CZK';
    }

    // Načíst konfiguraci
    await loadShopConfig();
    
    const cartItemsEl = document.getElementById('cart-items');
    const cartEmptyEl = document.getElementById('cart-empty');
    const checkoutSection = document.getElementById('checkout-section');
    
    // Základní ceny dopravy (v CZK); pro EN se přepočítá do EUR
    const SHIPPING_PRICES_CZK = {
        'zasilkovna': 69,
        'zasilkovna-home': 99,
        'virtualni-nakup': 0,
        'virtualni-odber': 0,
        'osobni': 0 // legacy orders
    };

    function getShippingPrice(method) {
        const czk = SHIPPING_PRICES_CZK[method] || 0;
        if (getCurrency() === 'EUR') return czkToEurShipping(czk);
        return czk;
    }
    
    let selectedShipping = 'zasilkovna';
    let selectedPayment = 'card';
    let selectedPickupPoint = null;
    
    // ===== VYKRESLENÍ KOŠÍKU =====
    function isVirtualOnlyCart(cart) {
        if (!Array.isArray(cart) || cart.length === 0) return false;
        return cart.every((item) => {
            const category = (item?.category || '').toString().toLowerCase();
            const id = (item?.id || '').toString().toLowerCase();
            return category === 'digital' || category === 'presale' || id.startsWith('book-');
        });
    }

    function renderCart() {
        const cart = Cart.get();
        const currency = getCurrency();
        
        if (cart.length === 0) {
            cartItemsEl.style.display = 'none';
            checkoutSection.style.display = 'none';
            cartEmptyEl.style.display = 'block';
            return;
        }
        
        cartItemsEl.style.display = 'block';
        checkoutSection.style.display = 'grid';
        cartEmptyEl.style.display = 'none';
        
        cartItemsEl.innerHTML = cart.map(item => {
            const unitPrice = currency === 'EUR' ? czkToEurItemPrice(item.price) : item.price;
            const linePrice = unitPrice * item.quantity;
            return `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}" onerror="this.src='./img/logo.jpg'">
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-category">${CATEGORY_NAMES[item.category] || item.category}</div>
                </div>
                <div class="cart-item-quantity">
                    <button class="qty-btn minus" data-id="${item.id}">-</button>
                    <input type="number" value="${item.quantity}" min="1" data-id="${item.id}">
                    <button class="qty-btn plus" data-id="${item.id}">+</button>
                </div>
                <div class="cart-item-price">${formatMoney(linePrice, currency)}</div>
                <button class="cart-item-remove" data-id="${item.id}" title="Odebrat">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        }).join('');
        
        attachCartEvents();
        updateSummary();
    }
    
    // ===== CART EVENTS =====
    function attachCartEvents() {
        // Quantity buttons
        document.querySelectorAll('.cart-item .qty-btn.minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const item = Cart.get().find(i => i.id === id);
                if (item && item.quantity > 1) {
                    Cart.updateQuantity(id, item.quantity - 1);
                    renderCart();
                }
            });
        });
        
        document.querySelectorAll('.cart-item .qty-btn.plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const item = Cart.get().find(i => i.id === id);
                if (item) {
                    Cart.updateQuantity(id, item.quantity + 1);
                    renderCart();
                }
            });
        });
        
        // Quantity input - debounced
        document.querySelectorAll('.cart-item-quantity input').forEach(input => {
            // Validace vstupu
            input.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (value > 99) e.target.value = 99;
                if (value < 1) e.target.value = 1;
            });
            
            // Debounced update
            input.addEventListener('input', () => {
                const id = input.dataset.id;
                const qty = parseInt(input.value) || 1;
                Cart.updateQuantityDebounced(id, qty, renderCart);
            });
            
            // Immediate update on blur
            input.addEventListener('blur', () => {
                const id = input.dataset.id;
                const qty = parseInt(input.value) || 1;
                Cart.updateQuantity(id, qty);
                renderCart();
            });
        });
        
        // Remove button
        document.querySelectorAll('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                Cart.remove(btn.dataset.id);
                renderCart();
            });
        });
    }
    
    // ===== SHRNUTÍ =====
    function updateSummary() {
        const currency = getCurrency();
        const cart = Cart.get();
        const productsTotal = cart.reduce((sum, item) => {
            const unitPrice = currency === 'EUR' ? czkToEurItemPrice(item.price) : item.price;
            return sum + (unitPrice * (item.quantity || 1));
        }, 0);

        const shippingPrice = getShippingPrice(selectedShipping);
        const total = productsTotal + shippingPrice;

        const freeText = isEn ? 'Free' : 'Zdarma';
        document.getElementById('summary-products').textContent = formatMoney(productsTotal, currency);
        document.getElementById('summary-shipping').textContent = shippingPrice === 0 ? freeText : formatMoney(shippingPrice, currency);
        document.getElementById('summary-total').textContent = formatMoney(total, currency);
    }
    
    // ===== DOPRAVA =====
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', () => {
            selectedShipping = radio.value;
            updateSummary();
            
            // Zobrazit/skrýt Zásilkovna widget
            const zasilkovnaWidget = document.getElementById('zasilkovna-widget');
            const addressFields = document.getElementById('address-fields');
            
            if (selectedShipping === 'zasilkovna') {
                zasilkovnaWidget.style.display = 'block';
                addressFields.style.display = 'none';
            } else if (selectedShipping === 'zasilkovna-home') {
                zasilkovnaWidget.style.display = 'none';
                addressFields.style.display = 'block';
            } else {
                zasilkovnaWidget.style.display = 'none';
                addressFields.style.display = 'none';
            }
        });
    });

    // Presale/digitální objednávky: automaticky přepnout na virtuální doručení
    try {
        const cartNow = Cart.get();
        if (isVirtualOnlyCart(cartNow)) {
            const virtualRadio = document.querySelector('input[name="shipping"][value="virtualni-nakup"]');
            if (virtualRadio) {
                virtualRadio.checked = true;
                virtualRadio.dispatchEvent(new Event('change'));
            }
        }
    } catch (e) {
        console.warn('Virtual shipping auto-select failed:', e);
    }

    // EN/EUR: bankovní převod (QR SPD) je CZK-only; ponechat jen Stripe
    if (isEn) {
        const transferRadio = document.querySelector('input[name="payment"][value="transfer"]');
        if (transferRadio) {
            transferRadio.disabled = true;
            const transferLabel = transferRadio.closest('label');
            if (transferLabel) transferLabel.style.display = 'none';
        }
        selectedPayment = 'card';
    }
    
    // ===== ZÁSILKOVNA WIDGET =====
    const selectPickupBtn = document.getElementById('select-pickup-point');
    const selectedPointEl = document.getElementById('selected-pickup-point');
    
    if (selectPickupBtn) {
        selectPickupBtn.addEventListener('click', () => {
            // Zásilkovna API Key z konfigurace
            const zasilkovnaKey = SHOP_CONFIG.zasilkovna?.apiKey;
            
            if (!zasilkovnaKey || zasilkovnaKey === 'XXXXXXXXXXXXXXXXXXXXXXXX') {
                Cart.showNotification('Zásilkovna widget není nakonfigurován. Kontaktujte podporu.', 'error');
                console.error('Zásilkovna API key not configured');
                return;
            }
            
            if (typeof Packeta !== 'undefined' && Packeta.Widget) {
                Packeta.Widget.pick(zasilkovnaKey, (point) => {
                    if (point) {
                        selectedPickupPoint = point;
                        selectedPointEl.innerHTML = `
                            <strong>${point.name}</strong>
                            <span>${point.street}, ${point.city}, ${point.zip}</span>
                        `;
                        selectedPointEl.classList.add('active');
                    }
                }, {
                    country: SHOP_CONFIG.zasilkovna?.country || 'cz',
                    language: SHOP_CONFIG.zasilkovna?.language || 'cs'
                });
            } else {
                // Fallback pokud widget není načten
                Cart.showNotification('Widget Zásilkovny se nenačetl. Zkuste obnovit stránku.', 'error');
            }
        });
    }
    
    // ===== PLATBA =====
    document.querySelectorAll('input[name="payment"]').forEach(radio => {
        radio.addEventListener('change', () => {
            selectedPayment = radio.value;
        });
    });
    
    // ===== ODESLÁNÍ OBJEDNÁVKY =====
    const submitBtn = document.getElementById('submit-order');
    let isSubmitting = false; // Ochrana proti dvojímu odeslání
    
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            // Prevence dvojího odeslání
            if (isSubmitting) {
                console.log('Order is already being submitted, ignoring duplicate click');
                return;
            }
            
            isSubmitting = true;
            submitBtn.disabled = true;
            
            try {
                // Validace GDPR checkbox
                const termsCheckbox = document.getElementById('terms-agree');
                if (!termsCheckbox.checked) {
                    Cart.showNotification('Musíte souhlasit s obchodními podmínkami', 'error');
                    // Přidat error třídu pro vizuální feedback
                    termsCheckbox.closest('.terms-checkbox').classList.add('error');
                    termsCheckbox.focus();
                    setTimeout(() => {
                        termsCheckbox.closest('.terms-checkbox').classList.remove('error');
                    }, 2000);
                    isSubmitting = false;
                    submitBtn.disabled = false;
                    return;
                }
                
                // Validace
                const form = document.getElementById('checkout-form');
                const name = document.getElementById('name').value.trim();
                const email = document.getElementById('email').value.trim();
                const phone = document.getElementById('phone').value.trim();
                
                if (!name || !email || !phone) {
                    Cart.showNotification('Vyplňte prosím všechny povinné údaje', 'error');
                    isSubmitting = false;
                    submitBtn.disabled = false;
                    return;
                }
                
                if (selectedShipping === 'zasilkovna' && !selectedPickupPoint) {
                    Cart.showNotification('Vyberte prosím výdejní místo Zásilkovny', 'error');
                    isSubmitting = false;
                    submitBtn.disabled = false;
                    return;
                }
                
                if (selectedShipping === 'zasilkovna-home') {
                    const street = document.getElementById('street').value.trim();
                    const city = document.getElementById('city').value.trim();
                    const zip = document.getElementById('zip').value.trim();
                    
                    if (!street || !city || !zip) {
                        Cart.showNotification('Vyplňte prosím doručovací adresu', 'error');
                        isSubmitting = false;
                        submitBtn.disabled = false;
                        return;
                    }
                }
            
            // Vytvoření objednávky
            const newsletterCheckbox = document.getElementById('newsletter-agree');
            
            // Výpočet ZION tokenů
            const zionTokens = Cart.get().reduce((sum, item) => {
                return sum + ((item.tokens || 0) * (item.quantity || 1));
            }, 0);
            
            // Generování wallet ID pro ZION bonus
            const walletId = 'zw_' + generateOrderId().toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 16);
            
            const orderData = {
                orderId: generateOrderId(),
                currency: getCurrency(),
                items: Cart.get().map((item) => {
                    const currency = getCurrency();
                    const price = currency === 'EUR' ? czkToEurItemPrice(item.price) : item.price;
                    return {
                        ...item,
                        price,
                        priceCzk: item.price
                    };
                }),
                customer: {
                    name,
                    email,
                    phone,
                    address: selectedShipping === 'zasilkovna-home' ? {
                        street: document.getElementById('street').value,
                        city: document.getElementById('city').value,
                        zip: document.getElementById('zip').value
                    } : null,
                    newsletter: newsletterCheckbox ? newsletterCheckbox.checked : false
                },
                shipping: {
                    method: selectedShipping,
                    price: getShippingPrice(selectedShipping),
                    pickupPoint: selectedPickupPoint
                },
                payment: selectedPayment,
                note: document.getElementById('note').value,
                total: (() => {
                    const currency = getCurrency();
                    const productsTotal = Cart.get().reduce((sum, item) => {
                        const unitPrice = currency === 'EUR' ? czkToEurItemPrice(item.price) : item.price;
                        return sum + (unitPrice * (item.quantity || 1));
                    }, 0);
                    return productsTotal + getShippingPrice(selectedShipping);
                })(),
                zionTokens: zionTokens,
                zionWalletId: walletId,
                termsAccepted: true,
                createdAt: new Date().toISOString()
            };
            
            // Zpracování podle typu platby
            if (selectedPayment === 'card') {
                await processStripePayment(orderData);
            } else if (selectedPayment === 'transfer') {
                showBankTransferModal(orderData);
            } else {
                await submitOrder(orderData);
            }
            } catch (error) {
                console.error('Checkout error:', error);
                Cart.showNotification('Chyba při zpracování objednávky', 'error');
                isSubmitting = false;
                submitBtn.disabled = false;
            }
        });
    }
    
    // ===== STRIPE PLATBA =====
    async function processStripePayment(orderData) {
        const submitBtn = document.getElementById('submit-order');
        Cart.showNotification('Přesměrování na platební bránu...', 'success');
        
        try {
            // Nejprve uložit objednávku na server
            await submitOrder(orderData, false);
            
            // Vytvořit Stripe Checkout Session
            const response = await fetch('./api/stripe-checkout.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: orderData.items,
                    orderId: orderData.orderId,
                    shippingPrice: orderData.shipping.price,
                    customerEmail: orderData.customer.email,
                    currency: (orderData.currency || 'CZK').toLowerCase(),
                    locale: isEn ? 'en' : 'cs',
                    cancelUrl: isEn
                        ? `${window.location.origin}/V2/cart-en.html?cancelled=1`
                        : `${window.location.origin}/V2/cart.html?cancelled=1`
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.url) {
                // Přesměrovat na Stripe Checkout
                window.location.href = result.url;
            } else {
                // Zobrazit detail chyby ze Stripe
                const errorMsg = result.details || result.error || 'Neznámá chyba';
                console.warn('Stripe chyba:', errorMsg);
                Cart.showNotification(`Platba se nezdařila: ${errorMsg}`, 'error');
                isSubmitting = false;
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Odeslat objednávku'; }
            }
        } catch (error) {
            console.error('Stripe checkout error:', error);
            Cart.showNotification('Chyba při přesměrování na platbu. Zkuste to znovu.', 'error');
            isSubmitting = false;
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Odeslat objednávku'; }
        }
    }
    
    // ===== BANKOVNÍ PŘEVOD =====
    function showBankTransferModal(orderData) {
        if ((orderData.currency || 'CZK').toUpperCase() === 'EUR') {
            Cart.showNotification('Bank transfer is unavailable for EUR orders. Please use card payment.', 'error');
            return;
        }
        const modal = document.getElementById('qr-modal');
        const varSymbol = getVariableSymbol(orderData.orderId); // Extrakce 10-ti číselného VS
        const amount = orderData.total;
        
        document.getElementById('var-symbol').textContent = varSymbol;
        document.getElementById('payment-amount').textContent = `${amount} Kč`;
        
        // Generování QR kódu pro platbu
        const qrContainer = document.getElementById('qr-code');
        const qrData = `SPD*1.0*ACC:CZ63201000000029018091148*AM:${amount}*CC:CZK*MSG:Objednavka ${orderData.orderId}*X-VS:${varSymbol}`;
        
        // Použití QR knihovny nebo obrázku
        qrContainer.innerHTML = `
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}" 
                 alt="QR platba" width="200" height="200">
        `;
        
        modal.classList.add('active');
        
        // Odeslat objednávku jako čekající na platbu
        orderData.status = 'pending_payment';
        submitOrder(orderData, false); // false = nevyčistit košík hned
        
        // Zavření modalu
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.classList.remove('active');
            Cart.clear();
            window.location.href = './order-success.html?order=' + orderData.orderId;
        });
    }
    
    // ===== ODESLÁNÍ OBJEDNÁVKY =====
    async function submitOrder(orderData, clearCart = true) {
        const submitBtn = document.getElementById('submit-order');
        const originalText = submitBtn ? submitBtn.innerHTML : '';
        
        try {
            // Loading state
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Odesílám objednávku...';
                submitBtn.disabled = true;
            }
            
            // Uložit data objednávky do localStorage pro order-success.html
            localStorage.setItem('lastOrder', JSON.stringify(orderData));
            localStorage.setItem('lastOrderId', orderData.orderId);
            
            // Odeslat na backend (PHP) s timeoutem
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            
            const response = await fetch('./api/create-order.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // I když backend selže, pro demo účely pokračujeme
            console.log('Order submitted:', orderData);
            
            if (clearCart) {
                Cart.clear();
                Cart.showNotification('Objednávka byla úspěšně odeslána!', 'success');
                
                setTimeout(() => {
                    window.location.href = './order-success.html?order=' + orderData.orderId;
                }, 2000);
            }
        } catch (error) {
            console.error('Order error:', error);
            
            // Rozlišit typy chyb
            if (error.name === 'AbortError') {
                Cart.showNotification('Timeout - zkuste to prosím znovu', 'error');
            } else if (!navigator.onLine) {
                Cart.showNotification('Žádné internetové připojení', 'error');
            } else {
                // Pro demo - pokračovat i bez backendu
                if (clearCart) {
                    Cart.clear();
                    Cart.showNotification('Objednávka přijata! (Demo režim)', 'success');
                    setTimeout(() => {
                        window.location.href = './order-success.html?order=' + orderData.orderId;
                    }, 2000);
                    return;
                }
                Cart.showNotification('Chyba při odesílání - zkuste to znovu', 'error');
            }
            
            // Restore button state
            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }
    
    // ===== GENERÁTOR ID OBJEDNÁVKY =====
    // Formát: ORD-{timestamp}-{hash} (shodný formát jako presale)
    // Variabilní symbol = timestamp (10 číslic)
    function generateOrderId() {
        const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp (10 číslic)
        const hash = Math.random().toString(36).substring(2, 8);
        return `ORD-${timestamp}-${hash}`;
    }
    
    // Extrakce variabilního symbolu z orderId
    function getVariableSymbol(orderId) {
        const match = orderId.match(/(\d{10})/);
        return match ? match[1] : orderId.replace(/\D/g, '').substring(0, 10);
    }
    
    // ===== QR MODAL CLOSE =====
    const qrModal = document.getElementById('qr-modal');
    if (qrModal) {
        qrModal.addEventListener('click', (e) => {
            if (e.target === qrModal) {
                qrModal.classList.remove('active');
            }
        });
    }
    
    // ===== INICIALIZACE =====
    renderCart();
});
