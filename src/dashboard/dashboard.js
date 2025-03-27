import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signOut, 
    onAuthStateChanged 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc 
} from 'firebase/firestore';
import Chart from 'chart.js/auto';

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

// State variables
let allVisits = [];
let filteredVisits = [];
let filterStart = null;
let filterEnd = null;
let currentPage = 1;
const itemsPerPage = 10;
let currentSortField = 'date';
let currentSortDirection = 'desc';
let searchTerm = '';

// DOM Elements
const userEmail = document.getElementById('userEmail');
const signOutBtn = document.getElementById('signOutBtn');
const totalArticles = document.getElementById('totalArticles');
const readArticles = document.getElementById('readArticles');
const totalTime = document.getElementById('totalTime');
const avgTimePerArticle = document.getElementById('avgTimePerArticle');
const favoriteCategories = document.getElementById('favoriteCategories');
const mostVisitedPages = document.getElementById('mostVisitedPages');
const longestVisitedPages = document.getElementById('longestVisitedPages');
const mostClickedLinksPages = document.getElementById('mostClickedLinksPages');
const articleHistory = document.getElementById('articleHistory');

// Filter buttons
const filterToday = document.getElementById('filterToday');
const filterWeek = document.getElementById('filterWeek');
const filterMonth = document.getElementById('filterMonth');
const filterYear = document.getElementById('filterYear');
const filterAllTime = document.getElementById('filterAllTime');
const filterCustom = document.getElementById('filterCustom');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');

// Pagination elements
const showingStart = document.getElementById('showingStart');
const showingEnd = document.getElementById('showingEnd');
const totalResults = document.getElementById('totalResults');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');

// Search and sort elements
const articleSearch = document.getElementById('articleSearch');
const articleSortBy = document.getElementById('articleSortBy');

// Charts
let activityChart = null;

// Helper functions
function formatDuration(ms) {
    // Format with hours, minutes, and seconds
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Set active filter button
function setActiveFilterButton(activeButton) {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.classList.remove('bg-blue-100', 'text-blue-800');
        btn.classList.add('bg-gray-100', 'text-gray-800');
    });
    activeButton.classList.remove('bg-gray-100', 'text-gray-800');
    activeButton.classList.add('bg-blue-100', 'text-blue-800');
}

// Date filters
function applyDateFilter(start, end) {
    filterStart = start;
    filterEnd = end;
    
    if (start && end) {
        filteredVisits = allVisits.filter(visit => {
            const visitDate = new Date(visit.timestamp || visit.date);
            return visitDate >= start && visitDate <= end;
        });
    } else {
        filteredVisits = [...allVisits];
    }

    currentPage = 1;
    updateStatsDisplay();
    updateArticleHistory();
    updateFavoriteCategories();
    updateFavoritePages();
}

// Filter event listeners
filterToday.addEventListener('click', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setActiveFilterButton(filterToday);
    applyDateFilter(today, tomorrow);
});

filterWeek.addEventListener('click', () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    
    setActiveFilterButton(filterWeek);
    applyDateFilter(weekStart, today);
});

filterMonth.addEventListener('click', () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const monthStart = new Date(today);
    monthStart.setMonth(today.getMonth() - 1);
    monthStart.setHours(0, 0, 0, 0);
    
    setActiveFilterButton(filterMonth);
    applyDateFilter(monthStart, today);
});

filterYear.addEventListener('click', () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const yearStart = new Date(today);
    yearStart.setFullYear(today.getFullYear() - 1);
    yearStart.setHours(0, 0, 0, 0);
    
    setActiveFilterButton(filterYear);
    applyDateFilter(yearStart, today);
});

filterAllTime.addEventListener('click', () => {
    setActiveFilterButton(filterAllTime);
    applyDateFilter(null, null);
});

filterCustom.addEventListener('click', () => {
    const startValue = dateFrom.value;
    const endValue = dateTo.value;
    
    if (startValue && endValue) {
        const start = new Date(startValue);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endValue);
        end.setHours(23, 59, 59, 999);
        
        applyDateFilter(start, end);
    }
});

// Search and sort
articleSearch.addEventListener('input', () => {
    searchTerm = articleSearch.value.toLowerCase();
    currentPage = 1;
    updateArticleHistory();
});

articleSortBy.addEventListener('change', () => {
    const [field, direction] = articleSortBy.value.split('-');
    currentSortField = field;
    currentSortDirection = direction;
    currentPage = 1;
    updateArticleHistory();
});

// Column header sort
document.querySelectorAll('th[data-sort]').forEach(header => {
    header.addEventListener('click', () => {
        const field = header.getAttribute('data-sort');
        
        if (currentSortField === field) {
            // Toggle direction
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortField = field;
            currentSortDirection = 'asc';
        }
        
        // Update select element to match
        articleSortBy.value = `${currentSortField}-${currentSortDirection}`;
        
        currentPage = 1;
        updateArticleHistory();
    });
});

// Pagination
prevPage.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        updateArticleHistory();
    }
});

nextPage.addEventListener('click', () => {
    const maxPage = Math.ceil(getFilteredAndSearchedVisits().length / itemsPerPage);
    if (currentPage < maxPage) {
        currentPage++;
        updateArticleHistory();
    }
});

// Get filtered and searched visits
function getFilteredAndSearchedVisits() {
    if (!searchTerm) {
        return filteredVisits;
    }
    
    return filteredVisits.filter(visit => 
        visit.title.toLowerCase().includes(searchTerm)
    );
}

// Sort visits
function sortVisits(visits) {
    return visits.sort((a, b) => {
        let valA, valB;
        
        switch (currentSortField) {
            case 'title':
                valA = a.title.toLowerCase();
                valB = b.title.toLowerCase();
                break;
            case 'date':
                valA = new Date(a.timestamp || a.date);
                valB = new Date(b.timestamp || b.date);
                break;
            case 'time':
                valA = a.time_spent;
                valB = b.time_spent;
                break;
            default:
                valA = new Date(a.timestamp || a.date);
                valB = new Date(b.timestamp || b.date);
        }
        
        // Handle nulls
        if (valA === null) return 1;
        if (valB === null) return -1;
        
        // Compare
        if (currentSortDirection === 'asc') {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }
    });
}

// Update article history table
function updateArticleHistory() {
    const searchedVisits = getFilteredAndSearchedVisits();
    const sortedVisits = sortVisits([...searchedVisits]);
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, sortedVisits.length);
    const visitsToShow = sortedVisits.slice(startIndex, endIndex);
    
    // Update pagination UI
    showingStart.textContent = sortedVisits.length > 0 ? startIndex + 1 : 0;
    showingEnd.textContent = endIndex;
    totalResults.textContent = sortedVisits.length;
    
    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = endIndex >= sortedVisits.length;
    
    // Clear table
    articleHistory.innerHTML = '';
    
    // Add rows
    visitsToShow.forEach(visit => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const titleCell = document.createElement('td');
        titleCell.className = 'px-6 py-4 whitespace-nowrap';
        
        const titleLink = document.createElement('a');
        titleLink.href = visit.url;
        titleLink.target = '_blank';
        titleLink.className = 'text-blue-600 hover:text-blue-800';
        titleLink.textContent = visit.title;
        
        titleCell.appendChild(titleLink);
        
        const dateCell = document.createElement('td');
        dateCell.className = 'px-6 py-4 whitespace-nowrap text-gray-500';
        dateCell.textContent = formatDate(visit.timestamp || visit.date);
        
        const timeCell = document.createElement('td');
        timeCell.className = 'px-6 py-4 whitespace-nowrap text-gray-500';
        timeCell.textContent = formatDuration(visit.time_spent);
        
        row.appendChild(titleCell);
        row.appendChild(dateCell);
        row.appendChild(timeCell);
        
        articleHistory.appendChild(row);
    });
    
    // Show "no results" message if needed
    if (visitsToShow.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 3;
        cell.className = 'px-6 py-4 text-center text-gray-500';
        cell.textContent = 'No articles found';
        row.appendChild(cell);
        articleHistory.appendChild(row);
    }
}

// Update favorite categories table
function updateFavoriteCategories() {
    // Aggregate category data
    const categoryData = {};
    
    filteredVisits.forEach(visit => {
        if (!visit.categories || !Array.isArray(visit.categories)) return;
        
        visit.categories.forEach(category => {
            if (!categoryData[category]) {
                categoryData[category] = {
                    name: category,
                    count: 0,
                    timeSpent: 0
                };
            }
            
            categoryData[category].count++;
            categoryData[category].timeSpent += visit.time_spent || 0;
        });
    });
    
    // Sort by count
    const sortedCategories = Object.values(categoryData)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10
    
    // Clear table
    favoriteCategories.innerHTML = '';
    
    // Add rows
    sortedCategories.forEach(category => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const nameCell = document.createElement('td');
        nameCell.className = 'px-6 py-4 whitespace-nowrap';
        nameCell.textContent = category.name;
        
        const countCell = document.createElement('td');
        countCell.className = 'px-6 py-4 whitespace-nowrap text-gray-500';
        countCell.textContent = category.count;
        
        const timeCell = document.createElement('td');
        timeCell.className = 'px-6 py-4 whitespace-nowrap text-gray-500';
        timeCell.textContent = formatDuration(category.timeSpent);
        
        row.appendChild(nameCell);
        row.appendChild(countCell);
        row.appendChild(timeCell);
        
        favoriteCategories.appendChild(row);
    });
    
    // Show "no data" message if needed
    if (sortedCategories.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 3;
        cell.className = 'px-6 py-4 text-center text-gray-500';
        cell.textContent = 'No category data available';
        row.appendChild(cell);
        favoriteCategories.appendChild(row);
    }
}

// Update favorite pages tables
function updateFavoritePages() {
    // Aggregate page visit data
    const pageData = {};
    
    filteredVisits.forEach(visit => {
        const url = visit.url;
        if (!url) return;
        
        if (!pageData[url]) {
            pageData[url] = {
                url: url,
                title: visit.title || 'Unknown Page',
                count: 0,
                timeSpent: 0,
                clickedLinks: visit.clicked_links || 0
            };
        }
        
        pageData[url].count++;
        pageData[url].timeSpent += visit.time_spent || 0;
        pageData[url].clickedLinks += visit.clicked_links || 0;
    });
    
    const pages = Object.values(pageData);
    
    // Most visited pages
    const mostVisited = [...pages]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    
    mostVisitedPages.innerHTML = '';
    
    mostVisited.forEach(page => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const titleCell = document.createElement('td');
        titleCell.className = 'px-6 py-4 whitespace-nowrap';
        
        const titleLink = document.createElement('a');
        titleLink.href = page.url;
        titleLink.target = '_blank';
        titleLink.className = 'text-blue-600 hover:text-blue-800';
        titleLink.textContent = page.title;
        
        titleCell.appendChild(titleLink);
        
        const countCell = document.createElement('td');
        countCell.className = 'px-6 py-4 whitespace-nowrap text-gray-500';
        countCell.textContent = page.count;
        
        row.appendChild(titleCell);
        row.appendChild(countCell);
        
        mostVisitedPages.appendChild(row);
    });
    
    // Longest visited pages
    const longestVisited = [...pages]
        .sort((a, b) => b.timeSpent - a.timeSpent)
        .slice(0, 10);
    
    longestVisitedPages.innerHTML = '';
    
    longestVisited.forEach(page => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const titleCell = document.createElement('td');
        titleCell.className = 'px-6 py-4 whitespace-nowrap';
        
        const titleLink = document.createElement('a');
        titleLink.href = page.url;
        titleLink.target = '_blank';
        titleLink.className = 'text-blue-600 hover:text-blue-800';
        titleLink.textContent = page.title;
        
        titleCell.appendChild(titleLink);
        
        const timeCell = document.createElement('td');
        timeCell.className = 'px-6 py-4 whitespace-nowrap text-gray-500';
        timeCell.textContent = formatDuration(page.timeSpent);
        
        row.appendChild(titleCell);
        row.appendChild(timeCell);
        
        longestVisitedPages.appendChild(row);
    });
    
    // Most clicked links pages
    const mostClicked = [...pages]
        .sort((a, b) => b.clickedLinks - a.clickedLinks)
        .filter(page => page.clickedLinks > 0)
        .slice(0, 10);
    
    mostClickedLinksPages.innerHTML = '';
    
    mostClicked.forEach(page => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const titleCell = document.createElement('td');
        titleCell.className = 'px-6 py-4 whitespace-nowrap';
        
        const titleLink = document.createElement('a');
        titleLink.href = page.url;
        titleLink.target = '_blank';
        titleLink.className = 'text-blue-600 hover:text-blue-800';
        titleLink.textContent = page.title;
        
        titleCell.appendChild(titleLink);
        
        const clicksCell = document.createElement('td');
        clicksCell.className = 'px-6 py-4 whitespace-nowrap text-gray-500';
        clicksCell.textContent = page.clickedLinks;
        
        row.appendChild(titleCell);
        row.appendChild(clicksCell);
        
        mostClickedLinksPages.appendChild(row);
    });
    
    // Show "no data" message if needed
    if (mostVisited.length === 0) {
        [mostVisitedPages, longestVisitedPages, mostClickedLinksPages].forEach(table => {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 2;
            cell.className = 'px-6 py-4 text-center text-gray-500';
            cell.textContent = 'No page data available';
            row.appendChild(cell);
            table.appendChild(row);
        });
    }
}

// Update activity chart
function updateActivityChart() {
    // Prepare data for chart - group by day
    const activityByDay = {};
    
    filteredVisits.forEach(visit => {
        const date = (visit.timestamp || visit.date).split('T')[0];
        
        if (!activityByDay[date]) {
            activityByDay[date] = {
                date: date,
                articleCount: 0,
                timeSpent: 0
            };
        }
        
        activityByDay[date].articleCount++;
        activityByDay[date].timeSpent += visit.time_spent || 0;
    });
    
    // Sort by date
    const sortedDays = Object.values(activityByDay)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Prepare chart data
    const labels = sortedDays.map(day => {
        const date = new Date(day.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const articleCounts = sortedDays.map(day => day.articleCount);
    const timeSpent = sortedDays.map(day => Math.round(day.timeSpent / 60000)); // Convert to minutes
    
    // Destroy existing chart if it exists
    if (activityChart) {
        activityChart.destroy();
    }
    
    // Create new chart
    const ctx = document.getElementById('activityChart').getContext('2d');
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Articles',
                    data: articleCounts,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.2,
                    yAxisID: 'y'
                },
                {
                    label: 'Time (minutes)',
                    data: timeSpent,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Articles'
                    },
                    position: 'left'
                },
                y1: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Minutes'
                    },
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Update all stats displays
function updateStatsDisplay() {
    // Count unique articles
    const uniqueUrls = new Set(filteredVisits.map(visit => visit.url));
    const totalArticlesCount = uniqueUrls.size;
    
    // Count read articles
    const readArticlesCount = filteredVisits.filter(visit => visit.is_read).length;
    
    // Calculate total time
    const totalTimeMs = filteredVisits.reduce((sum, visit) => sum + (visit.time_spent || 0), 0);
    
    // Calculate average time per read article
    const readVisits = filteredVisits.filter(visit => visit.is_read);
    const averageTimeMs = readVisits.length > 0 
        ? readVisits.reduce((sum, visit) => sum + (visit.time_spent || 0), 0) / readVisits.length 
        : 0;
    
    // Update UI
    totalArticles.textContent = totalArticlesCount;
    readArticles.textContent = readArticlesCount;
    totalTime.textContent = formatDuration(totalTimeMs);
    avgTimePerArticle.textContent = formatDuration(averageTimeMs);

    // Update charts and tables
    updateActivityChart();
}

// Sign Out Handler
signOutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.close();
    }).catch((error) => {
        console.error('Error signing out:', error);
    });
});

// Load user's visit data from IndexedDB
async function loadVisitData() {
    return new Promise((resolve, reject) => {
        const dbRequest = indexedDB.open('WikipaliaDB', 2);
        
        dbRequest.onerror = event => {
            console.error('Error opening database:', event.target.error);
            reject(event.target.error);
        };
        
        dbRequest.onsuccess = event => {
            const db = event.target.result;
            const transaction = db.transaction(['visits'], 'readonly');
            const store = transaction.objectStore('visits');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const visits = request.result;
                resolve(visits);
            };
            
            request.onerror = event => {
                console.error('Error loading visits:', event.target.error);
                reject(event.target.error);
            };
        };
    });
}

// Initialize dashboard
async function initDashboard() {
    try {
        // Set default date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        dateTo.valueAsDate = today;
        
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        dateFrom.valueAsDate = lastMonth;
        
        // Load all visits
        allVisits = await loadVisitData();
        
        // Apply default filter (today)
        filterToday.click();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmail.textContent = user.email;
        initDashboard();
    } else {
        // Redirect to popup if not signed in
        window.close();
    }
}); 