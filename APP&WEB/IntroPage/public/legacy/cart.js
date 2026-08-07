/* ========================================
   ZION eShop - Košík (localStorage)
   ======================================== */

const Cart = {
    // Klíč pro localStorage
    STORAGE_KEY: 'zion_cart',
    
    // Získat košík z localStorage
    get() {
        const cart = localStorage.getItem(this.STORAGE_KEY);
        if (!cart) return [];
        try {
            const parsed = JSON.parse(cart);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('Košík v localStorage je poškozený, mažu ho.', e);
            localStorage.removeItem(this.STORAGE_KEY);
            return [];
        }
    },
    
    // Uložit košík do localStorage
    save(cart) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
        this.updateBadge();
    },
    
    // Přidat produkt do košíku
    add(productId, quantity = 1) {
        const cart = this.get();
        const product = PRODUCTS.find(p => p.id === productId);
        
        if (!product) {
            console.error('Produkt nenalezen:', productId);
            return false;
        }
        
        const existingItem = cart.find(item => item.id === productId);

        const tokens = (typeof product.tokens === 'number')
            ? product.tokens
            : (typeof product.tokenBonus === 'number')
                ? product.tokenBonus
                : (typeof product.price === 'number')
                    ? Math.max(1, Math.round(product.price / 100))
                    : 0;
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                category: product.category,
                tokens: tokens,
                quantity: quantity
            });
        }
        
        this.save(cart);
        this.showNotification(`${product.name} přidán do košíku`);
        return true;
    },
    
    // Odebrat produkt z košíku
    remove(productId) {
        let cart = this.get();
        cart = cart.filter(item => item.id !== productId);
        this.save(cart);
        return true;
    },
    
    // Aktualizovat množství
    updateQuantity(productId, quantity) {
        try {
            const cart = this.get();
            const item = cart.find(item => item.id === productId);
            
            if (item) {
                if (quantity <= 0) {
                    return this.remove(productId);
                }
                // Maximální množství 99
                item.quantity = Math.min(99, Math.max(1, parseInt(quantity) || 1));
                this.save(cart);
            }
            return true;
        } catch (error) {
            console.error('Update quantity error:', error);
            return false;
        }
    },
    
    // Debounced update pro input fieldy
    debouncedUpdate: null,
    updateQuantityDebounced(productId, quantity, callback) {
        clearTimeout(this.debouncedUpdate);
        this.debouncedUpdate = setTimeout(() => {
            this.updateQuantity(productId, quantity);
            if (callback) callback();
        }, 300);
    },
    
    // Vyprázdnit košík
    clear() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.updateBadge();
    },
    
    // Počet položek v košíku
    getCount() {
        const cart = this.get();
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    },
    
    // Celková cena
    getTotal() {
        const cart = this.get();
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    },
    
    // Aktualizovat badge v navigaci
    updateBadge() {
        const badge = document.getElementById('cart-count');
        if (badge) {
            const count = this.getCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    },
    
    // Zobrazit notifikaci
    showNotification(message, type = 'success') {
        // Odstranit existující notifikaci
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            ${message}
        `;
        document.body.appendChild(notification);
        
        // Animace zobrazení
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Automatické skrytí
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 400);
        }, 3000);
    }
};

// Inicializace badge při načtení stránky
document.addEventListener('DOMContentLoaded', () => {
    Cart.updateBadge();
});
