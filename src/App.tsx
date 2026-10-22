import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { PriceDirectoryPage } from './pages/PriceDirectoryPage';
import { BookingPage } from './pages/BookingPage';
import { BookingsListPage } from './pages/BookingsListPage';
import { DealerDashboardPage } from './pages/DealerDashboardPage';
import { AdminDealersPage } from './pages/AdminDealersPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Scroll to top helper on navigation
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ScrollToTop />
          <div className="min-h-screen flex flex-col bg-[#fbfbf9] text-[#191c1a] antialiased">
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/prices" element={<PriceDirectoryPage />} />
                <Route
                  path="/book"
                  element={
                    <ProtectedRoute returnTo="/book">
                      <BookingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/bookings"
                  element={
                    <ProtectedRoute returnTo="/bookings">
                      <BookingsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer"
                  element={
                    <ProtectedRoute allowedRoles={['dealer', 'admin']} returnTo="/dealer">
                      <DealerDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']} returnTo="/admin">
                      <AdminDealersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/dealers"
                  element={
                    <ProtectedRoute allowedRoles={['admin']} returnTo="/admin">
                      <AdminDealersPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
