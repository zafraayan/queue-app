import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let live = true; api.get('/auth/me').then(({data}) => { if (live) setUser(data.user); }).catch(() => {}).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);
  const login = async (email, password) => { const {data} = await api.post('/auth/login', {email,password}); setUser(data.user); };
  const logout = async () => { await api.post('/auth/logout'); setUser(null); };
  return <AuthContext.Provider value={{user,loading,login,logout}}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
