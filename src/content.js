// Track user's Wikipedia activity
let startTime = Date.now();
let clickedLinks = 0;
let isArticleRead = false; // Will be set to true if time spent > 1s
let articleData = {
    url: window.location.href,
    title: document.title.replace(' - Wikipedia', ''),
    timestamp_start: startTime,
    timestamp_end: null,
    time_spent: 0,
    categories: [],
    language: window.location.hostname.split('.')[0],
    clicked_links: 0,
    is_read: false
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

// Track clicked links in the article
function setupLinkTracking() {
    // Select all links in the article content (main article content only)
    const contentArea = document.getElementById('content') || document.getElementById('mw-content-text');
    if (!contentArea) return;
    
    const links = contentArea.querySelectorAll('a[href^="/wiki/"]');
    
    links.forEach(link => {
        link.addEventListener('click', () => {
            clickedLinks++;
            articleData.clicked_links = clickedLinks;
            
            // Send an update to the background script
            chrome.runtime.sendMessage({
                type: 'LINK_CLICKED',
                data: {
                    from_url: articleData.url,
                    from_title: articleData.title,
                    to_url: link.href,
                    to_title: link.textContent,
                    timestamp: Date.now()
                }
            });
        });
    });
}

// Initialize tracking
async function initializeTracking() {
    await fetchCategories();
    setupLinkTracking();
    
    chrome.runtime.sendMessage({
        type: 'VISIT_START',
        data: articleData
    });
    
    // Set a timeout to mark as read after 1 second
    setTimeout(() => {
        isArticleRead = true;
        articleData.is_read = true;
        chrome.runtime.sendMessage({
            type: 'ARTICLE_READ',
            data: {
                url: articleData.url,
                title: articleData.title,
                timestamp: Date.now()
            }
        });
    }, 1000);
}

// Update time spent when tab becomes inactive or user leaves
function updateTimeSpent() {
    articleData.timestamp_end = Date.now();
    articleData.time_spent = articleData.timestamp_end - articleData.timestamp_start;
    articleData.is_read = isArticleRead;
    articleData.clicked_links = clickedLinks;
    
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