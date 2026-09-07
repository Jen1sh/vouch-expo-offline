import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AppMode = 'member' | 'voucher';

type AppModeContextValue = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};

const AppModeContext = createContext<AppModeContextValue | null>(null);

/**
 * Which navigation tree is active — member or voucher. One account has two
 * trees (see REQUIREMENTS §2.2/§3.7); switching lives in Settings and swaps
 * the whole route group at the `(protected)` layout level. Not persisted:
 * relaunch always starts in member mode (the spec only requires member state
 * to survive switching, not the switch itself).
 */
export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('member');

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
  }, []);

  const value = useMemo<AppModeContextValue>(
    () => ({ mode, setMode }),
    [mode, setMode]
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return ctx;
}
