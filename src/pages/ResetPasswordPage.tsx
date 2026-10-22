import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  KeyRound,
  ShieldCheck,
  Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updateUserPassword, openAuthModal, session: authSession } = useAuth();
  const { showToast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check URL parameters and hash for Supabase error or recovery tokens
  useEffect(() => {
    // Check query params or hash for errors
    const errorParam = searchParams.get('error') || searchParams.get('error_code');
    const errorDesc = searchParams.get('error_description');

    // Also inspect hash fragment if Supabase redirected with #error=...
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    const hashError = hashParams.get('error') || hashParams.get('error_code');
    const hashErrorDesc = hashParams.get('error_description');

    if (errorParam || hashError) {
      const decodedError = decodeURIComponent(
        (errorDesc || hashErrorDesc || 'Password reset link has expired or is invalid.').replace(/\+/g, ' ')
      );
      setErrorMsg(decodedError);
      setVerifyingSession(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      setErrorMsg('Supabase backend credentials are not configured in your environment.');
      setVerifyingSession(false);
      return;
    }

    // Check if we already have an active session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setErrorMsg('Failed to verify recovery session. Please request a new link.');
      } else if (session) {
        setHasValidSession(true);
      }
      setVerifyingSession(false);
    });

    // Listen to Supabase auth events (especially PASSWORD_RECOVERY)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasValidSession(true);
        setErrorMsg(null);
      }
      setVerifyingSession(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter both fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await updateUserPassword(newPassword);
      if (res.error) {
        setErrorMsg(res.error);
        showToast('Password Reset Failed', res.error, 'error');
      } else {
        setSuccess(true);
        showToast('Password Updated', 'Your password has been successfully updated.', 'success');
      }
    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred while saving your password.';
      setErrorMsg(msg);
      showToast('Error', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/');
    setTimeout(() => {
      openAuthModal();
    }, 150);
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-12 bg-gradient-to-b from-[#fbfbf9] to-[#f0f4f1]">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 mb-4 shadow-sm">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {success ? 'Password Reset Complete' : 'Create New Password'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {success
              ? 'Your account password has been updated securely.'
              : 'Choose a strong password with at least 8 characters.'}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
          {verifyingSession ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
              <p className="text-sm text-gray-600">Verifying your secure password reset session...</p>
            </div>
          ) : success ? (
            /* Success State */
            <div className="text-center py-4 space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">All Set!</h3>
                <p className="text-sm text-gray-600">
                  Your password has been changed. You can now use your new password to sign in to Urban Scrap.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={handleGoToLogin}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-sm font-medium rounded-xl transition-colors"
                >
                  <Home className="w-4 h-4" />
                  <span>Go to Homepage</span>
                </button>
              </div>
            </div>
          ) : (
            /* Form State */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-sm animate-fadeIn">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Reset Issue</p>
                    <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Warning if session cannot be confirmed yet */}
              {!hasValidSession && !errorMsg && !authSession && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Please ensure you opened this page by clicking the link in your recovery email.
                  </span>
                </div>
              )}

              {/* New Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 8 characters"
                    required
                    minLength={8}
                    disabled={loading}
                    className="w-full pl-10 pr-11 py-2.5 bg-gray-50/50 hover:bg-white focus:bg-white border border-gray-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    minLength={8}
                    disabled={loading}
                    className={`w-full pl-10 pr-11 py-2.5 bg-gray-50/50 hover:bg-white focus:bg-white border rounded-xl text-sm transition-all outline-none ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20'
                        : 'border-gray-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Passwords do not match yet</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed active:scale-[0.99] mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving New Password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Return to Login link */}
              <div className="pt-2 text-center border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleGoToLogin}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition-colors inline-flex items-center gap-1.5"
                >
                  <span>← Return to Sign In</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
