import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { deleteSessionToken, getSessionToken, setSessionToken } from '@/src/store/auth/token-storage';
import { ensureMigrated } from '@/src/db/migrate';
import { getMyProfile, markOnboardingComplete } from '@/src/db/queries/profiles.queries';
import * as Crypto from 'expo-crypto';

export type AuthStatus = 'unknown' | 'signedOut' | 'signedIn';

/** Full-screen onboarding gates the tabs. `unknown` = still reading SQLite. */
export type OnboardingStatus = 'unknown' | 'incomplete' | 'complete';

export type AuthContextValue = {
  status: AuthStatus;
  sessionToken: string | null;
  onboardingStatus: OnboardingStatus;
  /** Last persisted onboarding step (0 = not started). */
  onboardingStep: number;
  setOnboardingStep: (step: number) => void;
  markOnboardingComplete: () => Promise<void>;
  signIn: () => Promise<string>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('unknown');
  const [sessionToken, setSessionTokenValue] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>('unknown');
  const [onboardingStep, setOnboardingStepState] = useState(0);

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

  // Read the durable profile to decide between onboarding and the tabs. The
  // profile survives sign-out (only the session token is cleared), so a user
  // who finished onboarding never sees it again, while an in-progress one
  // resumes exactly where they left off.
  useEffect(() => {
    if (status !== 'signedIn') {
      return;
    }
    let isMounted = true;

    (async () => {
      try {
        await ensureMigrated();
        const profile = await getMyProfile();
        if (!isMounted) {
          return;
        }
        if (profile && profile.onboardingCompleted) {
          setOnboardingStepState(4);
          setOnboardingStatus('complete');
        } else {
          setOnboardingStepState(profile ? profile.onboardingStep : 0);
          setOnboardingStatus('incomplete');
        }
      } catch {
        if (isMounted) {
          setOnboardingStatus('incomplete');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [status]);

  const signIn = useCallback(async (): Promise<string> => {
    const token = Crypto.randomUUID();
    await setSessionToken(token);
    setSessionTokenValue(token);
    setStatus('signedIn');
    // Keep onboarding unresolved until the profile read lands.
    setOnboardingStatus('unknown');
    return token;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await deleteSessionToken();
    setSessionTokenValue(null);
    setStatus('signedOut');
    setOnboardingStatus('unknown');
    setOnboardingStepState(0);
  }, []);

  const setOnboardingStep = useCallback((step: number) => {
    setOnboardingStepState(step);
  }, []);

  const completeOnboarding = useCallback(async (): Promise<void> => {
    await markOnboardingComplete();
    setOnboardingStatus('complete');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      sessionToken,
      onboardingStatus,
      onboardingStep,
      setOnboardingStep,
      markOnboardingComplete: completeOnboarding,
      signIn,
      signOut,
    }),
    [status, sessionToken, onboardingStatus, onboardingStep, setOnboardingStep, completeOnboarding, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}