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
  User,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { getBookings, subscribeToBookingChanges } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { BookingStatus } from '../../types';


export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingsCount, setBookingsCount] = useState(0);
  const location = useLocation();

  const { user, profile, openAuthModal, signOut } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const updateCount = async () => {
      const activeStatuses: BookingStatus[] = [
        'requested',
        'dealer_assigned',
        'scheduled',
        'on_the_way',
        'in_progress',
        'collected_weighed',
        'payment_completed',
        'rescheduled',
      ];

      if (isSupabaseConfigured() && user) {
        try {
          const { count } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .in('status', activeStatuses);

          setBookingsCount(count || 0);
          return;
        } catch {
          // Fallback to local storage
        }
      }

      const all = getBookings();
      const active = all.filter((b) => activeStatuses.includes(b.status));
      setBookingsCount(active.length);
    };

    updateCount();
    const unsubscribe = subscribeToBookingChanges(updateCount);
    return () => unsubscribe();
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    showToast('Signed Out', 'You have been safely signed out.', 'info');
  };

  const navLinks = [
    { to: '/', label: 'Home', icon: Recycle },
    { to: '/prices', label: 'Scrap Prices', icon: Tag },
    { to: '/bookings', label: 'My Bookings', icon: CalendarCheck, badge: bookingsCount },
    { to: '/dealer', label: 'Dealer Portal', icon: Briefcase, demoTag: !isSupabaseConfigured() },
    ...(profile?.role === 'admin' || !isSupabaseConfigured()
      ? [
          {
            to: '/admin',
            label: 'Admin Portal',
            icon: ShieldCheck,
            demoTag: !isSupabaseConfigured(),
          },
        ]
      : []),
  ];

  const handleNavLinkClick = (e: React.MouseEvent, to: string) => {
    if (!user) {
      if (to === '/bookings') {
        e.preventDefault();
        openAuthModal({
          initialRole: 'customer',
          returnTo: '/bookings',
          reasonMessage: 'Please sign in to view your booking history and active pickups.',
        });
      } else if (to === '/dealer') {
        e.preventDefault();
        openAuthModal({
          initialRole: 'dealer',
          returnTo: '/dealer',
          reasonMessage: 'Please sign in with your authorized dealer credentials.',
        });
      } else if (to === '/admin') {
        e.preventDefault();
        openAuthModal({
          initialRole: 'admin',
          returnTo: '/admin',
          reasonMessage: 'Please sign in with your Urban Scrap administrator account.',
        });
      }
    }
  };

  const handleBookPickupClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal({
        initialRole: 'customer',
        returnTo: '/book',
        reasonMessage: 'Please sign in or create an account to schedule your doorstep pickup.',
      });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#fbfbf9]/95 backdrop-blur-md border-b border-[#e6e8e5] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Wordmark */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] rounded-xl p-1 -ml-1 transition-transform active:scale-[0.98]"
            aria-label="Urban Scrap Home"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#123b26] to-[#1a5336] flex items-center justify-center text-white shadow-md shadow-[#123b26]/20 group-hover:scale-105 transition-transform duration-200">
              <Recycle className="w-6 h-6 text-[#4ade80] stroke-[2.3]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-2xl tracking-tight text-[#123b26]">
                  Urban<span className="text-[#16a34a]">Scrap</span>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#eaf8ef] text-[#123b26] border border-[#bbf7d0]/70">
                  India
                </span>
              </div>
              <span className="text-[11px] text-[#717a75] font-medium -mt-1 hidden sm:inline">
                Doorstep Scrap Recycling
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={(e) => handleNavLinkClick(e, link.to)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-[#123b26] text-white shadow-sm'
                        : 'text-[#3f4541] hover:text-[#123b26] hover:bg-[#eef2ee]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />
                  <span>{link.label}</span>
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-[#16a34a] text-white leading-none">
                      {link.badge}
                    </span>
                  )}
                  {link.demoTag && (
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-900 border border-amber-300/80">
                      Demo
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#eaf8ef] border border-[#bbf7d0] text-xs">
                  <div className="w-7 h-7 rounded-lg bg-[#123b26] text-[#4ade80] flex items-center justify-center font-bold text-xs uppercase">
                    {(profile?.full_name || user.email || 'U')[0]}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-[#123b26] leading-tight">
                      {profile?.full_name || user.email?.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-[#16a34a] capitalize font-medium">
                      {profile?.role || 'Customer'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-2 text-[#717a75] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal({ initialRole: null })}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-[#123b26] hover:text-[#16a34a] border border-[#d1d5db] hover:border-[#123b26] hover:bg-[#eef2ee] active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
              >
                <User className="w-4 h-4 stroke-[2.2]" />
                <span>Login / Sign Up</span>
              </button>
            )}

            <Link
              to="/book"
              onClick={handleBookPickupClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#16a34a] to-[#15803d] hover:from-[#15803d] hover:to-[#123b26] text-white shadow-md shadow-[#16a34a]/25 hover:shadow-lg hover:shadow-[#16a34a]/30 active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
            >
              <Truck className="w-4 h-4 stroke-[2.3]" />
              <span>Book a Pickup</span>
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal({ initialRole: null })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs text-[#123b26] border border-[#d1d5db] hover:bg-[#eef2ee] transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            )}

            <Link
              to="/book"
              onClick={handleBookPickupClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs bg-[#16a34a] text-white shadow-sm"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Book</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-[#3f4441] hover:text-[#123b26] hover:bg-[#eef2ee] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
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
        <div className="md:hidden border-t border-[#e6e8e5] bg-[#fbfbf9] px-4 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-2">
          {user && (
            <div className="mb-3 p-3 rounded-2xl bg-[#eaf8ef] border border-[#bbf7d0] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#123b26] text-[#4ade80] flex items-center justify-center font-bold uppercase">
                  {(profile?.full_name || user.email || 'U')[0]}
                </div>
                <div>
                  <span className="font-bold text-[#123b26] block">
                    {profile?.full_name || user.email}
                  </span>
                  <span className="text-[10px] text-[#16a34a] capitalize">
                    {profile?.role || 'Customer'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-white border border-rose-200"
              >
                Sign Out
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={(e) => {
                    handleNavLinkClick(e, link.to);
                    if (user || (link.to !== '/bookings' && link.to !== '/dealer')) {
                      setMobileMenuOpen(false);
                    }
                  }}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold transition-all ${
                      isActive
                        ? 'bg-[#123b26] text-white shadow-sm'
                        : 'text-[#282c2a] hover:bg-[#eef2ee]'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 shrink-0 stroke-[2.2]" />
                    <span>{link.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#16a34a] text-white">
                        {link.badge} active
                      </span>
                    )}
                    {link.demoTag && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-900 border border-amber-300">
                        Demo
                      </span>
                    )}
                  </div>
                </NavLink>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-[#e6e8e5] space-y-2.5">
            {!user && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal({ initialRole: null });
                }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-[#123b26] border-2 border-[#123b26] hover:bg-[#eef2ee] transition-all"
              >
                <User className="w-4 h-4 stroke-[2.2]" />
                <span>Login / Sign Up</span>
              </button>
            )}

            <Link
              to="/book"
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleBookPickupClick(e);
              }}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-[#16a34a] to-[#123b26] text-white shadow-md shadow-[#16a34a]/20 active:scale-[0.98] transition-transform"
            >
              <Truck className="w-5 h-5 stroke-[2.3]" />
              <span>Schedule Free Doorstep Pickup</span>
            </Link>
          </div>

          <div className="mt-4 px-3 py-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {isSupabaseConfigured()
                ? 'Connected to Supabase PostgreSQL backend with Row Level Security.'
                : 'Demo mode active. Add Supabase keys to connect real database.'}
            </span>
          </div>
        </div>
      )}
    </header>
  );
};
