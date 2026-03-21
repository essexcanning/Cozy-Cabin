import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Use import.meta.glob to optionally load the local config file without breaking the build if it's missing
const configModules = import.meta.glob('../firebase-applet-config.json', { eager: true });
const rawConfig = configModules['../firebase-applet-config.json'] as any || {};
const localConfig = rawConfig.default || rawConfig;

const firebaseConfig = {
  apiKey: localConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: localConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: localConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: localConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: localConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: localConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: localConfig.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey) {
  console.warn('Firebase API Key is missing. Please ensure firebase-applet-config.json exists or environment variables are set.');
}

const databaseId = localConfig.firestoreDatabaseId || import.meta.env.VITE_FIRESTORE_DATABASE_ID;

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  // Create a dummy app object to prevent crashes on export
  app = { name: '[DEFAULT]' } as any;
}

export const db = getFirestore(app, databaseId);

// Enable persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a a time.
    console.warn('Firestore persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firestore persistence failed: browser not supported');
  }
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
