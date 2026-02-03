/// <reference types="vite/client" />

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { type Firestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { logger } from '../utils/logger';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env['VITE_FIREBASE_API_KEY'],
  authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'],
  storageBucket: import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
  appId: import.meta.env['VITE_FIREBASE_APP_ID'],
};

// Validate that all required config values are present
function validateConfig() {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ] as const;

  const missingKeys = requiredKeys.filter(
    (key) => !firebaseConfig[key]
  );

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missingKeys.join(', ')}. ` +
      'Please check your .env.local file.'
    );
  }
}

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

try {
  validateConfig();
  
  // Initialize Firebase app
  app = initializeApp(firebaseConfig);
  
  // Initialize Auth
  auth = getAuth(app);
  
  // Initialize Firestore with offline persistence
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache(),
  });
  
  logger.info('[Firebase] Initialized successfully');
} catch (error) {
  logger.error('[Firebase] Initialization failed:', error);
  throw error;
}

export { app, auth, firestore };
