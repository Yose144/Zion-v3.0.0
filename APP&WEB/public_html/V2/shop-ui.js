/* ========================================
   ZION eShop - UI Logic
   Vykreslování produktů a interakce
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    const productsGrid = document.getElementById('products-grid');
    const modal = document.getElementById('product-modal');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const viewerWrapper = document.getElementById('modal-viewer-wrapper');
    const viewerCanvas = document.getElementById('modal-viewer-canvas');
    const capabilitiesBox = document.getElementById('modal-capabilities');
    const modalMetaBox = document.getElementById('modal-meta');
    const modalTokenBox = document.getElementById('modal-token-bonus');
    const locale = (document.documentElement.lang || 'cs').toLowerCase();
    const isEn = locale.startsWith('en');
    const EUR_TO_CZK = 25;

    function formatEur(amount) {
        const rounded = typeof amount === 'number' ? amount : Number(amount);
        const formatted = Number.isFinite(rounded)
            ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rounded)
            : '0';
        return `€${formatted}`;
    }

    function formatPrice(productPriceCzk) {
        if (!isEn) return `${productPriceCzk} Kč`;
        const eur = Math.round((Number(productPriceCzk) || 0) / EUR_TO_CZK);
        return formatEur(eur);
    }
    const metaLabels = {
        size: locale.startsWith('en') ? 'Size' : 'Velikost',
        stock: locale.startsWith('en') ? 'In stock' : 'Skladem',
        units: locale.startsWith('en') ? 'pcs' : 'ks'
    };
    const tokenLabels = {
        unit: 'ZION',
        tooltip: (value) => locale.startsWith('en')
            ? `Bonus: +${value} ZION tokens`
            : `Bonus: +${value} ZION tokenů`,
        chipLabel: locale.startsWith('en') ? 'ZION bonus' : 'ZION bonus',
        modalText: (value) => locale.startsWith('en')
            ? `Earn +${value} ZION tokens`
            : `Bonus +${value} ZION tokenů`
    };
    const addToCartLabels = {
        active: locale.startsWith('en') ? 'Add to cart' : 'Přidat do košíku',
        disabled: locale.startsWith('en') ? 'Unavailable' : 'Nedostupné'
    };
    
    let currentCategory = 'all';
    let currentProduct = null;

    function getTokens(product) {
        if (!product) return 0;
        if (typeof product.tokens === 'number') return product.tokens;
        if (typeof product.tokenBonus === 'number') return product.tokenBonus;
        if (typeof product.price === 'number') {
            return Math.max(1, Math.round(product.price / 100));
        }
        return 0;
    }

    if (window.StarfighterViewer && viewerCanvas) {
        window.StarfighterViewer.init(viewerCanvas);
    }
    
    // ===== POMOCNÉ FUNKCE =====
    // Escape HTML pro XSS ochranu
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ===== VYKRESLENÍ PRODUKTŮ =====
    function renderProducts(category = 'all') {
        if (!productsGrid) return;
        
        try {
            const filtered = category === 'all' 
                ? PRODUCTS 
                : PRODUCTS.filter(p => p.category === category);
            
            if (filtered.length === 0) {
                productsGrid.innerHTML = '<p class="no-products" role="status" aria-live="polite">Žádné produkty v této kategorii</p>';
                return;
            }
            
            // Loading state
            productsGrid.innerHTML = '<div class="products-loading" role="status" aria-live="polite"><i class="fa-solid fa-spinner fa-spin"></i> Načítání produktů...</div>';
            
            // Simulate async rendering for better UX
            setTimeout(() => {
        
        productsGrid.innerHTML = filtered.map(product => {
            const metaItems = [];
            if (product.size) {
                metaItems.push(`<span class="product-meta"><i class="fa-solid fa-ruler-combined"></i>${product.size}</span>`);
            }
            if (typeof product.stock === 'number') {
                metaItems.push(`<span class="product-meta"><i class="fa-solid fa-boxes-stacked"></i>${product.stock} ${metaLabels.units}</span>`);
            }
            const tokens = getTokens(product);
            if (tokens) {
                metaItems.push(`<span class="product-meta"><i class="fa-solid fa-coins"></i>+${tokens} ${tokenLabels.unit}</span>`);
            }

            const tokenChip = tokens
                ? `<div class="token-bonus" title="${tokenLabels.tooltip(tokens)}"><i class="fa-solid fa-coins"></i><span>+${tokens} ${tokenLabels.unit}</span></div>`
                : '';

            const isOut = product.inStock === false;
            const addLabel = isOut ? addToCartLabels.disabled : addToCartLabels.active;

            return `
            <div class="product-card" data-id="${escapeHtml(product.id)}" role="article" aria-label="${escapeHtml(product.name)}">
                <div class="product-image">
                    ${product.modelUrl ? `<span class="model-tag" aria-label="3D model dostupný"><i class="fa-solid fa-cube"></i>3D</span>` : ''}
                    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" onerror="this.src='./img/logo.jpg'" loading="lazy">
                    ${product.badge ? `<span class="product-badge ${product.oldPrice ? 'sale' : ''}">${escapeHtml(product.badge)}</span>` : ''}
                </div>
                <div class="product-info">
                    <div class="product-category">${escapeHtml(CATEGORY_NAMES[product.category] || product.category)}</div>
                    <h3 class="product-title">${escapeHtml(product.name)}</h3>
                    <p class="product-description">${escapeHtml(product.description)}</p>
                    ${metaItems.length ? `<div class="product-meta-row">${metaItems.join('')}</div>` : ''}
                    <div class="product-footer">
                        <div class="product-price">
                            ${product.oldPrice ? `<span class="old-price">${formatPrice(product.oldPrice)}</span>` : ''}
                            ${formatPrice(product.price)}
                            ${tokenChip}
                        </div>
                        <button class="btn-add-cart ${isOut ? 'disabled' : ''}" data-id="${product.id}" ${isOut ? 'disabled' : ''} title="${addLabel}">
                            <i class="fa-solid fa-cart-plus"></i>
                            <span>${addLabel}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');
        
        // Event listenery pro karty
        attachCardEvents();
                
                // Lazy load images with IntersectionObserver
                if ('IntersectionObserver' in window) {
                    const imageObserver = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const img = entry.target;
                                if (img.dataset.src) {
                                    img.src = img.dataset.src;
                                    img.removeAttribute('data-src');
                                }
                                imageObserver.unobserve(img);
                            }
                        });
                    }, { rootMargin: '50px' });
                    
                    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                        imageObserver.observe(img);
                    });
                }
                
            }, 100); // Small delay for perceived performance
            
        } catch (error) {
            console.error('Render products error:', error);
            productsGrid.innerHTML = '<p class="no-products error" role="alert">⚠️ Chyba při načítání produktů</p>';
        }
    }
    
    // ===== EVENT LISTENERY PRO PRODUKTOVÉ KARTY =====
    // Store event handlers to prevent memory leaks
    const eventHandlers = new WeakMap();
    
    function attachCardEvents() {
        // Klik na kartu - otevře modal
        document.querySelectorAll('.product-card').forEach(card => {
            // Přesuň starý handler pokud existuje
            const oldHandler = eventHandlers.get(card);
            if (oldHandler) {
                card.removeEventListener('click', oldHandler);
            }
            
            const newHandler = (e) => {
                // Pokud klik na tlačítko košíku, nepřepínat na modal
                if (e.target.closest('.btn-add-cart')) return;
                
                const productId = card.dataset.id;
                openModal(productId);
            };
            
            card.addEventListener('click', newHandler);
            eventHandlers.set(card, newHandler);
            
            // Přidat keyboard navigation
            card.setAttribute('tabindex', '0');
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!e.target.closest('.btn-add-cart')) {
                        openModal(card.dataset.id);
                    }
                }
            });
        });
        
        // Klik na tlačítko košíku
        document.querySelectorAll('.btn-add-cart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = btn.dataset.id;
                const product = PRODUCTS.find(p => p.id === productId);
                if (!product || product.inStock === false) return;
                Cart.add(productId, 1);
            });
        });
    }
    
    // ===== MODAL =====
    function openModal(productId) {
        currentProduct = PRODUCTS.find(p => p.id === productId);
        if (!currentProduct || !modal) return;
        
        // ARIA attributes for accessibility
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'modal-title');
        modal.setAttribute('aria-describedby', 'modal-description');
        
        document.getElementById('modal-img').src = escapeHtml(currentProduct.image);
        document.getElementById('modal-img').alt = escapeHtml(currentProduct.name);
        document.getElementById('modal-category').textContent = escapeHtml(CATEGORY_NAMES[currentProduct.category] || currentProduct.category);
        document.getElementById('modal-title').textContent = escapeHtml(currentProduct.name);
        document.getElementById('modal-description').textContent = escapeHtml(currentProduct.description);
        updateMeta(currentProduct);
        document.getElementById('modal-price').innerHTML = `
            ${currentProduct.oldPrice ? `<span class="old-price" style="font-size:1rem;color:#666;text-decoration:line-through;margin-right:10px;">${formatPrice(currentProduct.oldPrice)}</span>` : ''}
            ${formatPrice(currentProduct.price)}
        `;
        updateModalTokens(currentProduct);
    const modalQty = document.getElementById('modal-qty');
    modalQty.value = 1;
    modalQty.disabled = currentProduct.inStock === false;
    document.getElementById('add-to-cart-btn').disabled = currentProduct.inStock === false;
        updateViewer(currentProduct);
        updateCapabilities(currentProduct);
    updateModalAction(currentProduct);
        
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
        
        // Focus management
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) closeBtn.focus();
        
        // Focus trap
        trapFocus(modal);
    }
    
    function closeModal() {
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
        window.StarfighterViewer?.clear();
        currentProduct = null;
        
        // Return focus to triggering element
        const triggerCard = document.querySelector(`[data-id="${currentProduct?.id || ''}"]`);
        if (triggerCard) triggerCard.focus();
    }
    
    // Focus trap helper
    function trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        element.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        });
    }

    function updateViewer(product) {
        if (!viewerWrapper || !window.StarfighterViewer) return;

        if (product?.modelUrl) {
            window.StarfighterViewer.loadModel(product.modelUrl);
            viewerWrapper.classList.add('visible');
            viewerWrapper.removeAttribute('hidden');
            window.StarfighterViewer.resize();
        } else {
            window.StarfighterViewer.clear();
            viewerWrapper.classList.remove('visible');
            viewerWrapper.setAttribute('hidden', 'hidden');
        }
    }

    function updateCapabilities(product) {
        if (!capabilitiesBox) return;

        const chips = [];
        if (product?.modelUrl) chips.push({ icon: 'fa-cube', label: '3D STL preview' });
        if (product?.filesUrl) chips.push({ icon: 'fa-fire', label: 'Laser ready' });
        if (product?.instructionsUrl) chips.push({ icon: 'fa-file-lines', label: 'PDF guide' });

        if (!chips.length) {
            capabilitiesBox.innerHTML = '';
            capabilitiesBox.style.display = 'none';
            return;
        }

        capabilitiesBox.innerHTML = chips.map(chip => `
            <span class="capability-chip">
                <i class="fa-solid ${chip.icon}"></i>
                ${chip.label}
            </span>
        `).join('');
        capabilitiesBox.style.display = 'flex';
    }

    function updateMeta(product) {
        if (!modalMetaBox) return;

        const meta = [];
        if (product?.size) {
            meta.push(`<span><i class="fa-solid fa-ruler-combined"></i>${metaLabels.size}: ${product.size}</span>`);
        }
        if (typeof product?.stock === 'number') {
            meta.push(`<span><i class="fa-solid fa-boxes-stacked"></i>${metaLabels.stock}: ${product.stock} ${metaLabels.units}</span>`);
        }
        const tokens = getTokens(product);
        if (tokens) {
            meta.push(`<span><i class="fa-solid fa-coins"></i>${tokenLabels.chipLabel}: +${tokens} ${tokenLabels.unit}</span>`);
        }

        if (!meta.length) {
            modalMetaBox.innerHTML = '';
            modalMetaBox.style.display = 'none';
            return;
        }

        modalMetaBox.innerHTML = meta.join('');
        modalMetaBox.style.display = 'flex';
    }

    function updateModalTokens(product) {
        if (!modalTokenBox) return;
        const tokens = getTokens(product);
        if (!tokens) {
            modalTokenBox.innerHTML = '';
            modalTokenBox.style.display = 'none';
            return;
        }

        modalTokenBox.innerHTML = `<i class="fa-solid fa-coins"></i><span>${tokenLabels.modalText(tokens)}</span>`;
        modalTokenBox.style.display = 'inline-flex';
    }

    function updateModalAction(product) {
        const addBtn = document.getElementById('add-to-cart-btn');
        if (!addBtn) return;

        if (product?.inStock === false) {
            addBtn.classList.add('disabled');
            addBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${addToCartLabels.disabled}`;
        } else {
            addBtn.classList.remove('disabled');
            addBtn.innerHTML = `<i class="fa-solid fa-cart-plus"></i> ${addToCartLabels.active}`;
        }
    }
    
    // ===== FILTRY =====
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            renderProducts(currentCategory);
        });
    });
    
    // ===== MODAL EVENTS =====
    if (modal) {
        // Zavřít modal
        modal.querySelector('.close-modal')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Quantity buttons
        modal.querySelector('.qty-btn.minus')?.addEventListener('click', () => {
            const input = document.getElementById('modal-qty');
            if (input.disabled) return;
            if (input.value > 1) input.value = parseInt(input.value) - 1;
        });
        
        modal.querySelector('.qty-btn.plus')?.addEventListener('click', () => {
            const input = document.getElementById('modal-qty');
            if (input.disabled) return;
            input.value = parseInt(input.value) + 1;
        });
        
        // Přidat do košíku z modalu
        document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
            if (currentProduct && currentProduct.inStock !== false) {
                const qty = parseInt(document.getElementById('modal-qty').value) || 1;
                Cart.add(currentProduct.id, qty);
                closeModal();
            }
        });
    }
    
    // ESC zavře modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('active')) {
            closeModal();
        }
    });
    
    // ===== INICIALIZACE =====
    // Počkáme na načtení PRODUCTS před renderováním
    if (typeof PRODUCTS !== 'undefined' && PRODUCTS.length > 0) {
        renderProducts();
    } else {
        // Fallback: zkusíme za 100ms, pokud ještě nejsou načtené
        setTimeout(() => {
            if (typeof PRODUCTS !== 'undefined' && PRODUCTS.length > 0) {
                renderProducts();
            } else {
                console.error('PRODUCTS not loaded - check products.js');
            }
        }, 100);
    }
});
