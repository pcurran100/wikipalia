# Wikipalia - Your Wikipedia Year in Review

Wikipalia is a Chrome extension that tracks your Wikipedia reading habits and provides an engaging end-of-year summary, similar to Spotify Wrapped but for your Wikipedia activity.

## Features

- 📊 Track total time spent on Wikipedia
- 📚 Count articles read and most revisited articles
- 🕳️ Detect your deepest Wikipedia rabbit holes
- 📅 Log your most active Wikipedia days
- 🏷️ Identify favorite topic categories
- ☁️ Support for local storage and optional cloud sync
- 📱 Beautiful year-end Wrapped dashboard

## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Browse Wikipedia as usual - Wikipalia will automatically track your activity
2. Click the extension icon to view your current stats
3. At the end of the year, click "View Year Wrapped" for your personalized summary
4. Optionally, sign in to sync your data across devices

## Privacy

- All data is stored locally by default
- Cloud sync is optional and requires Google sign-in
- No data is collected outside of Wikipedia domains
- You can delete your data at any time from the extension settings

## Technical Details

### Tech Stack
- Chrome Extension: JavaScript (Manifest v3)
- UI: HTML + Tailwind CSS
- Storage: IndexedDB / Chrome Storage API
- Cloud Sync: Firebase
- Data Visualization: Chart.js

### Project Structure
```
wikipalia/
├── manifest.json         # Extension configuration
├── content.js           # Wikipedia activity tracking
├── background.js        # Storage and sync management
├── popup.html          # Mini dashboard UI
├── popup.js            # UI logic
├── dashboard/          # Year-end Wrapped dashboard
│   ├── index.html     # Dashboard UI
│   └── dashboard.js   # Dashboard logic
└── README.md           # Documentation
```

### Data Storage
- Local storage uses IndexedDB for efficient data management
- Cloud sync uses Firebase Firestore for cross-device access
- Data is structured to optimize for quick retrieval and analysis

## Development

To modify or enhance the extension:

1. Make your changes to the source files
2. Reload the extension in Chrome
3. Test thoroughly across different Wikipedia pages
4. Submit a pull request with your improvements

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 