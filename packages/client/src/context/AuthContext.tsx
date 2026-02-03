/**
 * Auth Context
 * 
 * Manages Firebase authentication state across the application.
 * Provides current user and loading state to all components.
 * 
 * Phase 3: Authentication UI
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { subscribeToAuthState } from '../firebase/auth';
import { logger } from '../utils/logger';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component
 * 
 * Subscribes to Firebase auth state changes and provides
 * the current user to all child components.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = subscribeToAuthState((user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        logger.info('[AuthContext] User signed in:', user.email);
      } else {
        logger.info('[AuthContext] User signed out');
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
