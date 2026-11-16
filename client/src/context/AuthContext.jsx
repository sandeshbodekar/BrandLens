import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, clearToken, setOnUnauthorized } from '../api.js';

const AuthContext = createContext(null);

// Where each role lands after login and when visiting "/".
export function homeFor(role) {
  return role === 'reviewer' ? '/queue' : '/drafts';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true); // true until the stored token is checked

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setWorkspace(null);
  }, []);

  // On first load: if a token is stored, ask the server who it belongs to.
  useEffect(() => {
    setOnUnauthorized(logout);
    if (!getToken()) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false; // guards against React StrictMode's double effect run
    api
      .get('/api/auth/me')
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setWorkspace(data.workspace);
      })
      .catch(() => {
        // A 401 already logs out via the callback above. Other errors (server
        // asleep) leave the token alone so a reload can recover.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Shared by password login and demo login: store token, then load user + workspace.
  const startSession = useCallback(
    async (path, body) => {
      const { token } = await api.post(path, body);
      setToken(token);
      try {
        const me = await api.get('/api/auth/me');
        setUser(me.user);
        setWorkspace(me.workspace);
      } catch (err) {
        logout();
        throw err;
      }
    },
    [logout]
  );

  const login = useCallback(
    (email, password) => startSession('/api/auth/login', { email, password }),
    [startSession]
  );
  const demoLogin = useCallback(
    (role) => startSession('/api/auth/demo', { role }),
    [startSession]
  );

  const value = useMemo(
    () => ({ user, workspace, loading, login, demoLogin, logout }),
    [user, workspace, loading, login, demoLogin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
