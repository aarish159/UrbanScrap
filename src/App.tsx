import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { ToastProvider } from './components/ui/Toast';
import { LandingPage } from './pages/LandingPage';
import { PriceDirectoryPage } from './pages/PriceDirectoryPage';
import { BookingPage } from './pages/BookingPage';
import { BookingsListPage } from './pages/BookingsListPage';
import { DealerDashboardPage } from './pages/DealerDashboardPage';
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
        <ScrollToTop />
        <div className="min-h-screen flex flex-col bg-[#fbfbf9] text-[#191c1a] antialiased">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/prices" element={<PriceDirectoryPage />} />
              <Route path="/book" element={<BookingPage />} />
              <Route path="/bookings" element={<BookingsListPage />} />
              <Route path="/dealer" element={<DealerDashboardPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
