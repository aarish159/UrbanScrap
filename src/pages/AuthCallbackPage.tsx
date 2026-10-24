import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, Home, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProfile, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      const hash = window.location.hash ? window.location.hash.substring(1) : '';
      const hashParams = new URLSearchParams(hash);

      // Check if callback was triggered for recovery/password reset
      const isRecovery =
        searchParams.get('type') === 'recovery' ||
        hashParams.get('type') === 'recovery' ||
        searchParams.get('next')?.includes('reset-password') ||
        sessionStorage.getItem('is_password_recovery') === 'true';

      // 1. Check for errors in query parameters or hash fragment
      const searchError = searchParams.get('error') || searchParams.get('error_code');
      const searchDesc = searchParams.get('error_description');
      const hashError = hashParams.get('error') || hashParams.get('error_code');
      const hashDesc = hashParams.get('error_description');

      if (
        isRecovery ||
        searchError === 'otp_expired' ||
        hashError === 'otp_expired' ||
        searchDesc?.toLowerCase().includes('recovery') ||
        hashDesc?.toLowerCase().includes('recovery')
      ) {
        navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
        return;
      }

      if (searchError || hashError) {
        const rawDesc = searchDesc || hashDesc || 'Authentication was cancelled or failed with provider.';
        const cleanDesc = decodeURIComponent(rawDesc.replace(/\+/g, ' '));
        if (isMounted) {
          setErrorMessage(cleanDesc);
          setStatus('error');
        }
        return;
      }

      if (!isSupabaseConfigured()) {
        if (isMounted) {
          setErrorMessage('Supabase is not configured. Please check your environment variables.');
          setStatus('error');
        }
        return;
      }

      try {
        // 2. Check for PKCE authorization code in query
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (isMounted) {
              setErrorMessage(exchangeError.message || 'Failed to exchange authorization code for session.');
              setStatus('error');
            }
            return;
          }
        }

        // 3. Check for implicit hash tokens (#access_token=...&refresh_token=...)
        const hash = window.location.hash ? window.location.hash.substring(1) : '';
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }

        // 4. Retrieve or verify active session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          if (isMounted) {
            setErrorMessage(sessionError.message || 'Unable to establish authenticated session.');
            setStatus('error');
          }
          return;
        }

        const activeSession = sessionData?.session;
        if (!activeSession) {
          // If detectSessionInUrl is still resolving the hash, wait briefly or listen to onAuthStateChange
          const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user && isMounted) {
              authListener.subscription.unsubscribe();
              completeSignIn();
            }
          });

          // Timeout after 8 seconds if no session is captured
          const timeoutId = setTimeout(() => {
            authListener.subscription.unsubscribe();
            if (isMounted && status === 'processing') {
              setErrorMessage('Authentication timed out. No active session was detected.');
              setStatus('error');
            }
          }, 8000);

          return () => clearTimeout(timeoutId);
        }

        if (isMounted) {
          await completeSignIn();
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'An unexpected error occurred during authentication.';
          setErrorMessage(msg);
          setStatus('error');
        }
      }
    }

    async function completeSignIn() {
      if (!isMounted) return;
      setStatus('success');

      try {
        await refreshProfile();
      } catch {
        // Fallback gracefully if profile sync is backgrounded
      }

      // Read saved target destination (e.g. /book or /dealer or /bookings)
      // Defaults to '/' (home page)
      const rawTarget =
        sessionStorage.getItem('auth_return_to') ||
        searchParams.get('next') ||
        '/';
      const targetReturn =
        rawTarget === '/auth/callback' || rawTarget === '/reset-password'
          ? '/'
          : rawTarget;

      sessionStorage.removeItem('auth_return_to');

      // Clean the address bar hash and query params
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      showToast('Welcome!', 'Signed in successfully with Google.', 'success');

      // Smooth visual transition before navigating to destination / home page
      setTimeout(() => {
        if (isMounted) {
          navigate(targetReturn, { replace: true });
        }
      }, 500);
    }

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [searchParams, navigate, refreshProfile, showToast, status]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#e6e8e5] p-8 shadow-xl text-center space-y-6">
        {status === 'processing' && (
          <div className="space-y-4">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-[#16a34a]/20 animate-ping" />
              <div className="w-16 h-16 rounded-full border-4 border-[#123b26] border-t-transparent animate-spin flex items-center justify-center bg-[#eaf8ef]/40">
                <Loader2 className="w-7 h-7 text-[#123b26] animate-spin" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[#123b26]">Authenticating with Google</h2>
              <p className="text-xs sm:text-sm text-[#717a75] leading-relaxed">
                Verifying your credentials and establishing a secure session...
              </p>
            </div>
            <div className="h-1.5 w-full bg-[#f1f3f1] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#16a34a] to-[#123b26] rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#eaf8ef] text-[#16a34a] mx-auto flex items-center justify-center border border-[#16a34a]/30 shadow-inner">
              <CheckCircle2 className="w-9 h-9 stroke-[2.4]" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[#123b26]">Authentication Successful</h2>
              <p className="text-xs sm:text-sm text-[#525955]">
                Redirecting you to your destination...
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5">
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center border border-rose-200">
              <AlertCircle className="w-9 h-9 stroke-[2.2]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#191c1a]">Sign In Notice</h2>
              <p className="text-xs sm:text-sm text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-100 text-left leading-relaxed">
                {errorMessage || 'Unable to complete sign-in. Please try again.'}
              </p>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigate('/', { replace: true });
                  setTimeout(() => openAuthModal(), 100);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#123b26] hover:bg-[#1a5336] text-white shadow-md transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Signing In Again</span>
              </button>
              <Link
                to="/"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#525955] hover:bg-[#f1f3f1] transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
