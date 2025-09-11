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
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const navigate = useNavigate();

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuthOnMount = async () => {
      console.log('════════════════════════════════════════════════');
      console.log('[AuthContext] MOUNT: Starting authentication check');
      console.log('[AuthContext] MOUNT: isLoading =', isLoading);
      console.log('[AuthContext] MOUNT: authInitialized =', authInitialized);
      console.log('[AuthContext] MOUNT: user =', user);
      console.log('════════════════════════════════════════════════');
      
      // Don't change loading state until auth check is complete
      const isAuthenticated = await checkAuth();
      console.log(`[AuthContext] MOUNT: Auth check result = ${isAuthenticated}`);
      
      // Mark as initialized and stop loading only after check is complete
      console.log('[AuthContext] MOUNT: Setting authInitialized = true');
      setAuthInitialized(true);
      console.log('[AuthContext] MOUNT: Setting isLoading = false');
      setIsLoading(false);
      console.log('[AuthContext] MOUNT: Complete!');
      console.log('════════════════════════════════════════════════');
    };
    
    checkAuthOnMount();
  }, []);

  const checkAuth = async (): Promise<boolean> => {
    console.log('[AuthContext] Starting auth check...');
    console.log('[AuthContext] Current location:', window.location.pathname);
    console.log('[AuthContext] LocalStorage contents:', {
      auth_token: localStorage.getItem('auth_token'),
      all_keys: Object.keys(localStorage)
    });
    
    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        console.log('[AuthContext] No auth token found in localStorage');
        console.log('[AuthContext] Setting user to null, returning false');
        setUser(null);
        return false;
      }
      
      console.log('[AuthContext] Auth token found:', token.substring(0, 50) + '...');
      console.log('[AuthContext] Setting token in apiGatewayClient...');
      // Verify token with backend
      apiGatewayClient.setAuthToken(token);
      
      try {
        console.log('[AuthContext] Making API call to /api/auth/me...');
        const response = await apiGatewayClient.get('/api/auth/me');
        console.log('[AuthContext] /api/auth/me response:', response);
        
        // API returns { success: true, user: {...} }
        if (response && response.success && response.user) {
          console.log('[AuthContext] Token verified successfully!');
          console.log('[AuthContext] User data received:', response.user);
          // Ensure user has required fields
          const userData = {
            ...response.user,
            name: response.user.name || `${response.user.firstName || ''} ${response.user.lastName || ''}`.trim() || response.user.username
          };
          console.log('[AuthContext] Setting user data:', userData);
          setUser(userData);
          console.log('[AuthContext] Returning true from checkAuth');
          return true;
        } else {
          // Token is invalid or expired
          console.log('[AuthContext] Token invalid or expired!');
          console.log('[AuthContext] Response was:', response);
          console.log('[AuthContext] Response success:', response?.success);
          console.log('[AuthContext] Response user:', response?.user);
          console.log('[AuthContext] Clearing auth data...');
          localStorage.removeItem('auth_token');
          apiGatewayClient.clearAuthToken();
          setUser(null);
          return false;
        }
      } catch (apiError: any) {
        // Check if it's a 401/403 error specifically
        if (apiError.response?.status === 401 || apiError.response?.status === 403) {
          console.log('[AuthContext] Token rejected by server, clearing auth data');
          localStorage.removeItem('auth_token');
          apiGatewayClient.clearAuthToken();
          setUser(null);
          return false;
        }
        // For other errors, might be network issues, don't clear token yet
        throw apiError;
      }
    } catch (error: any) {
      console.error('[AuthContext] Auth check failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // Only clear token for authentication errors, not network errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('[AuthContext] Clearing auth data due to auth error');
        localStorage.removeItem('auth_token');
        apiGatewayClient.clearAuthToken();
        setUser(null);
      }
      return false;
    }
  };

  const login = async (username: string, password: string): Promise<void> => {
    console.log('════════════════════════════════════════════════');
    console.log(`[AuthContext] LOGIN: Starting for user: ${username}`);
    console.log('[AuthContext] LOGIN: Current state:', {
      isLoading,
      authInitialized,
      user: user ? user.username : null
    });
    console.log('════════════════════════════════════════════════');
    
    try {
      console.log('[AuthContext] LOGIN: Setting isLoading = true');
      setIsLoading(true);
      setError(null);
      
      console.log('[AuthContext] LOGIN: Calling apiGatewayClient.login()...');
      const response = await apiGatewayClient.login(username, password);
      console.log('[AuthContext] LOGIN: Response received:', response);
      
      // API returns { success: true, token: ..., user: {...} }
      if (response && response.success && response.token && response.user) {
        console.log('[AuthContext] LOGIN: Success! Token received');
        console.log('[AuthContext] LOGIN: User data:', response.user);
        
        // Ensure user has required fields
        const userData = {
          ...response.user,
          name: response.user.name || `${response.user.firstName || ''} ${response.user.lastName || ''}`.trim() || response.user.username
        };
        
        console.log('[AuthContext] LOGIN: Setting user state:', userData);
        // Set user state immediately
        setUser(userData);
        
        console.log('[AuthContext] LOGIN: Setting authInitialized = true');
        // Mark as initialized
        setAuthInitialized(true);
        
        console.log('[AuthContext] LOGIN: Preparing to navigate to dashboard...');
        // Small delay to ensure state updates are processed
        setTimeout(() => {
          console.log('[AuthContext] LOGIN: Navigating NOW to /dashboard');
          navigate('/dashboard');
        }, 100);
      } else {
        const errorMsg = response?.error || 'Login failed - invalid response';
        console.error('[AuthContext] LOGIN: Failed!', errorMsg);
        console.error('[AuthContext] LOGIN: Full response was:', response);
        console.error('[AuthContext] LOGIN: Response structure:', {
          hasSuccess: 'success' in response,
          success: response?.success,
          hasToken: 'token' in response,
          hasUser: 'user' in response
        });
        setError(errorMsg);
      }
    } catch (error: any) {
      console.error('[AuthContext] Login error:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setError(error.response?.data?.error || error.message || 'Login failed. Please try again.');
    } finally {
      console.log('[AuthContext] LOGIN: Setting isLoading = false');
      setIsLoading(false);
      console.log('[AuthContext] LOGIN: Process complete');
      console.log('════════════════════════════════════════════════');
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

  // Log state changes
  useEffect(() => {
    console.log('[AuthContext] STATE CHANGE:', {
      user: user ? user.username : null,
      authInitialized,
      isLoading,
      isAuthenticated: !!user && authInitialized,
      computedIsLoading: isLoading || !authInitialized
    });
  }, [user, authInitialized, isLoading]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && authInitialized,
        isLoading: isLoading || !authInitialized,
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
