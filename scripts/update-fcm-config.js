const fs = require('fs');
const path = require('path');

// Path to the firebase-messaging-sw.js file
const swPath = path.join(__dirname, '../public/firebase-messaging-sw.js');

// Read environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Check if all required environment variables are available
if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
  console.error('Missing Firebase environment variables. Please check your .env.local file:');
  console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', apiKey ? '✓' : '✗');
  console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', authDomain ? '✓' : '✗');
  console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', projectId ? '✓' : '✗');
  console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', storageBucket ? '✓' : '✗');
  console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:', messagingSenderId ? '✓' : '✗');
  console.log('NEXT_PUBLIC_FIREBASE_APP_ID:', appId ? '✓' : '✗');
  process.exit(1);
}

// Read the content of the service worker file
let swContent = fs.readFileSync(swPath, 'utf8');

// Replace placeholder values with actual environment variables
swContent = swContent.replace(/apiKey: 'AIzaSyBQmJz9XftURWvLQ9I8Nb9A9NRlA8B0Yz0'/, `apiKey: '${apiKey}'`);
swContent = swContent.replace(/authDomain: 'quorumflow.firebaseapp.com'/, `authDomain: '${authDomain}'`);
swContent = swContent.replace(/projectId: 'quorumflow'/, `projectId: '${projectId}'`);
swContent = swContent.replace(/storageBucket: 'quorumflow.appspot.com'/, `storageBucket: '${storageBucket}'`);
swContent = swContent.replace(/messagingSenderId: '123456789012'/, `messagingSenderId: '${messagingSenderId}'`);
swContent = swContent.replace(/appId: '1:123456789012:web:abcdef1234567890abcdef'/, `appId: '${appId}'`);

// Write the updated content back to the file
fs.writeFileSync(swPath, swContent, 'utf8');

console.log('✅ Firebase Messaging Service Worker configuration updated with environment variables');
console.log(`🔧 Project: ${projectId}`);
console.log(`📱 Messaging Sender ID: ${messagingSenderId}`);
