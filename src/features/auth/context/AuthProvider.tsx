import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { deleteSessionToken, getSessionToken, setSessionToken } from '@/src/store/auth/token-storage';
import * as Crypto from 'expo-crypto';

export type AuthStatus = 'unknown' | 'signedOut' | 'signedIn';

export type AuthContextValue = {
  status: AuthStatus;
  sessionToken: string | null;
  signIn: () => Promise<string>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('unknown');
  const [sessionToken, setSessionTokenValue] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getSessionToken().then((token) => {
      if (!isMounted) {
        return;
      }
      if (token) {
        setSessionTokenValue(token);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(async (): Promise<string> => {
    const token = Crypto.randomUUID();
    await setSessionToken(token);
    setSessionTokenValue(token);
    setStatus('signedIn');
    return token;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await deleteSessionToken();
    setSessionTokenValue(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, sessionToken, signIn, signOut }),
    [status, sessionToken, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}