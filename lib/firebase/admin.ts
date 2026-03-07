import {
  initializeApp,
  getApps,
  cert,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

function getServiceAccount(): ServiceAccount | undefined {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) return undefined;
  try {
    return JSON.parse(key) as ServiceAccount;
  } catch {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY");
    return undefined;
  }
}

let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;

  const apps = getApps();
  if (apps.length > 0) {
    _app = apps[0];
    return _app;
  }

  const serviceAccount = getServiceAccount();
  _app = initializeApp({
    ...(serviceAccount ? { credential: cert(serviceAccount) } : {}),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  return _app;
}

// Use proxy object to lazily initialize Firebase Admin services.
// This prevents build-time crashes when env vars are not set.
const adminProxy = {
  get adminAuth(): Auth {
    return getAuth(getAdminApp());
  },
  get adminDb(): Firestore {
    return getFirestore(getAdminApp());
  },
  get adminStorage(): Storage {
    return getStorage(getAdminApp());
  },
};

export const adminAuth = new Proxy({} as Auth, {
  get(_, prop) {
    return (adminProxy.adminAuth as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_, prop) {
    return (adminProxy.adminDb as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const adminStorage = new Proxy({} as Storage, {
  get(_, prop) {
    return (adminProxy.adminStorage as unknown as Record<string | symbol, unknown>)[prop];
  },
});
