import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { getFirebaseAuth } from "./client";

export async function signInAdmin(
  email: string,
  password: string
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await firebaseSignOut(auth);
}

export function onAuthChange(
  callback: (user: User | null) => void
): Unsubscribe {
  const auth = getFirebaseAuth();
  if (!auth) {
    // Firebase not configured — call back with null immediately and return a no-op unsubscribe
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  return auth.currentUser;
}
