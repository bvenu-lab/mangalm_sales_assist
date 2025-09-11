import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';

const SimpleProtectedRoute: React.FC = () => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('[SimpleProtectedRoute] Checking authentication...');
      
      // Check for token in localStorage
      const token = localStorage.getItem('auth_token');
      console.log('[SimpleProtectedRoute] Token exists:', !!token);
      
      if (token && token !== 'null' && token !== 'undefined') {
        // We have a token, verify it's valid
        try {
          const response = await fetch('http://localhost:3007/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('[SimpleProtectedRoute] Token valid, user:', data.user?.username);
            setIsAuthenticated(true);
          } else {
            console.log('[SimpleProtectedRoute] Token invalid, clearing...');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('[SimpleProtectedRoute] Auth check error:', error);
          // On error, assume authenticated if token exists
          setIsAuthenticated(true);
        }
      } else {
        console.log('[SimpleProtectedRoute] No token found');
        setIsAuthenticated(false);
      }
      
      setIsChecking(false);
    };
    
    checkAuth();
  }, []);

  if (isChecking) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        flexDirection="column"
      >
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    console.log('[SimpleProtectedRoute] Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('[SimpleProtectedRoute] Authenticated, rendering protected content');
  return <Outlet />;
};

export default SimpleProtectedRoute;