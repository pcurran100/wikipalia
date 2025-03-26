// Initialize IndexedDB
const dbName = 'WikipaliaDB';
const dbVersion = 1;

const request = indexedDB.open(dbName, dbVersion);

request.onerror = (event) => {
    console.error('Database error:', event.target.error);
};

request.onupgradeneeded = (event) => {
    const db = event.target.result;

    if (!db.objectStoreNames.contains('visits')) {
        const visitStore = db.createObjectStore('visits', { keyPath: 'id', autoIncrement: true });
        visitStore.createIndex('url', 'url', { unique: false });
        visitStore.createIndex('date', 'date', { unique: false });
    }

    if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        sessionStore.createIndex('url', 'url', { unique: false });
        sessionStore.createIndex('startTime', 'startTime', { unique: false });
    }
};

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'VISIT_START') {
        handleVisitStart(message.data);
    } else if (message.type === 'VISIT_END') {
        handleVisitEnd(message.data);
    } else if (message.type === 'USER_LOGGED_IN') {
        console.log('User logged in:', message.payload);
        // You can store this in chrome.storage or IndexedDB if needed
    }
    return true;
});

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
                        categories: session.categories
                    });
                    sessionStore.delete(cursor.primaryKey);
                }
            }
        };
    };
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
            const stats = {
                date: today,
                totalTime: visits.reduce((acc, visit) => acc + (visit.time_spent || 0), 0),
                uniqueArticles: new Set(visits.map(v => v.url)).size,
                totalVisits: visits.length
            };

            const writeTxn = db.transaction(['sessions'], 'readwrite');
            const store = writeTxn.objectStore('sessions');
            store.add({ session_id: today, ...stats });
        };
    };
}
