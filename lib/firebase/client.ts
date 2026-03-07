import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isConfigured(): boolean {
  return !!firebaseConfig.apiKey;
}

function getFirebaseApp(): FirebaseApp | null {
  if (!isConfigured()) return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

export function getFirebaseAuth(): Auth | null {
  if (!isConfigured()) return null;
  if (!_app) _app = getFirebaseApp();
  if (!_auth && _app) _auth = getAuth(_app);
  return _auth;
}

export function getFirebaseDb(): Firestore | null {
  if (!isConfigured()) return null;
  if (!_app) _app = getFirebaseApp();
  if (!_db && _app) _db = getFirestore(_app);
  return _db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  if (!isConfigured()) return null;
  if (!_app) _app = getFirebaseApp();
  if (!_storage && _app) _storage = getStorage(_app);
  return _storage;
}

export { isConfigured };
