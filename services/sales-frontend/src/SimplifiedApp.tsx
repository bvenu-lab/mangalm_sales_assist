import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import MainLayout from './components/layouts/MainLayout';
import SimplifiedProtectedRoute from './components/auth/SimplifiedProtectedRoute';
import ErrorBoundary from './components/errors/ErrorBoundary';
import NotificationProvider from './components/notifications/NotificationSystem';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/auth/SimplifiedLoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/EnhancedDashboard'));
const StoreListPage = lazy(() => import('./pages/stores/StoreListPage'));
const StoreDetailPage = lazy(() => import('./pages/stores/StoreDetailPage'));
const CallListPage = lazy(() => import('./pages/calls/CallListPage'));
const OrderCreatePage = lazy(() => import('./pages/orders/OrderCreatePage'));
const OrderDetailPage = lazy(() => import('./pages/orders/OrderDetailPage'));
const OrderHistoryPage = lazy(() => import('./pages/orders/OrderHistoryPage'));
const ImportOrdersPage = lazy(() => import('./pages/orders/ImportOrdersPage'));
const PerformancePage = lazy(() => import('./pages/performance/PerformancePage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const EnterpriseBulkUploadPage = lazy(() => import('./pages/upload/EnterpriseBulkUploadPage'));
const NotFoundPage = lazy(() => import('./pages/errors/NotFoundPage'));
const DocumentProcessingPage = lazy(() => import('./pages/documents/DocumentProcessingPage'));

// Loading component
const LoadingFallback = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
    <CircularProgress />
  </Box>
);

const SimplifiedApp: React.FC = () => {
  return (
    <ErrorBoundary level="page">
      <NotificationProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public route - Login */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route element={<SimplifiedProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/documents" element={<DocumentProcessingPage />} />
                <Route path="/stores" element={<StoreListPage />} />
                <Route path="/stores/:id" element={<StoreDetailPage />} />
                <Route path="/calls" element={<CallListPage />} />
                <Route path="/orders/create" element={<OrderCreatePage />} />
                <Route path="/orders/import" element={<ImportOrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/orders" element={<OrderHistoryPage />} />
                <Route path="/performance" element={<PerformancePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/bulk-upload" element={<EnterpriseBulkUploadPage />} />
                <Route path="/upload" element={<EnterpriseBulkUploadPage />} />
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

export default SimplifiedApp;