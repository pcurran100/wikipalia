import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const todayArticles = document.getElementById('todayArticles');
const todayTime = document.getElementById('todayTime');
const totalArticles = document.getElementById('totalArticles');
const totalTime = document.getElementById('totalTime');
const loginStatus = document.getElementById('loginStatus');
const viewStatsButton = document.getElementById('viewStats');
const loginButton = document.getElementById('loginButton');
const backToMainButton = document.getElementById('backToMain');
const googleSignInButton = document.getElementById('googleSignIn');
const mainView = document.getElementById('mainView');
const loginView = document.getElementById('loginView');

// View Management
function showView(viewElement) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    viewElement.classList.add('active');
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hrs ${minutes % 60} min`;
}

function loadStats() {
    const today = new Date().toISOString().split('T')[0];
    const dbRequest = indexedDB.open('WikipaliaDB', 1);

    dbRequest.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['visits', 'sessions'], 'readonly');
        const visitStore = transaction.objectStore('visits');
        const sessionStore = transaction.objectStore('sessions');

        const dateIndex = visitStore.index('date');
        const todayRequest = dateIndex.getAll(IDBKeyRange.only(today));

        todayRequest.onsuccess = () => {
            const todayVisits = todayRequest.result;
            const uniqueArticles = new Set(todayVisits.map(v => v.url)).size;
            const totalTimeToday = todayVisits.reduce((acc, visit) => acc + (visit.time_spent || 0), 0);

            todayArticles.textContent = uniqueArticles;
            todayTime.textContent = formatDuration(totalTimeToday);
        };
    };
}

// Stats button
viewStatsButton.addEventListener('click', () => {
    chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard/stats.html')
    });
});

// Login flow
loginButton.addEventListener('click', () => showView(loginView));
backToMainButton.addEventListener('click', () => showView(mainView));

googleSignInButton.addEventListener('click', async () => {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Send user info to background
        chrome.runtime.sendMessage({
            type: "USER_LOGGED_IN",
            payload: {
                uid: user.uid,
                email: user.email
            }
        });

        showView(mainView);
    } catch (error) {
        console.error('Error signing in:', error);
    }
});

// Auth listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginStatus.textContent = user.email;
        loginButton.textContent = 'Sign Out';
        loginButton.onclick = () => signOut(auth);
        await loadUserStats(user.uid);
    } else {
        loginStatus.textContent = 'Not signed in';
        loginButton.textContent = 'Log In';
        loginButton.onclick = () => showView(loginView);
    }
});

async function loadUserStats(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const data = userDoc.data();
            const today = new Date().toISOString().split('T')[0];
            const todayData = data.dailyStats?.[today] || { articlesRead: 0, timeSpent: 0 };

            todayArticles.textContent = todayData.articlesRead;
            todayTime.textContent = `${Math.round(todayData.timeSpent / 60)} min`;
            totalArticles.textContent = data.totalArticles || 0;
            totalTime.textContent = `${Math.round((data.totalTimeSpent || 0) / 3600)} hrs`;
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    showView(mainView);
    loadStats();
});
