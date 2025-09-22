// Import the necessary Firebase services
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, serverTimestamp, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// --- STATE MANAGEMENT & CONSTANTS ---
const serviceablePincodes = ["600067", "600052"];
const DELIVERY_CHARGE = 30.00;
let cart = [];
let products = [];

// --- DOM ELEMENT REFERENCES ---
const productGrid = document.querySelector('.product-grid');
const cartCountSpan = document.getElementById('cart-count');
const toastContainer = document.getElementById('toast-container');
const pincodeInput = document.getElementById('pincode-input');
const pincodeButton = document.getElementById('pincode-btn');

// Cart icon reference is now the floating button
const floatingCartBtn = document.getElementById('floating-cart-btn');

// Cart Modal Elements
const cartModal = document.getElementById('cart-modal');
const closeCartButton = cartModal.querySelector('.close-button');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartModalSubtotalSpan = document.getElementById('cart-modal-subtotal');
const checkoutBtn = document.getElementById('checkout-btn');

// Checkout Modal Elements
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutButton = checkoutModal.querySelector('.close-button');
const checkoutForm = document.getElementById('checkout-form');
const customerPhoneInput = document.getElementById('customer-phone');
const customerNameInput = document.getElementById('customer-name');
const customerAddressInput = document.getElementById('customer-address');
const addressGroup = document.getElementById('address-group');
const storePickupInfo = document.getElementById('store-pickup-info');
const deliveryTypeRadios = document.querySelectorAll('input[name="delivery-type"]');
const checkoutSubtotalSpan = document.getElementById('checkout-subtotal');
const checkoutDeliveryChargeSpan = document.getElementById('checkout-delivery-charge');
const checkoutTotalSpan = document.getElementById('checkout-total');


// --- HELPER FUNCTIONS ---
function formatWeight(grams) {
    if (grams < 1000) { return `${grams} g`; }
    else { const kg = grams / 1000; return `${parseFloat(kg.toFixed(1))} kg`; }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// --- RENDERING LOGIC ---
function calculateItemPrice(item) {
    const unit = item.unit || 'piece';
    if (unit === 'kg') { return (item.price / 1000) * item.quantity; }
    else { return item.price * item.quantity; }
}

function updateCheckoutSummary() {
    const subtotal = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);
    const selectedDeliveryType = document.querySelector('input[name="delivery-type"]:checked').value;
    const deliveryCharge = selectedDeliveryType === 'delivery' ? DELIVERY_CHARGE : 0;
    const total = subtotal + deliveryCharge;

    checkoutSubtotalSpan.textContent = subtotal.toFixed(2);
    checkoutDeliveryChargeSpan.textContent = deliveryCharge.toFixed(2);
    checkoutTotalSpan.textContent = total.toFixed(2);
}

function renderProducts() {
    if (!productGrid) { return; }
    if (products.length === 0) {
        productGrid.innerHTML = "<p>No products available at the moment. Add some from the admin panel!</p>";
        return;
    }
    let html = "";
    products.forEach(product => {
        const productName = product.productName || 'Unnamed Product';
        const description = product.description || '';
        const imageUrl = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : 'https://via.placeholder.com/300x200.png?text=No+Image';
        const price = product.price || 0;
        const actualPrice = product.actualPrice || 0;
        const unit = product.unit || 'piece';
        let priceHTML = `<div class="price-container"><span class="offer-price">₹${price} / ${unit}</span>`;
        if (actualPrice > price) { priceHTML += `<span class="actual-price">₹${actualPrice}</span>`; }
        priceHTML += `</div>`;
        let offerBadgeHTML = '';
        if (actualPrice > price) {
            const discount = Math.round(((actualPrice - price) / actualPrice) * 100);
            offerBadgeHTML = `<div class="offer-badge">${discount}% OFF</div>`;
        }
        let quantitySelectorHTML = '';
        if (unit === 'kg') {
            quantitySelectorHTML = `<div class="quantity-stepper"><button class="quantity-btn minus" aria-label="Decrease quantity">-</button><input type="text" class="quantity-input" value="500 g" data-grams="500" readonly><button class="quantity-btn plus" aria-label="Increase quantity">+</button></div>`;
        } else {
            quantitySelectorHTML = `<div class="quantity-stepper"><button class="quantity-btn minus" aria-label="Decrease quantity">-</button><input type="text" class="quantity-input" value="1 ${unit}" data-grams="1" readonly><button class="quantity-btn plus" aria-label="Increase quantity">+</button></div>`;
        }
        html += `
            <div class="product-card" data-id="${product.id}" data-unit="${unit}">
                ${offerBadgeHTML}
                <img src="${imageUrl}" alt="${productName}">
                <h3>${productName}</h3>
                <p class="product-origin">${description}</p>
                ${priceHTML}
                <div class="product-actions">
                    ${quantitySelectorHTML}
                    <button class="add-to-cart-btn">Add to Cart</button>
                </div>
            </div>`;
    });
    productGrid.innerHTML = html;
}

function renderCart() {
    // Show/hide floating cart button
    if (cart.length > 0) {
        floatingCartBtn.classList.add('visible');
    } else {
        floatingCartBtn.classList.remove('visible');
    }

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = "<p>Your cart is empty.</p>";
        if (checkoutBtn) checkoutBtn.style.display = 'none';
    } else {
        if (checkoutBtn) checkoutBtn.style.display = 'block';
        let html = "";
        cart.forEach(item => {
            const unit = item.unit || 'piece';
            const displayQuantity = unit === 'kg' ? formatWeight(item.quantity) : `${item.quantity} ${item.unit}(s)`;
            const itemPrice = calculateItemPrice(item);
            const imageUrl = (item.imageUrls && item.imageUrls.length > 0) ? item.imageUrls[0] : 'https://via.placeholder.com/300x200.png?text=No+Image';
            html += `
                <div class="cart-item" data-id="${item.id}">
                    <img src="${imageUrl}" alt="${item.productName}" class="cart-item-img">
                    <div class="cart-item-details">
                        <h4>${item.productName}</h4>
                        <p>₹${itemPrice.toFixed(2)}</p>
                    </div>
                    <div class="cart-item-actions">
                        <div class="quantity-stepper">
                             <button class="quantity-btn minus" aria-label="Decrease quantity">-</button>
                             <input type="text" class="quantity-input" value="${displayQuantity}" readonly>
                             <button class="quantity-btn plus" aria-label="Increase quantity">+</button>
                        </div>
                        <button class="remove-item-btn" aria-label="Remove item">&times;</button>
                    </div>
                </div>`;
        });
        cartItemsContainer.innerHTML = html;
    }
    const subtotal = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);
    cartModalSubtotalSpan.textContent = subtotal.toFixed(2);
    cartCountSpan.textContent = cart.length;
}

// --- CART MANAGEMENT ---
function addToCart(productId, quantity) {
    const productToAdd = products.find(p => p.id === productId);
    if (!productToAdd) return;
    const existingCartItem = cart.find(item => item.id === productId);
    if (existingCartItem) {
        existingCartItem.quantity += quantity;
    } else {
        cart.push({ ...productToAdd, quantity: quantity });
    }
    showToast(`${productToAdd.productName} added to cart`);
    renderCart();
}

function updateCartItemQuantity(productId, newQuantity) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity = newQuantity;
        if (item.quantity <= 0) {
            removeCartItem(productId);
        } else {
            renderCart();
        }
    }
}

function removeCartItem(productId) {
    cart = cart.filter(item => item.id !== productId);
    renderCart();
}

// --- EVENT LISTENERS ---
if (floatingCartBtn) {
    floatingCartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderCart();
        cartModal.style.display = 'block';
    });
}

if (pincodeButton) {
    pincodeButton.addEventListener('click', () => {
        const pincode = pincodeInput.value.trim();
        pincodeInput.classList.remove('success', 'error');
        if (pincode.length !== 6) { showToast("Please enter a valid 6-digit pincode."); pincodeInput.classList.add('error'); return; }
        if (serviceablePincodes.includes(pincode)) { showToast("Great! We deliver to your area."); pincodeInput.classList.add('success'); }
        else { showToast("Sorry, we don't deliver to this pincode yet."); pincodeInput.classList.add('error'); }
    });
}

if (closeCartButton) closeCartButton.addEventListener('click', () => { cartModal.style.display = 'none'; });
window.addEventListener('click', (event) => { if (event.target === cartModal) cartModal.style.display = 'none'; });

if (closeCheckoutButton) closeCheckoutButton.addEventListener('click', () => { checkoutModal.style.display = 'none'; });
window.addEventListener('click', (event) => { if (event.target === checkoutModal) checkoutModal.style.display = 'none'; });

if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        cartModal.style.display = 'none';
        checkoutModal.style.display = 'block';
        updateCheckoutSummary();
    });
}

function handleDeliveryTypeChange() {
    const selectedValue = document.querySelector('input[name="delivery-type"]:checked').value;
    if (selectedValue === 'delivery') {
        addressGroup.classList.remove('hidden');
        storePickupInfo.classList.add('hidden');
        customerAddressInput.required = true;
    } else {
        addressGroup.classList.add('hidden');
        storePickupInfo.classList.remove('hidden');
        customerAddressInput.required = false;
    }
    updateCheckoutSummary();
}
deliveryTypeRadios.forEach(radio => radio.addEventListener('change', handleDeliveryTypeChange));

if (customerPhoneInput) {
    customerPhoneInput.addEventListener('input', async () => {
        const phone = customerPhoneInput.value.trim();
        if (phone.length !== 10) { customerNameInput.value = ''; customerAddressInput.value = ''; return; }
        try {
            const docSnap = await getDoc(doc(db, "customers", phone));
            if (docSnap.exists()) {
                const data = docSnap.data();
                customerNameInput.value = data.name || '';
                customerAddressInput.value = data.address || '';
            } else { customerNameInput.value = ''; customerAddressInput.value = ''; }
        } catch (error) { console.error("Error fetching customer:", error); }
    });
}

if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const btn = checkoutForm.querySelector('.place-order-btn');
        btn.disabled = true;
        btn.textContent = 'Placing Order...';

        try {
            const deliveryType = document.querySelector('input[name="delivery-type"]:checked').value;
            const subtotal = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);
            const deliveryCharge = deliveryType === 'delivery' ? DELIVERY_CHARGE : 0;
            const total = subtotal + deliveryCharge;
            
            const customerDetails = {
                name: customerNameInput.value, phone: customerPhoneInput.value,
                address: deliveryType === 'delivery' ? customerAddressInput.value : 'N/A (Store Pickup)'
            };
            await setDoc(doc(db, "customers", customerDetails.phone), customerDetails, { merge: true });

            const orderData = {
                customer: customerDetails, items: cart, subtotal: subtotal,
                deliveryCharge: deliveryCharge, total: total, deliveryType: deliveryType,
                status: 'New', createdAt: serverTimestamp()
            };
            await addDoc(collection(db, "orders"), orderData);
            
            showToast('Thank you! Your order has been placed successfully.');
            cart = [];
            renderCart();
            checkoutForm.reset();
            handleDeliveryTypeChange();
            checkoutModal.style.display = 'none';

        } catch (error) {
            console.error("Order placement error: ", error);
            showToast('Sorry, there was an issue placing your order.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Place Order';
        }
    });
}

if (productGrid) {
    productGrid.addEventListener('click', (event) => {
        const target = event.target;
        const card = target.closest('.product-card');
        if (!card) return;
        const unit = card.dataset.unit;
        const input = card.querySelector('.quantity-input');
        if (!input) return;
        let currentGrams = parseInt(input.dataset.grams, 10);
        if (target.classList.contains('quantity-btn')) {
            const increment = (unit === 'kg') ? 500 : 1;
            const minValue = (unit === 'kg') ? 500 : 1;
            if (target.classList.contains('plus')) currentGrams += increment;
            else if (target.classList.contains('minus')) currentGrams = Math.max(minValue, currentGrams - increment);
            input.dataset.grams = currentGrams;
            input.value = (unit === 'kg') ? formatWeight(currentGrams) : `${currentGrams} ${unit}`;
        }
        if (target.classList.contains('add-to-cart-btn')) { addToCart(card.dataset.id, currentGrams); }
    });
}

cartItemsContainer.addEventListener('click', (event) => {
    const target = event.target;
    const itemDiv = target.closest('.cart-item');
    if (!itemDiv) return;
    const productId = itemDiv.dataset.id;
    const itemInCart = cart.find(i => i.id === productId);
    if (!itemInCart) return;
    if (target.classList.contains('remove-item-btn')) { removeCartItem(productId); }
    else if (target.classList.contains('quantity-btn')) {
        const increment = (itemInCart.unit === 'kg') ? 500 : 1;
        let newQuantity = itemInCart.quantity;
        if (target.classList.contains('plus')) { newQuantity += increment; }
        else if (target.classList.contains('minus')) { newQuantity -= increment; }
        updateCartItemQuantity(productId, newQuantity);
    }
});

// --- INITIALIZATION ---
async function initializeShop() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        products = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts();
    } catch (error) {
        if (productGrid) productGrid.innerHTML = "<p>Sorry, we couldn't load products.</p>";
    }
    handleDeliveryTypeChange();
}

initializeShop();