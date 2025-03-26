import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import Chart from 'chart.js/auto';

// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const userEmail = document.getElementById('userEmail');
const signOutBtn = document.getElementById('signOutBtn');
const totalArticles = document.getElementById('totalArticles');
const totalTime = document.getElementById('totalTime');
const mostActiveDay = document.getElementById('mostActiveDay');
const avgTimePerArticle = document.getElementById('avgTimePerArticle');
const recentArticles = document.getElementById('recentArticles');

// Charts
let activityChart = null;
let categoriesChart = null;

// Sign Out Handler
signOutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.close();
    }).catch((error) => {
        console.error('Error signing out:', error);
    });
});

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmail.textContent = user.email;
        loadUserData(user.uid);
    } else {
        window.close();
    }
});

// Load User Data
async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const data = userDoc.data();
            updateStats(data);
            updateCharts(data);
            updateRecentArticles(data);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Update Stats
function updateStats(data) {
    totalArticles.textContent = data.totalArticles || 0;
    const hours = Math.round((data.totalTimeSpent || 0) / 3600);
    totalTime.textContent = `${hours} hrs`;

    // Calculate most active day
    const dailyStats = data.dailyStats || {};
    let maxArticles = 0;
    let maxDay = '-';
    
    Object.entries(dailyStats).forEach(([date, stats]) => {
        if (stats.articlesRead > maxArticles) {
            maxArticles = stats.articlesRead;
            maxDay = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    });
    
    mostActiveDay.textContent = maxDay;

    // Calculate average time per article
    if (data.totalArticles && data.totalTimeSpent) {
        const avgMinutes = Math.round((data.totalTimeSpent / 60) / data.totalArticles);
        avgTimePerArticle.textContent = `${avgMinutes} min`;
    }
}

// Update Charts
function updateCharts(data) {
    const dailyStats = data.dailyStats || {};
    const dates = Object.keys(dailyStats).sort();
    const articleCounts = dates.map(date => dailyStats[date].articlesRead);
    const timeSpent = dates.map(date => Math.round(dailyStats[date].timeSpent / 60)); // Convert to minutes

    // Activity Chart
    const ctx1 = document.getElementById('activityChart').getContext('2d');
    if (activityChart) activityChart.destroy();
    activityChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: dates.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [
                {
                    label: 'Articles Read',
                    data: articleCounts,
                    borderColor: 'rgb(59, 130, 246)',
                    tension: 0.1
                },
                {
                    label: 'Time Spent (min)',
                    data: timeSpent,
                    borderColor: 'rgb(16, 185, 129)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Categories Chart
    const categories = data.categories || {};
    const sortedCategories = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

    const ctx2 = document.getElementById('categoriesChart').getContext('2d');
    if (categoriesChart) categoriesChart.destroy();
    categoriesChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: sortedCategories.map(([category]) => category),
            datasets: [{
                label: 'Articles per Category',
                data: sortedCategories.map(([,count]) => count),
                backgroundColor: 'rgb(147, 51, 234)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Update Recent Articles
function updateRecentArticles(data) {
    const articles = data.articles || [];
    const sortedArticles = articles
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    recentArticles.innerHTML = sortedArticles.map(article => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <a href="${article.url}" target="_blank" class="text-blue-600 hover:text-blue-800">
                    ${article.title}
                </a>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-gray-500">
                ${new Date(article.timestamp).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-gray-500">
                ${Math.round(article.timeSpent / 60)} min
            </td>
        </tr>
    `).join('');
} 