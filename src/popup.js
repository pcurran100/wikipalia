// Import Firebase modules
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc 
} from 'firebase/firestore';

// Try to determine if we're in development mode
const isDev = !chrome.runtime.getManifest().update_url;

// Initialize Firebase when the script loads
async function initializeFirebase() {
    try {
        // Firebase configuration
        const firebaseConfig = {
             apiKey: "AIzaSyA_d3h95h4j-hfvK6KZPJgZwRVQqeKuY5A",
             authDomain: "wikiwrap-85e55.firebaseapp.com",
             projectId: "wikiwrap-85e55",
             storageBucket: "wikiwrap-85e55.firebasestorage.app",
             messagingSenderId: "210626516537",
             appId: "1:210626516537:web:a0147d159f06ae96b95fe8",
             measurementId: "G-XHL2FT09PD"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // Store for later use
        window.firebaseApp = app;
        window.firebaseAuth = auth;
        window.firebaseDb = db;

        console.log("Firebase initialized successfully");
        setupEventListeners(auth, db);
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        document.getElementById('loginStatus').textContent = 'Failed to initialize Firebase. Please try again later.';
    }
}

// DOM Elements
let loginStatus, viewStatsButton, loginButton, signInButton, registerButton,
    backToMainButton, googleSignInButton, mainView, loginView,
    todayArticles, todayTime, totalArticles, totalTime,
    emailInput, passwordInput;

// Get DOM elements
function getElements() {
    loginStatus = document.getElementById('loginStatus');
    viewStatsButton = document.getElementById('viewStats');
    loginButton = document.getElementById('loginButton');
    signInButton = document.getElementById('signInButton');
    registerButton = document.getElementById('registerButton');
    backToMainButton = document.getElementById('backToMain');
    googleSignInButton = document.getElementById('googleSignIn');
    mainView = document.getElementById('mainView');
    loginView = document.getElementById('loginView');
    todayArticles = document.getElementById('todayArticles');
    todayTime = document.getElementById('todayTime');
    totalArticles = document.getElementById('totalArticles');
    totalTime = document.getElementById('totalTime');
    emailInput = document.getElementById('email');
    passwordInput = document.getElementById('password');
}

// View Management
function showView(viewElement) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    viewElement.classList.add('active');
}

// Show error message in login form
function showError(message) {
    // Check if error message element exists, if not create it
    let errorElement = document.getElementById('error-message');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'error-message';
        errorElement.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm';
        const loginForm = document.getElementById('loginForm');
        loginForm.prepend(errorElement);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function formatDuration(ms) {
    // Format with hours, minutes, and seconds
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else {
        return `${minutes}m ${seconds}s`;
    }
}

function loadStats() {
    const today = new Date().toISOString().split('T')[0];
    const dbRequest = indexedDB.open('WikipaliaDB', 1);

    dbRequest.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['visits'], 'readonly');
        const visitStore = transaction.objectStore('visits');

        const dateIndex = visitStore.index('date');
        const todayRequest = dateIndex.getAll(IDBKeyRange.only(today));

        todayRequest.onsuccess = () => {
            const todayVisits = todayRequest.result;
            // Count unique articles
            const uniqueArticles = new Set(todayVisits.map(v => v.url)).size;
            // Calculate total time spent today
            const totalTimeToday = todayVisits.reduce((acc, visit) => acc + (visit.time_spent || 0), 0);

            // Update UI
            todayArticles.textContent = uniqueArticles;
            todayTime.textContent = formatDuration(totalTimeToday);
        };
    };

    dbRequest.onerror = (event) => {
        console.error('Error opening database:', event.target.error);
    };
}

// Set up event listeners
function setupEventListeners(auth, db) {
    // Stats button
    viewStatsButton.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard/index.html')
        });
    });

    // Login flow
    loginButton.addEventListener('click', () => {
        if (loginButton.textContent === 'Log In') {
            showView(loginView);
        } else {
            signOut(auth).then(() => {
                loginStatus.textContent = 'Not signed in';
                loginButton.textContent = 'Log In';
                
                // Send user logout message to background
                chrome.runtime.sendMessage({
                    type: "USER_LOGGED_OUT"
                });
            }).catch(error => {
                console.error('Error signing out:', error);
            });
        }
    });

    backToMainButton.addEventListener('click', () => showView(mainView));

    // Email/Password Sign In
    signInButton.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log('User signed in successfully');
            showView(mainView);
        } catch (error) {
            console.error('Sign in error:', error);
            
            // Handle specific error codes
            let errorMessage = 'Failed to sign in. Please try again.';
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email format.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'Account not found. Please register.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Please try again later.';
                    break;
            }
            
            showError(errorMessage);
        }
    });

    // Email/Password Registration
    registerButton.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }
        
        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }
        
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            console.log('User registered successfully');
            showView(mainView);
        } catch (error) {
            console.error('Registration error:', error);
            
            // Handle specific error codes
            let errorMessage = 'Failed to register. Please try again.';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Email already in use. Please sign in.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email format.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password is too weak.';
                    break;
            }
            
            showError(errorMessage);
        }
    });

    // Google Sign In
    googleSignInButton.addEventListener('click', async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            console.log('User signed in with Google successfully');
            showView(mainView);
        } catch (error) {
            console.error('Google sign in error:', error);
            showError('Failed to sign in with Google. Please try again.');
        }
    });

    // Auth listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            loginStatus.textContent = user.email;
            loginButton.textContent = 'Sign Out';
            await loadUserStats(user.uid, db);
        } else {
            loginStatus.textContent = 'Not signed in';
            loginButton.textContent = 'Log In';
            
            // Load local stats when not signed in
            loadStats();
        }
    });
}

async function loadUserStats(userId, db) {
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            const today = new Date().toISOString().split('T')[0];
            const todayData = data.dailyStats?.[today] || { articlesRead: 0, timeSpent: 0 };

            todayArticles.textContent = todayData.articlesRead;
            todayTime.textContent = `${Math.round(todayData.timeSpent / 60)} min`;
            totalArticles.textContent = data.totalArticles || 0;
            totalTime.textContent = `${Math.round((data.totalTimeSpent || 0) / 3600)} hrs`;
        } else {
            // If user document doesn't exist but user is logged in
            loadStats();
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
        // Fallback to local stats
        loadStats();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    getElements();
    showView(mainView);
    loadStats();
    initializeFirebase();
});
