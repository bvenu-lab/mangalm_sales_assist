import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layouts/MainLayout';
import EnhancedDashboard from './pages/dashboard/EnhancedDashboard';
import StoreListPage from './pages/stores/StoreListPage';
import StoreDetailPage from './pages/stores/StoreDetailPage';
import StoreEditPage from './pages/stores/StoreEditPage';
import CallListPage from './pages/calls/CallListPage';
import OrderCreatePage from './pages/orders/OrderCreatePage';
import OrderDetailPage from './pages/orders/OrderDetailPage';
import OrderHistoryPage from './pages/orders/OrderHistoryPage';
import ImportOrdersPage from './pages/orders/ImportOrdersPage';
import PredictedOrderDetailPage from './pages/orders/PredictedOrderDetailPage';
import PerformancePage from './pages/performance/PerformancePage';
import ProfilePage from './pages/profile/ProfilePage';
import SettingsPage from './pages/settings/SettingsPage';
import EnterpriseBulkUploadPage from './pages/upload/EnterpriseBulkUploadPage';
import NotFoundPage from './pages/errors/NotFoundPage';
import DocumentProcessingPage from './pages/documents/DocumentProcessingPage';
import ErrorBoundary from './components/errors/ErrorBoundary';
import NotificationProvider from './components/notifications/NotificationSystem';

// No authentication - direct access to everything
const NoAuthApp: React.FC = () => {
  return (
    <ErrorBoundary level="page">
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<EnhancedDashboard />} />
            <Route path="documents" element={<DocumentProcessingPage />} />
            <Route path="stores" element={<StoreListPage />} />
            <Route path="stores/:id" element={<StoreDetailPage />} />
            <Route path="stores/:id/edit" element={<StoreEditPage />} />
            <Route path="calls" element={<CallListPage />} />
            <Route path="orders/create" element={<OrderCreatePage />} />
            <Route path="orders/import" element={<ImportOrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="orders" element={<OrderHistoryPage />} />
            <Route path="predicted-orders/:id" element={<PredictedOrderDetailPage />} />
            <Route path="performance" element={<PerformancePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="bulk-upload" element={<EnterpriseBulkUploadPage />} />
            <Route path="upload" element={<EnterpriseBulkUploadPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </NotificationProvider>
    </ErrorBoundary>
  );
};

export default NoAuthApp;