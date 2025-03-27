// Initialize IndexedDB
const dbName = 'WikipaliaDB';
const dbVersion = 2; // Increased version to trigger database upgrade

const request = indexedDB.open(dbName, dbVersion);

request.onerror = (event) => {
    console.error('Database error:', event.target.error);
};

request.onupgradeneeded = (event) => {
    const db = event.target.result;
    const oldVersion = event.oldVersion;

    // Create or modify stores based on old version
    if (oldVersion < 1) {
        // These stores were in version 1
        if (!db.objectStoreNames.contains('visits')) {
            const visitStore = db.createObjectStore('visits', { keyPath: 'id', autoIncrement: true });
            visitStore.createIndex('url', 'url', { unique: false });
            visitStore.createIndex('date', 'date', { unique: false });
            visitStore.createIndex('title', 'title', { unique: false });
            visitStore.createIndex('is_read', 'is_read', { unique: false });
        }

        if (!db.objectStoreNames.contains('sessions')) {
            const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
            sessionStore.createIndex('url', 'url', { unique: false });
            sessionStore.createIndex('startTime', 'startTime', { unique: false });
        }

        if (!db.objectStoreNames.contains('user')) {
            const userStore = db.createObjectStore('user', { keyPath: 'uid' });
        }
    }
    
    // New for version 2
    if (oldVersion < 2) {
        // Store for link clicks
        if (!db.objectStoreNames.contains('link_clicks')) {
            const linkClicksStore = db.createObjectStore('link_clicks', { keyPath: 'id', autoIncrement: true });
            linkClicksStore.createIndex('from_url', 'from_url', { unique: false });
            linkClicksStore.createIndex('to_url', 'to_url', { unique: false });
            linkClicksStore.createIndex('timestamp', 'timestamp', { unique: false });
            linkClicksStore.createIndex('date', 'date', { unique: false });
        }
        
        // Update visits store if it exists
        if (db.objectStoreNames.contains('visits')) {
            // We need to add new indexes to existing store
            // Note: We can't modify existing object stores directly in onupgradeneeded
            // We have to create them anew if we want to add indexes
            const visitStore = event.target.transaction.objectStore('visits');
            if (!visitStore.indexNames.contains('is_read')) {
                visitStore.createIndex('is_read', 'is_read', { unique: false });
            }
            if (!visitStore.indexNames.contains('clicked_links')) {
                visitStore.createIndex('clicked_links', 'clicked_links', { unique: false });
            }
        }
    }
};

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'VISIT_START') {
        handleVisitStart(message.data);
    } else if (message.type === 'VISIT_END') {
        handleVisitEnd(message.data);
    } else if (message.type === 'USER_LOGGED_IN') {
        handleUserLogin(message.payload);
    } else if (message.type === 'USER_LOGGED_OUT') {
        handleUserLogout();
    } else if (message.type === 'LINK_CLICKED') {
        handleLinkClick(message.data);
    } else if (message.type === 'ARTICLE_READ') {
        handleArticleRead(message.data);
    }
    return true;
});

// Handle user login
function handleUserLogin(userData) {
    console.log('User logged in:', userData);
    
    // Store in Chrome Storage for persistence
    chrome.storage.local.set({ user: userData }, () => {
        console.log('User data saved to Chrome storage');
    });
    
    // Also store in IndexedDB for quick access
    const request = indexedDB.open(dbName, dbVersion);
    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['user'], 'readwrite');
        const store = transaction.objectStore('user');
        
        store.put({
            ...userData,
            lastLogin: new Date().toISOString()
        });
    };
}

// Handle user logout
function handleUserLogout() {
    console.log('User logged out');
    
    // Clear from Chrome Storage
    chrome.storage.local.remove('user', () => {
        console.log('User data removed from Chrome storage');
    });
    
    // Clear from IndexedDB
    const request = indexedDB.open(dbName, dbVersion);
    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['user'], 'readwrite');
        const store = transaction.objectStore('user');
        store.clear();
    };
}

// Handle visit start
function handleVisitStart(data) {
    const request = indexedDB.open(dbName, dbVersion);
    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        store.add({
            url: data.url,
            title: data.title,
            startTime: new Date().toISOString(),
            categories: data.categories
        });
    };
}

// Handle article being marked as read
function handleArticleRead(data) {
    // This is a simple notification that an article has been read
    // We will mark the visit as read in the handleVisitEnd function
    console.log('Article marked as read:', data.title);
}

// Handle link click in article
function handleLinkClick(data) {
    const request = indexedDB.open(dbName, dbVersion);
    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['link_clicks'], 'readwrite');
        const store = transaction.objectStore('link_clicks');
        
        const linkClick = {
            from_url: data.from_url,
            from_title: data.from_title,
            to_url: data.to_url,
            to_title: data.to_title,
            timestamp: data.timestamp,
            date: new Date(data.timestamp).toISOString().split('T')[0]
        };
        
        store.add(linkClick);
    };
}

// Handle visit end
function handleVisitEnd(data) {
    const request = indexedDB.open(dbName, dbVersion);
    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['visits', 'sessions'], 'readwrite');
        const visitStore = transaction.objectStore('visits');
        const sessionStore = transaction.objectStore('sessions');
        const index = sessionStore.index('url');
        const sessionRequest = index.openCursor(null, 'prev');

        sessionRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const session = cursor.value;
                if (session.url === data.url) {
                    const timeSpent = new Date() - new Date(session.startTime);
                    visitStore.add({
                        url: data.url,
                        title: data.title,
                        date: new Date().toISOString().split('T')[0],
                        time_spent: timeSpent,
                        categories: session.categories,
                        is_read: data.is_read || false,
                        clicked_links: data.clicked_links || 0,
                        timestamp: new Date().toISOString()
                    });
                    sessionStore.delete(cursor.primaryKey);
                    
                    // If user is logged in, sync this visit to Firebase
                    syncVisitToFirebase(data, timeSpent);
                }
            }
        };
    };
}

// Sync visit data to Firebase if user is logged in
function syncVisitToFirebase(data, timeSpent) {
    chrome.storage.local.get(['user'], (result) => {
        if (result.user && result.user.uid) {
            console.log('User is logged in, syncing visit data to Firebase');
            // This would typically involve a fetch call to your Firebase Cloud Function
            // or direct Firebase SDK usage to update the user's data
            // For this implementation, we're just logging the intent
        }
    });
}

// Daily stats alarm
chrome.alarms.create('calculateDailyStats', {
    periodInMinutes: 1440
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'calculateDailyStats') {
        calculateDailyStats();
    }
});

function calculateDailyStats() {
    const request = indexedDB.open(dbName, dbVersion);
    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['visits', 'sessions'], 'readonly');
        const visitStore = transaction.objectStore('visits');
        const sessionStore = transaction.objectStore('sessions');
        const dateIndex = visitStore.index('date');

        const today = new Date().toISOString().split('T')[0];
        const statsRequest = dateIndex.getAll(IDBKeyRange.only(today));

        statsRequest.onsuccess = () => {
            const visits = statsRequest.result;
            
            // Count articles that were actually read (time_spent > 1000ms)
            const readArticles = visits.filter(v => v.is_read).length;
            
            const stats = {
                date: today,
                totalTime: visits.reduce((acc, visit) => acc + (visit.time_spent || 0), 0),
                uniqueArticles: new Set(visits.map(v => v.url)).size,
                totalVisits: visits.length,
                readArticles: readArticles,
                clickedLinks: visits.reduce((acc, visit) => acc + (visit.clicked_links || 0), 0)
            };

            const writeTxn = db.transaction(['sessions'], 'readwrite');
            const store = writeTxn.objectStore('sessions');
            store.add({ session_id: today, ...stats });
            
            // Sync daily stats to Firebase if user is logged in
            syncDailyStatsToFirebase(stats);
        };
    };
}

// Sync daily stats to Firebase if user is logged in
function syncDailyStatsToFirebase(stats) {
    chrome.storage.local.get(['user'], (result) => {
        if (result.user && result.user.uid) {
            console.log('User is logged in, syncing daily stats to Firebase');
            // This would typically involve a fetch call to your Firebase Cloud Function
            // or direct Firebase SDK usage to update the user's data
            // For this implementation, we're just logging the intent
        }
    });
}
