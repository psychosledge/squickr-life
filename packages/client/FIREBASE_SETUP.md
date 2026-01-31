# Firebase Setup Instructions

This guide will help you complete the Firebase setup for backend sync.

## What's Already Done ✅

- ✅ Firebase SDK installed
- ✅ Firebase configuration file created (`src/firebase/config.ts`)
- ✅ Authentication helpers created (`src/firebase/auth.ts`)
- ✅ Firestore security rules created (`firestore.rules`)
- ✅ Environment variable template created (`.env.example`)

## What You Need to Do

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the wizard:
   - Enter project name (e.g., "squickr-life")
   - Disable Google Analytics (optional for personal use)
   - Click "Create project"

### 2. Register Web App

1. In your Firebase project, click the **Web** icon (`</>`) to add a web app
2. Register app:
   - App nickname: "Squickr Life"
   - Check "Also set up Firebase Hosting" (optional)
   - Click "Register app"
3. **Copy the Firebase configuration** (you'll need this next!)

### 3. Configure Environment Variables

1. Create a new file in `packages/client/.env.local`
2. Copy the values from Firebase Console into this file:

\`\`\`env
VITE_FIREBASE_API_KEY=your-actual-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc123
\`\`\`

**Important:** This file is gitignored and will not be committed.

### 4. Enable Google Authentication

1. In Firebase Console, go to **Authentication** → **Get started**
2. Click **Sign-in method** tab
3. Click **Google** provider
4. Enable the toggle
5. Select support email (your Google account)
6. Click **Save**

### 5. Create Firestore Database

1. In Firebase Console, go to **Firestore Database** → **Create database**
2. Select **Start in production mode** (we'll deploy security rules next)
3. Choose location: **us-central1** (or your preferred region)
4. Click **Enable**

### 6. Deploy Security Rules

Install Firebase CLI if you haven't already:

\`\`\`bash
npm install -g firebase-tools
\`\`\`

Login to Firebase:

\`\`\`bash
firebase login
\`\`\`

Initialize Firebase (from project root):

\`\`\`bash
firebase init firestore
\`\`\`

When prompted:
- Use existing project: Select your project
- Firestore rules file: Press Enter (use `firestore.rules`)
- Firestore indexes file: Press Enter (use `firestore.indexes.json`)

Deploy the rules:

\`\`\`bash
firebase deploy --only firestore:rules
\`\`\`

### 7. Test the Setup

Run the development server:

\`\`\`bash
pnpm dev
\`\`\`

The app should start without Firebase errors. Check the browser console for:
```
[Firebase] Initialized successfully
```

## Next Steps

Once Firebase is configured, we can continue with:

- **Phase 3:** Authentication UI (Sign-in page, AuthContext)
- **Phase 4:** Firestore Event Sync - Upload
- **Phase 5:** Firestore Event Sync - Download
- **Phase 6:** Bidirectional Sync
- **Phase 7:** Offline Support

## Troubleshooting

### "Missing Firebase configuration" error

Make sure your `.env.local` file exists in `packages/client/` and contains all required variables.

### "Permission denied" errors in Firestore

Make sure you deployed the security rules with `firebase deploy --only firestore:rules`.

### Firebase CLI not found

Install it globally: `npm install -g firebase-tools`

## Security Notes

- ✅ `.env.local` is gitignored - your credentials are safe
- ✅ Security rules enforce user isolation - users can only access their own data
- ✅ Events are append-only - cannot be modified or deleted via Firestore
- ✅ Unauthenticated users have zero access

## Reference

- [Firebase Documentation](https://firebase.google.com/docs)
- [Backend Sync Design Document](../../docs/backend-sync-design.md)
