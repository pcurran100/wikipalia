// Track user's Wikipedia activity
let startTime = null;
let activeTime = 0;
let clickedLinks = 0;
let isArticleRead = false; // Will be set to true if active time spent > 1s
let isActive = false; // To track if tab is active
let trackingInterval = null;
let lastActiveCheck = Date.now();

// Filter out Wikipedia home page and generic pages
const isGenericPage = () => {
    const url = window.location.href;
    // Skip tracking for the Wikipedia home page
    if (url === 'https://www.wikipedia.org/' || url.includes('Wikipedia:')) {
        return true;
    }
    // Skip Special: pages
    if (url.includes('/wiki/Special:')) {
        return true;
    }
    // Skip Help: pages
    if (url.includes('/wiki/Help:')) {
        return true;
    }
    // Skip Talk: pages
    if (url.includes('/wiki/Talk:')) {
        return true;
    }
    return false;
};

// Don't track generic Wikipedia pages
if (isGenericPage()) {
    console.log('Skipping tracking for generic Wikipedia page');
    // Exit early - don't track this page
    throw new Error('Skip tracking for this page');
}

let articleData = {
    url: window.location.href,
    title: document.title.replace(' - Wikipedia', ''),
    timestamp_start: Date.now(),
    timestamp_end: null,
    time_spent: 0,
    categories: [],
    language: window.location.hostname.split('.')[0],
    clicked_links: 0,
    is_read: false
};

// Fetch article categories and normalize them
async function fetchCategories() {
    const articleTitle = articleData.title;
    const apiUrl = `https://${articleData.language}.wikipedia.org/w/api.php?action=query&prop=categories&titles=${encodeURIComponent(articleTitle)}&format=json&origin=*`;
    
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        
        // Get raw categories
        const rawCategories = pages[pageId].categories?.map(cat => cat.title.replace('Category:', '')) || [];
        
        // Normalize categories to make them more useful
        articleData.categories = normalizeCategories(rawCategories);
    } catch (error) {
        console.error('Error fetching categories:', error);
    }
}

// Normalize categories to make them more general and useful
function normalizeCategories(rawCategories) {
    // Skip categories that are too specific or technical
    const excludedPatterns = [
        /All articles with/i, 
        /Articles with/i,
        /Articles containing/i,
        /CS1/i,
        /Use \w+ from/i, 
        /Pages with/i,
        /Webarchive/i,
        /Articles needing/i,
        /All stub/i,
        /stubs$/i,
        /Wikipedia/i,
        /Wikidata/i,
        /Use mdy dates/i,
        /Articles created/i,
        /Articles with dead/i,
        /^\d+s? (births|deaths)$/i, // Birth/death year categories
        /^\d+s? establishments/i // Establishment year categories
    ];
    
    // Convert specific year/date categories to general ones
    const generalCategories = {};
    
    // Process each category
    const normalizedCategories = rawCategories.filter(category => {
        // Skip excluded patterns
        for (const pattern of excludedPatterns) {
            if (pattern.test(category)) {
                return false;
            }
        }
        
        // If it's a birth/death category, add to a general "People" category
        if (/births|deaths|biography|biographies|people|politicians|writers|musicians|actors|athletes/i.test(category)) {
            generalCategories["People"] = true;
        }
        // If it's a place category, add to a general "Places" category
        else if (/cities|countries|towns|geography|locations|region|regions|states|provinces|places/i.test(category)) {
            generalCategories["Geography"] = true;
        }
        // If it's an organization category, add to a general "Organizations" category
        else if (/companies|organizations|organisations|institutions|government|agencies|schools|universities/i.test(category)) {
            generalCategories["Organizations"] = true;
        }
        // If it's a history category, add to a general "History" category
        else if (/history|historical|ancient|medieval|century|war|wars|revolution/i.test(category)) {
            generalCategories["History"] = true;
        }
        // If it's a science category, add to a general "Science" category
        else if (/science|scientific|physics|chemistry|biology|mathematics|geology|astronomy/i.test(category)) {
            generalCategories["Science"] = true;
        }
        // If it's a technology category, add to a general "Technology" category
        else if (/technology|software|computing|internet|electronics|engineering/i.test(category)) {
            generalCategories["Technology"] = true;
        }
        // If it's an art category, add to a general "Arts" category
        else if (/arts|art|literature|music|film|movies|entertainment|painting|sculpture/i.test(category)) {
            generalCategories["Arts & Entertainment"] = true;
        }
        // If it's a sports category, add to a general "Sports" category
        else if (/sports|sport|football|basketball|soccer|baseball|olympics|athletes/i.test(category)) {
            generalCategories["Sports"] = true;
        }
        // If it's a politics category, add to a general "Politics" category
        else if (/politics|political|government|democracy|elections|parties/i.test(category)) {
            generalCategories["Politics"] = true;
        }
        // If it's a religion category, add to a general "Religion" category
        else if (/religion|religious|christianity|islam|buddhism|judaism|hindu/i.test(category)) {
            generalCategories["Religion"] = true;
        }
        // If it's a philosophy category, add to a general "Philosophy" category
        else if (/philosophy|philosophical|ethics|metaphysics/i.test(category)) {
            generalCategories["Philosophy"] = true;
        }
        // If it's a health category, add to a general "Health" category
        else if (/health|medical|medicine|disease|diseases|pandemic|healthcare/i.test(category)) {
            generalCategories["Health & Medicine"] = true;
        }
        
        // Keep the category for review but we'll prioritize our general ones
        return true;
    });
    
    // Create a final list with general categories first, then specifics (limited to reasonable number)
    const finalCategories = [
        ...Object.keys(generalCategories), 
        ...normalizedCategories.slice(0, 5) // Limit specific categories to 5
    ];
    
    return [...new Set(finalCategories)]; // Remove duplicates
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

// Start tracking time
function startTracking() {
    if (!isActive) {
        isActive = true;
        startTime = Date.now();
        
        // Set up interval to check if computer is still active
        trackingInterval = setInterval(() => {
            // If tab is active, accumulate time
            if (isActive) {
                const now = Date.now();
                const elapsed = now - lastActiveCheck;
                
                // Check if elapsed time is reasonable (less than 1 minute)
                // If more than 1 minute, assume computer was asleep or inactive
                if (elapsed < 60000) {
                    activeTime += elapsed;
                }
                
                lastActiveCheck = now;
                
                // Mark as read after 1 second of active time
                if (activeTime > 1000 && !isArticleRead) {
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
                }
            }
        }, 1000); // Check every second
    }
}

// Stop tracking time
function stopTracking() {
    if (isActive) {
        isActive = false;
        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
        }
        
        // If we had started tracking time, accumulate it
        if (startTime) {
            const now = Date.now();
            const elapsed = now - startTime;
            
            // Only count elapsed time if it's reasonable (less than 1 minute)
            if (elapsed < 60000) {
                activeTime += elapsed;
            }
            
            startTime = null;
        }
    }
}

// Initialize tracking
async function initializeTracking() {
    await fetchCategories();
    setupLinkTracking();
    
    chrome.runtime.sendMessage({
        type: 'VISIT_START',
        data: articleData
    });
    
    // Start tracking time if tab is visible
    if (!document.hidden) {
        startTracking();
    }
}

// Update time spent when tab becomes inactive or user leaves
function updateTimeSpent() {
    stopTracking();
    
    articleData.timestamp_end = Date.now();
    articleData.time_spent = activeTime;
    articleData.is_read = isArticleRead;
    articleData.clicked_links = clickedLinks;
    
    chrome.runtime.sendMessage({
        type: 'VISIT_END',
        data: articleData
    });
}

// Check if browser has been idle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // If browser was idle, handle accordingly
    if (message.type === 'BROWSER_ACTIVE') {
        if (document.visibilityState === 'visible') {
            startTracking();
        }
    }
    else if (message.type === 'BROWSER_IDLE') {
        stopTracking();
    }
});

// Listen for page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopTracking();
    } else {
        startTracking();
    }
});

// Listen for page unload
window.addEventListener('beforeunload', () => {
    updateTimeSpent();
});

// Listen for user activity to detect if computer is actively being used
["click", "mousemove", "keydown", "scroll"].forEach(eventType => {
    document.addEventListener(eventType, () => {
        lastActiveCheck = Date.now();
    }, { passive: true });
});

// Initialize tracking when content script loads
initializeTracking(); 