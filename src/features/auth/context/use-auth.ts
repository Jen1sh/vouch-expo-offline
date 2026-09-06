import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from './AuthProvider';

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (auth === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return auth;
}