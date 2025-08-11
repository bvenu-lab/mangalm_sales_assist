import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import { useAuth } from './contexts/AuthContext';
import MainLayout from './components/layouts/MainLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/errors/ErrorBoundary';
import NotificationProvider from './components/notifications/NotificationSystem';
import { SkeletonDashboard } from './components/loading/LoadingSkeleton';

// Lazy load pages for better performance
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ClearAuthPage = lazy(() => import('./pages/auth/ClearAuthPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const StoreListPage = lazy(() => import('./pages/stores/StoreListPage'));
const StoreDetailPage = lazy(() => import('./pages/stores/StoreDetailPage'));
const CallListPage = lazy(() => import('./pages/calls/CallListPage'));
const OrderCreatePage = lazy(() => import('./pages/orders/OrderCreatePage'));
const OrderHistoryPage = lazy(() => import('./pages/orders/OrderHistoryPage'));
const PerformancePage = lazy(() => import('./pages/performance/PerformancePage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/errors/NotFoundPage'));

// Loading component for suspense fallback with skeleton
const LoadingFallback = () => <SkeletonDashboard />;

const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading indicator while checking authentication
  if (isLoading) {
    return <LoadingFallback />;
  }

  return (
    <ErrorBoundary level="page">
      <NotificationProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } />
        <Route path="/clear-auth" element={<ClearAuthPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/stores" element={<StoreListPage />} />
            <Route path="/stores/:id" element={<StoreDetailPage />} />
            <Route path="/calls" element={<CallListPage />} />
            <Route path="/orders/create" element={<OrderCreatePage />} />
            <Route path="/orders/:id" element={<OrderCreatePage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
            <Route path="/invoices/:id" element={<NotFoundPage />} /> {/* Placeholder for future InvoiceDetailPage */}
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
      </NotificationProvider>
    </ErrorBoundary>
  );
};

export default App;
