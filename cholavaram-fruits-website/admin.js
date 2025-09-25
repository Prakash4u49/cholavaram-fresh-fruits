import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc, getCountFromServer, where, Timestamp, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => { if (!user) { window.location.href = 'login.html'; } });

// --- STATE MANAGEMENT ---
let allOrders = [], allProducts = [], allCustomers = [];
let currentOrderView = 'open';

// --- DOM ELEMENT REFERENCES ---
const freeDeliveryToggle = document.getElementById('free-delivery-toggle');
// ... other existing DOM references ...

// --- PAGE NAVIGATION LOGIC ---
// ... existing navigateTo function ...

// --- DASHBOARD STATS LOGIC ---
async function updateDashboardStats() {
    // ... existing stats logic ...
    
    // NEW: Fetch and display delivery settings
    try {
        const settingsDoc = await getDoc(doc(db, "settings", "delivery"));
        if (settingsDoc.exists() && settingsDoc.data().isFreeDelivery) {
            freeDeliveryToggle.checked = true;
        } else {
            freeDeliveryToggle.checked = false;
        }
    } catch (error) {
        console.error("Error fetching delivery settings:", error);
        freeDeliveryToggle.checked = false;
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
            // MODIFIED: Added status display
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
    // MODIFIED: Added isChecked variable for the checkbox
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
    // MODIFIED: Added isOutOfStock to the updated data
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
// ... (handleDeleteProduct, fetchAndDisplayCustomers, and order logic functions are unchanged) ...

// --- EVENT LISTENERS ---
// ... (existing navigation and modal listeners are unchanged) ...

// NEW: Event listener for the free delivery toggle
freeDeliveryToggle.addEventListener('change', async () => {
    try {
        const settingsRef = doc(db, "settings", "delivery");
        await setDoc(settingsRef, { isFreeDelivery: freeDeliveryToggle.checked }, { merge: true });
        alert('Delivery settings updated!');
    } catch (error) {
        console.error("Error updating settings:", error);
        alert('Failed to update settings.');
    }
});

addProductForm.addEventListener('submit', async (e) => {
    // ... (existing form submission and image upload logic) ...
    try {
        // ...
        // MODIFIED: Added isOutOfStock to the new product data
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
        // ...
    } catch (error) {
        // ...
    } finally {
        // ...
    }
});
// ... (all other event listeners are unchanged) ...

// --- INITIALIZATION ---
// ... existing initialization ...