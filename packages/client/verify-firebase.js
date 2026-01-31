/**
 * Firebase Configuration Test
 * 
 * This script verifies that Firebase is properly configured.
 * Run with: node verify-firebase.js
 */

// Check if environment variables are loaded
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

console.log('🔍 Checking Firebase Configuration...\n');

// Read .env.local file
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  console.log('   Create it at:', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

let allPresent = true;
requiredEnvVars.forEach(varName => {
  if (envVars[varName]) {
    console.log(`✅ ${varName}`);
  } else {
    console.log(`❌ ${varName} - MISSING`);
    allPresent = false;
  }
});

console.log('\n📋 Configuration Values:');
console.log(`   Project ID: ${envVars.VITE_FIREBASE_PROJECT_ID || 'NOT SET'}`);
console.log(`   Auth Domain: ${envVars.VITE_FIREBASE_AUTH_DOMAIN || 'NOT SET'}`);

if (allPresent) {
  console.log('\n✅ All Firebase environment variables are configured!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: firebase login');
  console.log('   2. Run: firebase init firestore');
  console.log('   3. Run: firebase deploy --only firestore:rules');
  process.exit(0);
} else {
  console.log('\n❌ Some environment variables are missing.');
  console.log('   Check .env.example for the required format.');
  process.exit(1);
}
