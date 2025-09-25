// Import the necessary Firebase services
import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc, getCountFromServer, where, Timestamp, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = 'login.html'; }
});

// --- STATE MANAGEMENT ---
let allOrders = [], allProducts = [], allCustomers = [];
let currentOrderView = 'open';

// --- DOM ELEMENT REFERENCES ---
const navLinks = {
    dashboard: document.getElementById('nav-dashboard'),
    products: document.getElementById('nav-products'),
    orders: document.getElementById('nav-orders'),
    customers: document.getElementById('nav-customers')
};
const sections = {
    dashboard: document.getElementById('dashboard-section'),
    products: document.getElementById('products-section'),
    orders: document.getElementById('orders-section'),
    customers: document.getElementById('customers-section')
};
const logoutBtn = document.getElementById('logout-btn');
const freeDeliveryToggle = document.getElementById('free-delivery-toggle');

// Product related DOM
const addProductView = document.getElementById('add-product-view');
const viewProductsView = document.getElementById('view-products-view');
const addProductForm = document.getElementById('product-form');
const productsTableBody = document.getElementById('products-table')?.querySelector('tbody');
const viewProductsTab = document.getElementById('view-products-tab');
const addProductTab = document.getElementById('add-product-tab');

// Customer related DOM
const customersTableBody = document.getElementById('customers-table')?.querySelector('tbody');

// Order related DOM
const ordersListContainer = document.getElementById('orders-list-container');
const openOrdersTab = document.getElementById('open-orders-tab');
const closedOrdersTab = document.getElementById('closed-orders-tab');

// Edit Modal DOM
const editProductModal = document.getElementById('edit-product-modal');
const editProductForm = document.getElementById('edit-product-form');
const closeModalBtn = editProductModal.querySelector('.close-button');

// --- PAGE NAVIGATION LOGIC ---
function navigateTo(sectionName) {
    Object.values(sections).forEach(section => section.classList.add('hidden'));
    Object.values(navLinks).forEach(link => link.classList.remove('active'));
    
    if(sections[sectionName]) sections[sectionName].classList.remove('hidden');
    if(navLinks[sectionName]) navLinks[sectionName].classList.add('active');

    if (sectionName === 'dashboard') updateDashboardStats();
    if (sectionName === 'products') fetchAndDisplayProducts();
    if (sectionName === 'orders') fetchAndDisplayOrders();
    if (sectionName === 'customers') fetchAndDisplayCustomers();
}

// --- DASHBOARD STATS LOGIC ---
async function updateDashboardStats() {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const ordersQuery = query(collection(db, "orders"), where("createdAt", ">=", Timestamp.fromDate(todayStart)));
        const todaysOrdersSnapshot = await getDocs(ordersQuery);
        
        const todaysOrders = todaysOrdersSnapshot.docs.map(doc => doc.data());
        const todaysEarnings = todaysOrders.reduce((sum, order) => sum + order.total, 0);
        document.getElementById('stats-today-orders').textContent = todaysOrders.length;
        document.getElementById('stats-today-earnings').textContent = todaysEarnings.toFixed(2);

        const productsCount = (await getCountFromServer(collection(db, "products"))).data().count;
        const customersCount = (await getCountFromServer(collection(db, "customers"))).data().count;
        document.getElementById('stats-total-products').textContent = productsCount;
        document.getElementById('stats-total-customers').textContent = customersCount;

        // Fetch and display delivery settings
        const settingsDoc = await getDoc(doc(db, "settings", "delivery"));
        freeDeliveryToggle.checked = settingsDoc.exists() && settingsDoc.data().isFreeDelivery;

    } catch (error) {
        console.error("Error calculating stats or settings:", error);
    }
}

// --- PRODUCT MANAGEMENT LOGIC ---
async function fetchAndDisplayProducts() {
    try {
        const querySnapshot = await getDocs(query(collection(db, "products"), orderBy("productName")));
        allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        productsTableBody.innerHTML = '';
        allProducts.forEach(product => {
            const row = productsTableBody.insertRow();
            const imageUrl = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : '';
            const status = product.isOutOfStock ? 
                '<span class="status-out-of-stock">Out of Stock</span>' : 
                '<span class="status-in-stock">In Stock</span>';
            row.innerHTML = `
                <td><img src="${imageUrl}" alt="${product.productName}" class="product-image-thumbnail"></td>
                <td>${product.productName}</td>
                <td>₹${product.price}</td>
                <td>₹${product.actualPrice || 'N/A'}</td>
                <td>${status}</td>
                <td>
                    <button class="action-btn edit-btn" data-id="${product.id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${product.id}">Delete</button>
                </td>
            `;
        });
    } catch (error) { console.error("Error fetching products:", error); }
}

function openEditModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const isChecked = product.isOutOfStock ? 'checked' : '';
    editProductForm.innerHTML = `
        <input type="hidden" id="edit-product-id" value="${product.id}">
        <div class="form-group"><label>Product Name</label><input type="text" id="edit-product-name" value="${product.productName}" required></div>
        <div class="form-group"><label>Description</label><textarea id="edit-product-description" rows="3">${product.description || ''}</textarea></div>
        <div class="form-row">
            <div class="form-group"><label>Offer Price (₹)</label><input type="number" id="edit-product-price" value="${product.price}" required></div>
            <div class="form-group"><label>Actual Price (MRP)</label><input type="number" id="edit-product-actual-price" value="${product.actualPrice || ''}"></div>
        </div>
        <div class="form-group-checkbox">
            <input type="checkbox" id="edit-product-out-of-stock" ${isChecked}>
            <label for="edit-product-out-of-stock">Mark as Out of Stock</label>
        </div>
        <div class="form-actions"><button type="submit" class="save-btn">Save Changes</button></div>`;
    editProductModal.style.display = 'block';
}

async function handleUpdateProduct(e) {
    e.preventDefault();
    const productId = document.getElementById('edit-product-id').value;
    const updatedData = {
        productName: document.getElementById('edit-product-name').value,
        description: document.getElementById('edit-product-description').value,
        price: parseFloat(document.getElementById('edit-product-price').value),
        actualPrice: parseFloat(document.getElementById('edit-product-actual-price').value) || 0,
        isOutOfStock: document.getElementById('edit-product-out-of-stock').checked
    };
    try {
        await updateDoc(doc(db, "products", productId), updatedData);
        editProductModal.style.display = 'none';
        fetchAndDisplayProducts();
    } catch (error) { console.error("Error updating product:", error); }
}

async function handleDeleteProduct(productId) {
    if (confirm("Are you sure you want to delete this product?")) {
        try {
            await deleteDoc(doc(db, "products", productId));
            fetchAndDisplayProducts();
        } catch (error) { console.error("Error deleting product:", error); }
    }
}

// --- CUSTOMER MANAGEMENT LOGIC ---
async function fetchAndDisplayCustomers() {
    try {
        const querySnapshot = await getDocs(query(collection(db, "customers"), orderBy("name")));
        allCustomers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        customersTableBody.innerHTML = '';
        allCustomers.forEach(customer => {
            const row = customersTableBody.insertRow();
            row.innerHTML = `<td>${customer.name}</td><td>${customer.phone}</td><td>${customer.address}</td>`;
        });
    } catch (error) { console.error("Error fetching customers:", error); }
}

// --- ORDER MANAGEMENT LOGIC ---
// ... (all existing order functions: formatWeight, displayFilteredOrders, fetchAndDisplayOrders are unchanged) ...

// --- EVENT LISTENERS ---
navLinks.dashboard.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
// ... (other nav links, modal listeners, product tab listeners are unchanged) ...

freeDeliveryToggle.addEventListener('change', async () => {
    try {
        await setDoc(doc(db, "settings", "delivery"), { isFreeDelivery: freeDeliveryToggle.checked }, { merge: true });
        alert('Delivery settings updated!');
    } catch (error) {
        console.error("Error updating settings:", error);
        alert('Failed to update settings.');
    }
});

addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.save-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
        const imageFiles = document.getElementById('product-image').files;
        if (imageFiles.length === 0) throw new Error("Please select at least one image.");
        if (imageFiles.length > 4) throw new Error("You can upload a maximum of 4 images.");
        
        const imageUrls = [];
        for (const file of imageFiles) {
            const imageRef = ref(storage, `product-images/${Date.now()}_${file.name}`);
            await uploadBytes(imageRef, file);
            imageUrls.push(await getDownloadURL(imageRef));
        }
        
        const productData = {
            productName: document.getElementById('product-name').value,
            description: document.getElementById('product-description').value,
            actualPrice: parseFloat(document.getElementById('product-actual-price').value) || 0,
            price: parseFloat(document.getElementById('product-price').value),
            unit: document.getElementById('product-unit').value,
            imageUrls,
            isOutOfStock: document.getElementById('product-out-of-stock').checked
        };
        await addDoc(collection(db, "products"), productData);
        alert("Product added successfully!");
        addProductForm.reset();
        viewProductsTab.click();
        fetchAndDisplayProducts();
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        btn.disabled = false; btn.textContent = 'Save Product';
    }
});

// ... (all other event listeners are unchanged) ...

// --- INITIALIZATION ---
navigateTo('dashboard');
