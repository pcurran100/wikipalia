// Simple script to copy Firebase dependencies for development
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create vendor directory if it doesn't exist
const vendorDir = path.join(__dirname, 'vendor');
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

// Copy Firebase files from node_modules to vendor directory
function copyFirebaseFiles() {
  const firebaseFiles = [
    { 
      source: 'node_modules/firebase/firebase-app.js', 
      dest: 'vendor/firebase-app.js'
    },
    { 
      source: 'node_modules/firebase/firebase-auth.js', 
      dest: 'vendor/firebase-auth.js'
    },
    { 
      source: 'node_modules/firebase/firebase-firestore.js', 
      dest: 'vendor/firebase-firestore.js'
    }
  ];

  firebaseFiles.forEach(file => {
    const sourcePath = path.join(__dirname, file.source);
    const destPath = path.join(__dirname, file.dest);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${file.source} to ${file.dest}`);
    } else {
      console.error(`Source file not found: ${sourcePath}`);
    }
  });
}

// Execute the copy function
copyFirebaseFiles();
console.log('Firebase files copied to vendor directory for development use'); 