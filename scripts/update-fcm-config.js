const fs = require('fs');
const path = require('path');

// Path to the firebase-messaging-sw.js file
const swPath = path.join(__dirname, '../public/firebase-messaging-sw.js');

// Read environment variables (assuming they are available in process.env or from a .env file)
require('dotenv').config();

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'YOUR_API_KEY';
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'YOUR_AUTH_DOMAIN';
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID';
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'YOUR_STORAGE_BUCKET';
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID';
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'YOUR_APP_ID';

// Read the content of the service worker file
let swContent = fs.readFileSync(swPath, 'utf8');

// Replace placeholders with actual values
swContent = swContent.replace('%%FIREBASE_API_KEY%%', apiKey);
swContent = swContent.replace('%%FIREBASE_AUTH_DOMAIN%%', authDomain);
swContent = swContent.replace('%%FIREBASE_PROJECT_ID%%', projectId);
swContent = swContent.replace('%%FIREBASE_STORAGE_BUCKET%%', storageBucket);
swContent = swContent.replace('%%FIREBASE_MESSAGING_SENDER_ID%%', messagingSenderId);
swContent = swContent.replace('%%FIREBASE_APP_ID%%', appId);

// Write the updated content back to the file
fs.writeFileSync(swPath, swContent, 'utf8');

console.log('Firebase Messaging Service Worker configuration updated with environment variables.');
