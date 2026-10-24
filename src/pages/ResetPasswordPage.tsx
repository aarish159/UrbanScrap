import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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
  Home,
  Mail,
  RefreshCw,
  Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updateUserPassword, sendPasswordResetCode, openAuthModal } = useAuth();
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

  // Re-request link state (for expired or invalid links)
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Initialize and validate the recovery session/token from URL
  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function validateRecoveryFlow() {
      // 1. Inspect query parameters & hash fragment for Supabase errors
      const search = window.location.search;
      const hash = window.location.hash.replace(/^#/, '');
      const queryParams = new URLSearchParams(search);
      const hashParams = new URLSearchParams(hash);

      const errorCode = queryParams.get('error_code') || hashParams.get('error_code');
      const errorDesc =
        queryParams.get('error_description') ||
        hashParams.get('error_description') ||
        queryParams.get('error') ||
        hashParams.get('error');

      if (errorCode || errorDesc) {
        let message = 'Your password reset link is invalid or has expired.';
        if (errorCode === 'otp_expired' || (errorDesc && errorDesc.toLowerCase().includes('expired'))) {
          message = 'This password reset link has expired or has already been used. Please request a fresh reset link below.';
        } else if (errorDesc) {
          message = decodeURIComponent(errorDesc.replace(/\+/g, ' '));
        }
        if (isMounted) {
          setErrorMsg(message);
          setVerifyingSession(false);
        }
        return;
      }

      if (!isSupabaseConfigured()) {
        if (isMounted) {
          setErrorMsg('Supabase backend credentials are not configured in your environment.');
          setVerifyingSession(false);
        }
        return;
      }

      // 2. Check for PKCE Authorization Code (?code=...)
      const code = queryParams.get('code');
      if (code) {
        try {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (isMounted) {
              setErrorMsg('This password reset link has expired or is invalid. Please request a new link below.');
              setVerifyingSession(false);
            }
            return;
          }
          if (exchangeData.session && isMounted) {
            setHasValidSession(true);
            setErrorMsg(null);
            setVerifyingSession(false);
            return;
          }
        } catch {
          if (isMounted) {
            setErrorMsg('Failed to validate password recovery code. Please request a new reset link.');
            setVerifyingSession(false);
          }
          return;
        }
      }

      // 3. Check for implicit grant hash tokens (#access_token=...&refresh_token=...)
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        try {
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!sessionErr && sessionData.session && isMounted) {
            setHasValidSession(true);
            setErrorMsg(null);
            setVerifyingSession(false);
            return;
          }
        } catch {
          // Fall through to active session check
        }
      }

      // 4. Check existing active session from Supabase client
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          setHasValidSession(true);
          setErrorMsg(null);
          setVerifyingSession(false);
          return;
        }
      } catch {
        // Fall through
      }

      // 5. Listen to auth state transitions (PASSWORD_RECOVERY event)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
          setHasValidSession(true);
          setErrorMsg(null);
          setVerifyingSession(false);
        }
      });

      // 6. Grace period for Supabase's detectSessionInUrl to finish parsing
      timer = setTimeout(async () => {
        if (!isMounted) return;
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        if (finalSession) {
          setHasValidSession(true);
          setErrorMsg(null);
        } else if (!hasValidSession) {
          setErrorMsg('No active password reset session was found. Your link may have expired or was opened in another tab.');
        }
        setVerifyingSession(false);
      }, 2000);

      return () => {
        subscription.unsubscribe();
        if (timer) clearTimeout(timer);
      };
    }

    validateRecoveryFlow();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [searchParams]);

  // Form submission: Save new password using Supabase updateUser
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

    // Double check active session
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession && !hasValidSession) {
      setErrorMsg('Your password reset session has expired. Please request a fresh reset link below.');
      setHasValidSession(false);
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
        // Clean address bar safely without exposing tokens
        if (window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        sessionStorage.removeItem('is_password_recovery');
        showToast('Password Updated', 'Your password has been changed successfully.', 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred while saving your password.';
      setErrorMsg(msg);
      showToast('Error', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Re-request password reset link handler
  const handleResendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      showToast('Email Required', 'Please enter your registered email address.', 'error');
      return;
    }

    setResendLoading(true);
    try {
      const res = await sendPasswordResetCode(resendEmail.trim().toLowerCase());
      if (res.error) {
        showToast('Reset Failed', res.error, 'error');
      } else {
        setResendSuccess(true);
        showToast('Link Dispatched', 'A fresh password reset link has been sent to your email.', 'success');
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoToLogin = useCallback(() => {
    navigate('/');
    setTimeout(() => {
      openAuthModal({ initialMode: 'login', initialRole: 'customer' });
    }, 150);
  }, [navigate, openAuthModal]);

  const passwordLengthValid = newPassword.length >= 8;
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

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
            /* Verifying Session Loader */
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
              <p className="text-sm font-medium text-gray-700">Verifying secure password recovery session...</p>
              <p className="text-xs text-gray-500">Checking authorization token with Supabase...</p>
            </div>
          ) : success ? (
            /* Success State */
            <div className="text-center py-4 space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Password Changed!</h3>
                <p className="text-sm text-gray-600">
                  Your password has been changed. You can now use your new password to sign in to Urban Scrap.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={handleGoToLogin}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#123b26] hover:bg-[#1a5336] text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
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
          ) : hasValidSession ? (
            /* Form State: Valid Session Ready for New Password */
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

              {/* Verified Session Notice */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  Recovery session verified. Please enter and confirm your new account password below.
                </span>
              </div>

              {/* New Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  New Password <span className="text-rose-500">*</span>
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
                  Confirm Password <span className="text-rose-500">*</span>
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
                      confirmPassword && !passwordsMatch
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

                {confirmPassword && !passwordsMatch && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Passwords do not match yet</span>
                  </p>
                )}
              </div>

              {/* Real-time Checklist */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    passwordLengthValid ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {passwordLengthValid ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : '•'}
                  </div>
                  <span className={passwordLengthValid ? 'text-emerald-900 font-medium' : ''}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    passwordsMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {passwordsMatch ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : '•'}
                  </div>
                  <span className={passwordsMatch ? 'text-emerald-900 font-medium' : ''}>
                    Both passwords match
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !passwordLengthValid || !passwordsMatch}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#123b26] hover:bg-[#1a5336] disabled:bg-gray-300 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed active:scale-[0.99] mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving New Password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset & Update Password</span>
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
          ) : (
            /* Expired / Invalid Link State: Offer In-Place Resend */
            <div className="space-y-5">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-800">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>Invalid or Expired Link</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  {errorMsg || 'Your password reset link is invalid or has expired. Supabase security tokens expire shortly after dispatch or once used.'}
                </p>
              </div>

              {!resendSuccess ? (
                <form onSubmit={handleResendResetLink} className="space-y-4 pt-1">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Request a Fresh Reset Link</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Enter your account email and we'll dispatch a new link immediately:
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Account Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resendLoading || !resendEmail.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#123b26] hover:bg-[#1a5336] disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow transition-all active:scale-[0.99]"
                  >
                    {resendLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Link...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Send New Password Reset Link</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-emerald-900">Check Your Inbox</h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    A fresh password reset link has been dispatched to <strong>{resendEmail}</strong>. Please check your inbox and click the new link.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <button
                  type="button"
                  onClick={handleGoToLogin}
                  className="font-semibold text-emerald-800 hover:underline"
                >
                  Return to Sign In
                </button>
                <Link to="/" className="hover:text-gray-900">
                  Homepage
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
