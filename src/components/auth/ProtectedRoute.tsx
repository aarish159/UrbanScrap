import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Store, UserCheck, ArrowRight, Clock, RefreshCw } from 'lucide-react';
import type { UserRole } from '../../types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  returnTo?: string;
  onOpenAuth?: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  returnTo,
  onOpenAuth,
}) => {
  const { user, profile, dealer, loading, isConfigured, openAuthModal, refreshDealer } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#717a75]">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user && isConfigured) {
    const targetPath = returnTo || location.pathname;
    const isDealerTarget = allowedRoles?.includes('dealer');

    const handleSignInClick = () => {
      if (onOpenAuth) {
        onOpenAuth();
      } else {
        openAuthModal({
          initialRole: isDealerTarget ? 'dealer' : 'customer',
          returnTo: targetPath,
          reasonMessage: isDealerTarget
            ? 'Please sign in with your authorized dealer partner account.'
            : 'Please sign in or create an account to access this page.',
        });
      }
    };

    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center border border-amber-200 shadow-sm">
          <Lock className="w-7 h-7 stroke-[2.2]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-[#123b26]">
            {isDealerTarget ? 'Dealer Authentication Required' : 'Authentication Required'}
          </h2>
          <p className="text-sm text-[#525955] leading-relaxed">
            {isDealerTarget
              ? 'Please sign in with your verified scrap merchant or fleet credentials to access the dealer dashboard.'
              : 'Please sign in or create an Urban Scrap account to schedule pickups or view your bookings.'}
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleSignInClick}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#123b26] hover:bg-[#1a5336] text-white shadow-md transition-all active:scale-[0.98]"
          >
            <UserCheck className="w-4 h-4" />
            <span>Sign In / Create Account</span>
          </button>
          <Link
            to="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#525955] hover:bg-[#f1f3f1] transition-colors"
          >
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  // Check required role if specified
  if (user && allowedRoles && allowedRoles.length > 0) {
    const currentRole = profile?.role || 'customer';
    const isDealerRequested = allowedRoles.includes('dealer');

    // Case 1: Account is Customer, but trying to access Dealer Dashboard
    // Requirement 4 & 5: Customers cannot switch to dealer, show clear message and DO NOT open Dealer Dashboard
    if (isDealerRequested && currentRole === 'customer') {
      return (
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-700 mx-auto flex items-center justify-center border border-rose-200">
            <Store className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-[#123b26]">Dealer Access Restricted</h2>
            <p className="text-sm text-[#525955] leading-relaxed">
              Your account (<strong className="text-[#191c1a]">{user.email}</strong>) is registered as a{' '}
              <span className="capitalize font-semibold text-[#16a34a]">Customer</span>. The Dealer Dashboard is reserved strictly for authorized scrap merchants and pickup fleets. Customers cannot switch themselves to dealer permissions.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/bookings"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#123b26] text-white hover:bg-[#1a5336] transition-colors"
            >
              <span>View My Bookings</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#525955] border border-[#d1d5db] hover:bg-[#f1f3f1] transition-colors"
            >
              <span>Return Home</span>
            </Link>
          </div>
        </div>
      );
    }

    // Case 2: Account is Dealer, but pending verification
    // Requirement 4 & 5: New dealer applicants remain pending until admin verifies them. Show clear message and DO NOT open dashboard.
    if (isDealerRequested && currentRole === 'dealer') {
      const isVerified = dealer?.is_verified ?? false;
      if (!isVerified) {
        return (
          <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center border border-amber-200">
              <Clock className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-[#123b26]">Dealer Partner Verification Pending</h2>
              <p className="text-sm text-[#525955] leading-relaxed">
                Welcome, <strong className="text-[#191c1a]">{dealer?.business_name || profile?.full_name || user.email}</strong>! Your merchant partner account is registered, but currently pending review by an Urban Scrap administrator.
              </p>
              <p className="text-xs text-[#717a75] leading-relaxed">
                Collection route assignments and the Dealer Dashboard will be activated once your trade credentials and service area are verified.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => refreshDealer()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#123b26] text-white hover:bg-[#1a5336] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Status</span>
              </button>
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#525955] border border-[#d1d5db] hover:bg-[#f1f3f1] transition-colors"
              >
                <span>Return Home</span>
              </Link>
            </div>
          </div>
        );
      }
    }

    // Case 3: Other disallowed role (non-admin)
    const isAllowed = allowedRoles.includes(currentRole) || currentRole === 'admin';
    if (!isAllowed) {
      return (
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-700 mx-auto flex items-center justify-center border border-rose-200">
            <Store className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-[#123b26]">Access Restricted</h2>
            <p className="text-sm text-[#525955] leading-relaxed">
              Your account does not have permission to view this section.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#525955] border border-[#d1d5db] hover:bg-[#f1f3f1] transition-colors"
            >
              <span>Return Home</span>
            </Link>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
