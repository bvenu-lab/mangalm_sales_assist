import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import { useAuth } from './contexts/AuthContext';
import MainLayout from './components/layouts/MainLayout';
import SimpleProtectedRoute from './components/common/SimpleProtectedRoute';
import ErrorBoundary from './components/errors/ErrorBoundary';
import NotificationProvider from './components/notifications/NotificationSystem';
import { SkeletonDashboard } from './components/loading/LoadingSkeleton';

// Lazy load pages for better performance
const LoginPage = lazy(() => import('./pages/auth/FormLoginPage'));
const ClearAuthPage = lazy(() => import('./pages/auth/ClearAuthPage'));
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
const BulkUploadPage = lazy(() => import('./pages/upload/BulkUploadPage'));
const EnterpriseBulkUploadPage = lazy(() => import('./pages/upload/EnterpriseBulkUploadPage'));
const NotFoundPage = lazy(() => import('./pages/errors/NotFoundPage'));
const DocumentProcessingPage = lazy(() => import('./pages/documents/DocumentProcessingPage'));

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
        <Route element={<SimpleProtectedRoute />}>
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
            <Route path="/invoices/:id" element={<NotFoundPage />} /> {/* Placeholder for future InvoiceDetailPage */}
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/bulk-upload" element={<EnterpriseBulkUploadPage />} />
            <Route path="/upload" element={<EnterpriseBulkUploadPage />} />
            <Route path="/legacy-upload" element={<BulkUploadPage />} />
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
