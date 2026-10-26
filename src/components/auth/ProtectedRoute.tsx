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
  const { user, profile, dealer, loading, isConfigured, openAuthModal, refreshDealer, signOut } = useAuth();
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
    const isAdminTarget = allowedRoles?.includes('admin');

    const handleSignInClick = () => {
      if (onOpenAuth) {
        onOpenAuth();
      } else {
        openAuthModal({
          initialRole: isAdminTarget ? 'admin' : isDealerTarget ? 'dealer' : 'customer',
          returnTo: targetPath,
          reasonMessage: isAdminTarget
            ? 'Urban Scrap administrator credentials are required to access this dashboard.'
            : isDealerTarget
            ? 'Please sign in with your authorized dealer partner account.'
            : 'Please sign in or create an account to access this page.',
        });
      }
    };

    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border shadow-sm ${
          isAdminTarget
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : isDealerTarget
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          <Lock className="w-7 h-7 stroke-[2.2]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-[#123b26]">
            {isAdminTarget
              ? 'Administrator Authentication Required'
              : isDealerTarget
              ? 'Dealer Authentication Required'
              : 'Authentication Required'}
          </h2>
          <p className="text-sm text-[#525955] leading-relaxed">
            {isAdminTarget
              ? 'Please sign in with your authorized Urban Scrap administrator account to review dealer applications and system operations.'
              : isDealerTarget
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
            <span>{isAdminTarget ? 'Sign In as Administrator' : 'Sign In / Create Account'}</span>
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
    if (!profile) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-3 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-[#717a75]">Verifying permissions...</p>
          </div>
        </div>
      );
    }

    const currentRole = profile.role;
    const isDealerRequested = allowedRoles.includes('dealer');
    const isAdminRequested = allowedRoles.includes('admin');

    // Admin target check: Only accounts with role 'admin' can access admin routes
    if (isAdminRequested && currentRole !== 'admin') {
      return (
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-700 mx-auto flex items-center justify-center border border-rose-200">
            <Lock className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-[#123b26]">You Don’t Have Admin Access</h2>
            <p className="text-sm text-[#525955] leading-relaxed">
              Your account (<strong className="text-[#191c1a]">{user.email || profile?.phone || 'Current User'}</strong>) does not have administrator privileges.
              Administrative access is strictly granted through database authorization policies.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={async () => {
                await signOut();
                openAuthModal({
                  initialRole: 'admin',
                  returnTo: '/admin',
                  reasonMessage: 'Please sign in with your authorized administrator account.',
                });
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#123b26] hover:bg-[#1a5336] shadow-sm transition-colors"
            >
              <span>Sign In with Admin Account</span>
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

    // Dealer target check:
    if (isDealerRequested && currentRole !== 'admin') {
      const status = dealer?.verification_status || (dealer?.is_verified ? 'approved' : 'pending');

      // Case A: User has not applied as a dealer yet
      if (!dealer) {
        return (
          <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center border border-amber-200">
              <Store className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-[#123b26]">Dealer Partner Registration Required</h2>
              <p className="text-sm text-[#525955] leading-relaxed">
                Your account (<strong className="text-[#191c1a]">{user.email}</strong>) is currently a customer account. To access the Dealer Portal, please submit a dealer partner application and GST verification details.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  openAuthModal({
                    initialRole: 'dealer',
                    returnTo: '/dealer/verify-gst',
                    reasonMessage: 'Submit your dealer partner details and GST information.',
                  })
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#123b26] text-white hover:bg-[#1a5336] transition-colors"
              >
                <span>Apply as Dealer Partner</span>
                <ArrowRight className="w-4 h-4" />
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

      // Case Demo: Authorized Demo Dealer (Read-Only access to /dealer)
      if (dealer?.is_demo || profile?.is_demo) {
        return <>{children}</>;
      }

      // Case B: Application is Rejected
      if (status === 'rejected') {
        return (
          <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-700 mx-auto flex items-center justify-center border border-rose-200">
              <Store className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div className="space-y-2">
              <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold uppercase rounded-full">
                Application Rejected
              </span>
              <h2 className="text-2xl font-extrabold text-[#123b26]">GST Verification Requires Correction</h2>
              <p className="text-sm text-[#525955] leading-relaxed">
                Your dealer partner application was reviewed by an administrator and could not be approved at this time.
              </p>
              {dealer.rejection_reason && (
                <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 text-left text-xs text-rose-900">
                  <span className="font-bold block mb-1">Reason from Administrator:</span>
                  <p>{dealer.rejection_reason}</p>
                </div>
              )}
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/dealer/verify-gst"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#123b26] text-white hover:bg-[#1a5336] transition-colors"
              >
                <span>Correct & Resubmit GST Details</span>
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

      // Case C: Application is Pending or Not Verified
      if (status === 'pending' || !dealer.is_verified) {
        return (
          <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center border border-amber-200">
              <Clock className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div className="space-y-2">
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold uppercase rounded-full">
                Verification In Progress
              </span>
              <h2 className="text-2xl font-extrabold text-[#123b26]">Dealer Partner Verification Pending</h2>
              <p className="text-sm text-[#525955] leading-relaxed">
                Welcome, <strong className="text-[#191c1a]">{dealer.business_name || profile?.full_name || user.email}</strong>!
                Your dealer application and GST details have been submitted and are currently awaiting manual verification by an administrator.
              </p>
              <p className="text-xs text-[#717a75] leading-relaxed">
                Access to route pickup requests and the Dealer Portal is locked until your GST registration details are verified.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/dealer/verify-gst"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#123b26] text-white hover:bg-[#1a5336] transition-colors"
              >
                <span>View GST Application Status</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => refreshDealer()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#525955] border border-[#d1d5db] hover:bg-[#f1f3f1] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>
        );
      }
    }

    // Generic role check fallback
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
