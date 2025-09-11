import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import authService from '../../services/auth-service';

const SimplifiedProtectedRoute: React.FC = () => {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    // Single auth check on mount
    authService.checkAuth().then(isAuthenticated => {
      setAuthState(isAuthenticated ? 'authenticated' : 'unauthenticated');
    });
  }, []);

  // Loading state
  if (authState === 'loading') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // Not authenticated - redirect to login
  if (authState === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  // Authenticated - render children
  return <Outlet />;
};

export default SimplifiedProtectedRoute;