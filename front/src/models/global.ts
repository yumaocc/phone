import { DEFAULT_NAME } from '@/constants';
import { useState } from 'react';

export type AuthUser = {
  id: string;
  username: string;
  createdAt: string;
};

const useUser = () => {
  const [name, setName] = useState<string>(DEFAULT_NAME);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('authUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  });

  const setAuth = (user: AuthUser | null, accessToken: string | null) => {
    setAuthUser(user);
    setToken(accessToken);
    if (user && accessToken) {
      localStorage.setItem('authUser', JSON.stringify(user));
      localStorage.setItem('accessToken', accessToken);
    } else {
      localStorage.removeItem('authUser');
      localStorage.removeItem('accessToken');
    }
  };

  const logout = () => {
    setAuth(null, null);
  };

  return {
    name,
    setName,
    authUser,
    token,
    setAuth,
    logout,
    isAuthenticated: !!authUser && !!token,
  };
};

export default useUser;
