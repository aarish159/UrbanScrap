import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Recycle,
  CalendarCheck,
  Tag,
  Briefcase,
  Menu,
  X,
  Truck,
  Sparkles,
} from 'lucide-react';
import { getBookings, subscribeToBookingChanges } from '../../utils/storage';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingsCount, setBookingsCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const updateCount = () => {
      const all = getBookings();
      const active = all.filter(
        (b) => b.status === 'requested' || b.status === 'dealer_assigned' || b.status === 'in_progress'
      );
      setBookingsCount(active.length);
    };

    updateCount();
    const unsubscribe = subscribeToBookingChanges(updateCount);
    return () => unsubscribe();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/', label: 'Home', icon: Recycle },
    { to: '/prices', label: 'Scrap Prices', icon: Tag },
    { to: '/bookings', label: 'My Bookings', icon: CalendarCheck, badge: bookingsCount },
    { to: '/dealer', label: 'Dealer Dashboard', icon: Briefcase, demoTag: true },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#fbfbf9]/95 backdrop-blur-md border-b border-[#e8e8e3] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Wordmark */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] rounded-lg p-1"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#143e29] to-[#1e583c] flex items-center justify-center text-white shadow-md shadow-[#143e29]/15 group-hover:scale-105 transition-transform duration-200">
              <Recycle className="w-6 h-6 text-[#4ade80] stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-2xl tracking-tight text-[#143e29]">
                  Urban<span className="text-[#16a34a]">Scrap</span>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#dcfce7] text-[#143e29]">
                  India
                </span>
              </div>
              <span className="text-[11px] text-[#717a75] font-medium -mt-1 hidden sm:inline">
                Doorstep Scrap Recycling
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-[#143e29] text-white shadow-sm'
                        : 'text-[#3f4441] hover:text-[#143e29] hover:bg-[#eef2ee]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 text-[11px] font-bold rounded-full bg-[#16a34a] text-white">
                      {link.badge}
                    </span>
                  )}
                  {link.demoTag && (
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded bg-amber-100 text-amber-800 border border-amber-300">
                      Demo
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Primary CTA Button */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/book"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white shadow-md shadow-[#16a34a]/25 hover:shadow-lg hover:shadow-[#16a34a]/30 hover:from-[#15803d] hover:to-[#166534] active:scale-[0.98] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:ring-offset-2"
            >
              <Truck className="w-4 h-4 stroke-[2.3]" />
              <span>Book a Pickup</span>
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/book"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs bg-[#16a34a] text-white"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Book</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#3f4441] hover:text-[#143e29] hover:bg-[#eef2ee] focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#e8e8e3] bg-[#fbfbf9] px-4 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-2">
          <div className="space-y-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold transition-all ${
                      isActive
                        ? 'bg-[#143e29] text-white'
                        : 'text-[#282c2a] hover:bg-[#eef2ee]'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span>{link.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#16a34a] text-white">
                        {link.badge} active
                      </span>
                    )}
                    {link.demoTag && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-amber-100 text-amber-800 border border-amber-300">
                        Demo
                      </span>
                    )}
                  </div>
                </NavLink>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-[#e8e8e3]">
            <Link
              to="/book"
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-[#16a34a] to-[#143e29] text-white shadow-md shadow-[#16a34a]/20"
            >
              <Truck className="w-5 h-5" />
              <span>Schedule Free Doorstep Pickup</span>
            </Link>
          </div>

          <div className="mt-4 px-2 py-2 rounded-lg bg-amber-50 border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              All rates & bookings in this demo are simulated with local browser state.
            </span>
          </div>
        </div>
      )}
    </header>
  );
};
