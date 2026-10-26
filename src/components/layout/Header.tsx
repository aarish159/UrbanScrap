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
    <header className="sticky top-0 z-40 bg-[#07130c]/85 backdrop-blur-xl border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Wordmark */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] rounded-xl p-1 -ml-1 transition-transform active:scale-[0.98]"
            aria-label="Urban Scrap Home"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0e2c1c] to-[#144229] border border-emerald-500/30 flex items-center justify-center text-white shadow-lg shadow-black/40 group-hover:scale-105 group-hover:border-emerald-500/50 transition-all duration-200">
              <Recycle className="w-6 h-6 text-[#4ade80] stroke-[2.3]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-2xl tracking-tight text-white">
                  Urban<span className="text-[#22c55e]">Scrap</span>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  India
                </span>
              </div>
              <span className="text-[11px] text-[#789082] font-medium -mt-1 hidden sm:inline">
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
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                        : 'text-[#9cb1a4] hover:text-white hover:bg-white/[0.05] border border-transparent'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />
                  <span>{link.label}</span>
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-[#22c55e] text-black leading-none">
                      {link.badge}
                    </span>
                  )}
                  {link.demoTag && (
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
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
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0e261a] border border-emerald-500/25 text-xs text-white">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-[#4ade80] border border-emerald-500/30 flex items-center justify-center font-bold text-xs uppercase">
                    {(profile?.full_name || user.email || 'U')[0]}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-white leading-tight">
                      {profile?.full_name || user.email?.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-emerald-400 capitalize font-medium">
                      {profile?.role || 'Customer'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-2 text-[#789082] hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20"
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
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-[#e2ede7] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] hover:border-emerald-500/30 active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]"
              >
                <User className="w-4 h-4 stroke-[2.2]" />
                <span>Login / Sign Up</span>
              </button>
            )}

            <Link
              to="/book"
              onClick={handleBookPickupClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#16a34a] to-[#15803d] hover:from-[#22c55e] hover:to-[#16a34a] text-white shadow-lg shadow-emerald-950/60 hover:shadow-emerald-500/25 active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]"
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
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal({ initialRole: null })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs text-white/90 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            )}

            <Link
              to="/book"
              onClick={handleBookPickupClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-950/50"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Book</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
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
        <div className="md:hidden border-t border-white/[0.08] bg-[#07130c]/95 backdrop-blur-2xl px-4 pt-3 pb-6 shadow-2xl animate-in slide-in-from-top-2">
          {user && (
            <div className="mb-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold uppercase">
                  {(profile?.full_name || user.email || 'U')[0]}
                </div>
                <div>
                  <span className="font-bold text-white block">
                    {profile?.full_name || user.email}
                  </span>
                  <span className="text-[10px] text-emerald-400 capitalize">
                    {profile?.role || 'Customer'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
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
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-sm'
                        : 'text-white/80 hover:bg-white/[0.06] hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 shrink-0 stroke-[2.2]" />
                    <span>{link.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500 text-white">
                        {link.badge} active
                      </span>
                    )}
                    {link.demoTag && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Demo
                      </span>
                    )}
                  </div>
                </NavLink>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-white/[0.08] space-y-2.5">
            {!user && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal({ initialRole: null });
                }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white bg-white/[0.05] border border-white/10 hover:bg-white/10 transition-all"
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
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-950/60 active:scale-[0.98] transition-transform"
            >
              <Truck className="w-5 h-5 stroke-[2.3]" />
              <span>Schedule Free Doorstep Pickup</span>
            </Link>
          </div>

          <div className="mt-4 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-emerald-200/80 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
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
