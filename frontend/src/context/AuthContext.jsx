import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const TOKEN_KEY   = 'bosa_token';
const REFRESH_KEY = 'bosa_refresh';

// Identificador del interceptor para no registrarlo dos veces
let interceptorId = null;

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  // Ref a logout para usar dentro del interceptor (que vive fuera del render)
  const logoutRef = useRef(() => {});

  const setAuthHeader = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  const setRefreshToken = (rt) => {
    if (rt) localStorage.setItem(REFRESH_KEY, rt);
    else localStorage.removeItem(REFRESH_KEY);
  };

  const logout = useCallback(() => {
    setAuthHeader(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  // Mantener ref de logout actualizada
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  // ── Configurar interceptor de axios para refresh automático ────
  useEffect(() => {
    // Evitar duplicados en hot-reload o re-render
    if (interceptorId !== null) return;

    let isRefreshing = false;
    let waiters = [];
    const wait = () => new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    const release = (token) => { waiters.forEach(w => w.resolve(token)); waiters = []; };
    const fail    = (err)   => { waiters.forEach(w => w.reject(err));    waiters = []; };

    interceptorId = axios.interceptors.response.use(
      r => r,
      async (err) => {
        const original = err?.config || {};
        const status = err?.response?.status;
        // Solo intentar refresh en 401, una vez por request, y no en el propio /refresh ni /login
        if (
          status !== 401 ||
          original._retry ||
          (original.url || '').includes('/api/auth/refresh') ||
          (original.url || '').includes('/api/auth/login')
        ) {
          return Promise.reject(err);
        }

        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (!refreshToken) {
          logoutRef.current();
          return Promise.reject(err);
        }

        original._retry = true;

        // Si ya hay un refresh en curso, esperar a que termine
        if (isRefreshing) {
          try {
            const newToken = await wait();
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
            return axios(original);
          } catch (e) {
            return Promise.reject(e);
          }
        }

        isRefreshing = true;
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          const newToken = data.accessToken || data.token;
          const newRefresh = data.refreshToken;
          if (!newToken) throw new Error('Sin accessToken en respuesta de refresh');

          axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          localStorage.setItem(TOKEN_KEY, newToken);
          if (newRefresh) localStorage.setItem(REFRESH_KEY, newRefresh);

          isRefreshing = false;
          release(newToken);

          original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
          return axios(original);
        } catch (refreshErr) {
          isRefreshing = false;
          fail(refreshErr);
          logoutRef.current();
          return Promise.reject(refreshErr);
        }
      }
    );

    return () => {
      if (interceptorId !== null) {
        axios.interceptors.response.eject(interceptorId);
        interceptorId = null;
      }
    };
  }, []);

  // Restaurar sesión al recargar
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthHeader(token);
    axios.get('/api/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    setAuthHeader(data.accessToken || data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
