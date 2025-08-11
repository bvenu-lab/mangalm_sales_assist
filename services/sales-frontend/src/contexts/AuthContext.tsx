import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import apiGatewayClient from '../services/api-gateway-client';

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
  logout: () => Promise<void>;
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
      console.log('[AuthContext] Checking authentication on mount...');
      const isAuthenticated = await checkAuth();
      console.log(`[AuthContext] Initial auth check complete: ${isAuthenticated ? 'Authenticated' : 'Not authenticated'}`);
      setIsLoading(false);
    };
    
    checkAuthOnMount();
  }, []);

  const checkAuth = async (): Promise<boolean> => {
    console.log('[AuthContext] Starting auth check...');
    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        console.log('[AuthContext] No auth token found in localStorage');
        setUser(null);
        return false;
      }
      
      console.log('[AuthContext] Auth token found, verifying with backend...');
      // Verify token with backend
      apiGatewayClient.setAuthToken(token);
      const response = await apiGatewayClient.get('/auth/me');
      
      if (response.success && response.user) {
        console.log('[AuthContext] Token verified successfully, user:', response.user);
        setUser(response.user);
        return true;
      } else {
        // Token is invalid or expired
        console.log('[AuthContext] Token invalid or expired, clearing auth data');
        localStorage.removeItem('auth_token');
        apiGatewayClient.clearAuthToken();
        setUser(null);
        return false;
      }
    } catch (error: any) {
      console.error('[AuthContext] Auth check failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // Clear token on any error
      console.log('[AuthContext] Clearing auth data due to error');
      localStorage.removeItem('auth_token');
      apiGatewayClient.clearAuthToken();
      setUser(null);
      return false;
    }
  };

  const login = async (username: string, password: string): Promise<void> => {
    console.log(`[AuthContext] Login attempt for user: ${username}`);
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiGatewayClient.login(username, password);
      
      if (response.success) {
        console.log('[AuthContext] Login successful, setting user:', response.user);
        setUser(response.user);
        console.log('[AuthContext] Navigating to dashboard');
        navigate('/dashboard');
      } else {
        const errorMsg = response.error || 'Login failed';
        console.error('[AuthContext] Login failed:', errorMsg);
        setError(errorMsg);
      }
    } catch (error: any) {
      console.error('[AuthContext] Login error:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
      console.log('[AuthContext] Login process complete');
    }
  };

  const logout = async (): Promise<void> => {
    console.log('[AuthContext] Logout initiated');
    try {
      await apiGatewayClient.logout();
      console.log('[AuthContext] Logout API call successful');
    } catch (error: any) {
      console.error('[AuthContext] Logout API error:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    } finally {
      // Clear all authentication data
      console.log('[AuthContext] Clearing all authentication data');
      setUser(null);
      apiGatewayClient.clearAuthToken();
      localStorage.removeItem('auth_token');
      // Set flag to prevent auto-redirect on login page
      sessionStorage.setItem('stay_on_login', 'true');
      console.log('[AuthContext] Navigating to login page');
      navigate('/login');
    }
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
