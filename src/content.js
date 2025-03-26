// Track user's Wikipedia activity
let startTime = Date.now();
let articleData = {
    url: window.location.href,
    title: document.title.replace(' - Wikipedia', ''),
    timestamp_start: startTime,
    timestamp_end: null,
    time_spent: 0,
    categories: [],
    language: window.location.hostname.split('.')[0]
};

// Fetch article categories
async function fetchCategories() {
    const articleTitle = articleData.title;
    const apiUrl = `https://${articleData.language}.wikipedia.org/w/api.php?action=query&prop=categories&titles=${encodeURIComponent(articleTitle)}&format=json&origin=*`;
    
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        articleData.categories = pages[pageId].categories?.map(cat => cat.title.replace('Category:', '')) || [];
    } catch (error) {
        console.error('Error fetching categories:', error);
    }
}

// Initialize tracking
async function initializeTracking() {
    await fetchCategories();
    chrome.runtime.sendMessage({
        type: 'VISIT_START',
        data: articleData
    });
}

// Update time spent when tab becomes inactive or user leaves
function updateTimeSpent() {
    articleData.timestamp_end = Date.now();
    articleData.time_spent = articleData.timestamp_end - articleData.timestamp_start;
    
    chrome.runtime.sendMessage({
        type: 'VISIT_END',
        data: articleData
    });
}

// Listen for page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        updateTimeSpent();
    } else {
        startTime = Date.now();
        articleData.timestamp_start = startTime;
    }
});

// Listen for page unload
window.addEventListener('beforeunload', () => {
    updateTimeSpent();
});

// Initialize tracking when content script loads
initializeTracking(); 