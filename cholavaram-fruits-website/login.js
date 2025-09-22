import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Signed in successfully
            console.log("Login successful:", userCredential.user);
            window.location.href = 'admin.html'; // Redirect to admin panel
        })
        .catch((error) => {
            errorMessage.textContent = 'Error: Invalid email or password.';
            console.error("Login Error:", error);
        });
});