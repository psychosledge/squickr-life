import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './config';

/**
 * Sign in with Google using popup
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  
  try {
    const result = await signInWithPopup(auth, provider);
    console.log('[Auth] Sign in successful:', result.user.email);
    return result.user;
  } catch (error) {
    console.error('[Auth] Sign in failed:', error);
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
    console.log('[Auth] Sign out successful');
  } catch (error) {
    console.error('[Auth] Sign out failed:', error);
    throw error;
  }
}

/**
 * Subscribe to auth state changes
 * @param callback Function to call when auth state changes
 * @returns Unsubscribe function
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
