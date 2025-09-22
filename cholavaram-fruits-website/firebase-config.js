import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js"; // Import Auth

const firebaseConfig = {
    apiKey: "AIzaSyCnm-r8tdPZp5HAJv3PwLVCcU34sn7CPOo",
    authDomain: "sholavaram-fresh.firebaseapp.com",
    projectId: "sholavaram-fresh",
    storageBucket: "sholavaram-fresh.firebasestorage.app",
    messagingSenderId: "922084633397",
    appId: "1:922084633397:web:445b47d6342a9251d9ba7c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app); // Initialize Auth

// Export the services
export { db, storage, auth };