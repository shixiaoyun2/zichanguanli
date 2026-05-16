import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator';
  departments?: string;
  deptIds?: number[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const userData = data.user;
            const userWithIds = {
              ...userData,
              deptIds: userData.departments ? userData.departments.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id)) : []
            };
            setUser(userWithIds);
          } else {
            logout();
          }
        } catch (err) {
          console.error('Auth check failed', err);
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    const userWithIds = {
      ...newUser,
      deptIds: newUser.departments ? newUser.departments.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : []
    };
    setUser(userWithIds);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('assets_cache');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
