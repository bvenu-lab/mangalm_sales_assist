import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  name?: string; // Full name (used in several components)
  avatar?: string;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuthOnMount = async () => {
      await checkAuth();
      setIsLoading(false);
    };
    
    checkAuthOnMount();
  }, []);

  const checkAuth = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setUser(null);
        return false;
      }
      
      // Verify token with backend
      const response = await axios.get(`${config.apiUrl}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setUser(response.data.user);
        return true;
      } else {
        // Token is invalid or expired
        localStorage.removeItem('auth_token');
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
      return false;
    }
  };

  const login = async (username: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.post(`${config.apiUrl}/auth/login`, {
        username,
        password
      });
      
      if (response.data.success) {
        localStorage.setItem('auth_token', response.data.token);
        setUser(response.data.user);
        navigate('/dashboard');
      } else {
        setError(response.data.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    localStorage.removeItem('auth_token');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
        checkAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
