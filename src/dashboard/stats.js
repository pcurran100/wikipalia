// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyA_d3h95h4j-hfvK6KZPJgZwRVQqeKuY5A",
    authDomain: "wikiwrap-85e55.firebaseapp.com",
    projectId: "wikiwrap-85e55",
    storageBucket: "wikiwrap-85e55.firebasestorage.app",
    messagingSenderId: "210626516537",
    appId: "1:210626516537:web:18635cdd5731d52ab95fe8",
    measurementId: "G-2YZYKZNJYM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Format time duration
function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hrs ${minutes % 60} min`;
}

// Format date
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Process and display data
function processData(visits) {
    // Calculate basic stats
    const uniqueArticles = new Set(visits.map(v => v.url)).size;
    const totalTime = visits.reduce((acc, v) => acc + (v.time_spent || 0), 0);
    
    document.getElementById('totalArticles').textContent = uniqueArticles;
    document.getElementById('totalTime').textContent = formatDuration(totalTime);

    // Calculate average session length
    const sessions = groupVisitsIntoSessions(visits);
    const avgSessionTime = sessions.reduce((acc, session) => {
        const sessionTime = session.reduce((sum, visit) => sum + (visit.time_spent || 0), 0);
        return acc + sessionTime;
    }, 0) / sessions.length;
    
    document.getElementById('avgSession').textContent = formatDuration(avgSessionTime);

    // Find most active day
    const dailyStats = {};
    visits.forEach(visit => {
        const date = new Date(visit.timestamp_start).toISOString().split('T')[0];
        if (!dailyStats[date]) {
            dailyStats[date] = { count: 0, time: 0 };
        }
        dailyStats[date].count++;
        dailyStats[date].time += visit.time_spent || 0;
    });

    const mostActiveDay = Object.entries(dailyStats)
        .sort(([,a], [,b]) => b.count - a.count)[0];
    
    document.getElementById('mostActiveDay').textContent = 
        `${formatDate(mostActiveDay[0])} (${mostActiveDay[1].count} articles)`;

    // Create categories chart
    createCategoriesChart(visits);

    // Create timeline chart
    createTimelineChart(dailyStats);

    // Populate data table
    populateTable(visits);
}

// Create categories chart
function createCategoriesChart(visits) {
    const categoryCount = {};
    visits.forEach(visit => {
        visit.categories?.forEach(category => {
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
    });

    const topCategories = Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

    const ctx = document.getElementById('categoriesChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topCategories.map(([cat]) => cat),
            datasets: [{
                label: 'Articles per Category',
                data: topCategories.map(([,count]) => count),
                backgroundColor: 'rgba(59, 130, 246, 0.8)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Create timeline chart
function createTimelineChart(dailyStats) {
    const dates = Object.keys(dailyStats).sort();
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(date => formatDate(date)),
            datasets: [{
                label: 'Articles Read',
                data: dates.map(date => dailyStats[date].count),
                borderColor: 'rgba(59, 130, 246, 0.8)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Populate data table
function populateTable(visits) {
    const tableData = visits.map(visit => ({
        date: formatDate(visit.timestamp_start),
        article: visit.title,
        timeSpent: formatDuration(visit.time_spent || 0),
        categories: (visit.categories || []).join(', ')
    }));

    new simpleDatatables.DataTable("#articleTable", {
        data: {
            headings: ["Date", "Article", "Time Spent", "Categories"],
            data: tableData.map(row => [row.date, row.article, row.timeSpent, row.categories])
        },
        searchable: true,
        sortable: true,
        perPage: 10
    });
}

// Group visits into sessions (visits within 30 minutes of each other)
function groupVisitsIntoSessions(visits) {
    const sortedVisits = [...visits].sort((a, b) => a.timestamp_start - b.timestamp_start);
    const sessions = [];
    let currentSession = [];
    
    sortedVisits.forEach(visit => {
        if (currentSession.length === 0) {
            currentSession.push(visit);
        } else {
            const lastVisit = currentSession[currentSession.length - 1];
            const timeDiff = visit.timestamp_start - lastVisit.timestamp_end;
            
            if (timeDiff <= 1800000) { // 30 minutes in milliseconds
                currentSession.push(visit);
            } else {
                if (currentSession.length > 1) {
                    sessions.push(currentSession);
                }
                currentSession = [visit];
            }
        }
    });
    
    if (currentSession.length > 1) {
        sessions.push(currentSession);
    }
    
    return sessions;
}

// Load data
async function loadData() {
    try {
        // Try to get data from IndexedDB first
        const dbRequest = indexedDB.open('WikipaliaDB', 1);
        
        dbRequest.onsuccess = async (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['visits'], 'readonly');
            const store = transaction.objectStore('visits');
            const visits = await store.getAll();
            
            // Also check Firebase if user is logged in
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const docRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(docRef);
                    
                    if (docSnap.exists()) {
                        const firebaseVisits = docSnap.data().visits;
                        // Merge local and Firebase data
                        const allVisits = [...visits, ...firebaseVisits];
                        // Remove duplicates based on timestamp
                        const uniqueVisits = Array.from(
                            new Map(allVisits.map(v => [v.timestamp_start, v])).values()
                        );
                        processData(uniqueVisits);
                    } else {
                        processData(visits);
                    }
                } else {
                    processData(visits);
                }
            });
        };
        
        dbRequest.onerror = (event) => {
            console.error('Error opening database:', event.target.error);
        };
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', loadData); 