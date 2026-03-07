"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, connectGoogleCalendar } from '@/lib/firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  // Google Calendar
  googleAccessToken: string | null;
  calendarConnected: boolean;
  setGoogleAccessToken: (token: string | null) => void;
  handleConnectCalendar: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  googleAccessToken: null,
  calendarConnected: false,
  setGoogleAccessToken: () => {},
  handleConnectCalendar: async () => ({ error: null }),
});

const SESSION_STORAGE_KEY = 'googleAccessToken';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessTokenState] = useState<string | null>(null);

  // sessionStorage と state を同時に更新するラッパー
  const setGoogleAccessToken = useCallback((token: string | null) => {
    setGoogleAccessTokenState(token);
    try {
      if (token) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // sessionStorage からトークンを復元
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        setGoogleAccessTokenState(saved);
      }
    } catch {}

    try {
      const unsubscribe = onAuthChange((user) => {
        setUser(user);
        setLoading(false);
        // ログアウト時にトークンをクリア
        if (!user) {
          setGoogleAccessTokenState(null);
          try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Auth initialization error:', error);
      setLoading(false);
    }
  }, []);

  const handleConnectCalendar = useCallback(async () => {
    const result = await connectGoogleCalendar();
    if (result.accessToken) {
      setGoogleAccessToken(result.accessToken);
    }
    return { error: result.error };
  }, [setGoogleAccessToken]);

  const calendarConnected = googleAccessToken !== null;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      googleAccessToken,
      calendarConnected,
      setGoogleAccessToken,
      handleConnectCalendar,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
