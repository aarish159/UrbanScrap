import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  User,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Sparkles,
  Store,
  Truck,
  ShieldAlert,
  Clock,
  Building2,
  ChevronRight,
  LogOut,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type {
  OpenAuthModalOptions,
  AuthRoleChoice,
} from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { supabase } from '../../lib/supabase';

export type AuthMode = 'login' | 'signup' | 'forgot_password' | 'verify_phone';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  options?: OpenAuthModalOptions | null;
}

interface AccessNotice {
  type: 'customer_attempted_dealer' | 'unverified_dealer';
  title: string;
  message: string;
  actionLabel: string;
  actionTo: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  options,
}) => {
  const navigate = useNavigate();
  const {
    isConfigured,
    user,
    signInWithEmail,
    signInWithPhone,
    signInWithGoogle,
    signUp,
    applyAsDealer,
    sendPhoneVerificationOtp,
    verifyPhoneOtp,
    sendPasswordResetCode,
    signOut,
    refreshProfile,
    refreshDealer,
  } = useAuth();
  const { showToast } = useToast();

  // Role choice state: null = choice screen; 'customer' or 'dealer' = specific form
  const [roleChoice, setRoleChoice] = useState<AuthRoleChoice>(
    options?.initialRole !== undefined ? options.initialRole : null
  );

  const [mode, setMode] = useState<AuthMode>(options?.initialMode || 'login');
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');

  // Customer form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Dealer specific registration fields
  const [businessName, setBusinessName] = useState('');
  const [serviceArea, setServiceArea] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [accessNotice, setAccessNotice] = useState<AccessNotice | null>(null);

  // Reset state on open or when options change
  useEffect(() => {
    if (isOpen) {
      const selectedRole = options?.initialRole !== undefined ? options.initialRole : null;
      setRoleChoice(selectedRole);
      // Admin accounts are strictly login-only; no public signup
      setMode(selectedRole === 'admin' ? 'login' : options?.initialMode || 'login');
      setLoginMethod('email');
      setFullName('');
      setEmail('');
      setPhoneNumber('');
      setPassword('');
      setConfirmPassword('');
      setBusinessName('');
      setServiceArea('');
      setOtpCode('');
      setShowPassword(false);
      setLoading(false);
      setGoogleLoading(false);
      setErrorMsg(null);
      setEmailVerificationSent(false);
      setResetEmailSent(false);
      setPhoneOtpSent(false);
      setAccessNotice(null);
    }
  }, [isOpen, options]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Sign In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      // Demo mode fallback handling
      if (!isConfigured) {
        handleDemoSignIn();
        return;
      }

      let authRes: {
        error?: string;
        user?: { id: string } | null;
        session?: { access_token: string } | null;
      } = {};

      if (loginMethod === 'email') {
        if (!email.trim() || !password) {
          setErrorMsg('Please enter both your email address and password.');
          setLoading(false);
          return;
        }
        authRes = await signInWithEmail(email, password);
      } else {
        if (cleanPhone.length !== 10) {
          setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
          setLoading(false);
          return;
        }
        if (!password) {
          setErrorMsg('Please enter your account password.');
          setLoading(false);
          return;
        }
        authRes = await signInWithPhone(cleanPhone, password);
      }

      if (authRes.error) {
        setErrorMsg(authRes.error);
        return;
      }

      // Successfully authenticated with Supabase Auth
      // Determine the active user ID directly from sign-in response or current session
      const currentUserId =
        authRes.user?.id || (await supabase.auth.getSession()).data.session?.user?.id;

      if (!currentUserId) {
        onClose();
        return;
      }

      // Fetch authoritative profile via refreshProfile or direct fallback query
      let profileData = await refreshProfile(currentUserId);
      if (!profileData) {
        const { data: directProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUserId)
          .maybeSingle();

        if (profileErr) {
          console.error('Error fetching profile after sign-in:', profileErr);
        }
        profileData = directProfile;
      }

      // If profile could not be loaded due to network/RLS issues, report the issue without assuming 'customer'
      if (!profileData) {
        setErrorMsg('Unable to retrieve account profile. Please check your network connection and try again.');
        return;
      }

      const actualRole = profileData.role;

      // Check if user chose "Admin"
      if (roleChoice === 'admin') {
        if (actualRole !== 'admin') {
          // Immediately revoke session so unauthorized user is not kept logged in through admin portal attempt
          await signOut();
          setErrorMsg(
            'You don’t have admin access. Only authorized Urban Scrap administrators can access this portal.'
          );
          return;
        }

        showToast('Admin Portal Unlocked', 'Administrative credentials verified.', 'success');
        onClose();
        navigate(options?.returnTo || '/admin');
        return;
      }

      // Check if user chose "Dealer"
      if (roleChoice === 'dealer') {
        // Selecting "Dealer" must NOT give dealer permissions.
        // Use user's actual role from profile.
        // If account is customer or unverified dealer, show clear message and DO NOT open Dealer Dashboard.
        if (actualRole === 'customer') {
          setAccessNotice({
            type: 'customer_attempted_dealer',
            title: 'Customer Account Detected',
            message:
              'You selected “Continue as Dealer”, but this account is registered as a Customer. Dealer access requires an authorized partner account and administrative verification. Customers cannot switch themselves to dealer permissions.',
            actionLabel: 'Go to My Bookings',
            actionTo: '/bookings',
          });
          return;
        }

        if (actualRole === 'dealer') {
          // Check verification in public.dealers
          const { data: dealerData } = await supabase
            .from('dealers')
            .select('*')
            .eq('user_id', currentUserId)
            .maybeSingle();

          await refreshDealer();

          if (!dealerData || !dealerData.is_verified) {
            const isRejected = dealerData?.verification_status === 'rejected';
            setAccessNotice({
              type: 'unverified_dealer',
              title: isRejected ? 'Dealer Verification Rejected' : 'Dealer Verification Pending',
              message: isRejected
                ? `Your dealer verification was rejected: ${dealerData?.rejection_reason || 'Requires update'}. Please submit corrected GST details.`
                : `Welcome, ${dealerData?.business_name || profileData?.full_name || 'Partner'}! Your dealer account is registered, but pending administrative GST review.`,
              actionLabel: isRejected ? 'Resubmit GST Details' : 'View GST Verification Status',
              actionTo: '/dealer/verify-gst',
            });
            return;
          }

          // Verified dealer!
          showToast(
            'Welcome, Partner!',
            `Signed in as ${dealerData.business_name}.`,
            'success'
          );
          onClose();
          navigate(options?.returnTo || '/dealer');
          return;
        }

        if (actualRole === 'admin') {
          showToast('Welcome, Admin', 'Administrative access verified.', 'success');
          onClose();
          navigate(options?.returnTo || '/dealer');
          return;
        }
      }

      // If user chose "Customer"
      showToast('Welcome back!', 'Successfully signed in to Urban Scrap.', 'success');
      onClose();

      // Navigate to intended target
      if (options?.returnTo) {
        if (options.returnTo === '/dealer' && actualRole === 'customer') {
          navigate('/bookings');
        } else {
          navigate(options.returnTo);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Demo sign in helper (for testing when Supabase is not configured)
  const handleDemoSignIn = (preset?: 'customer' | 'verified_dealer' | 'unverified_dealer' | 'admin') => {
    const target = preset || (roleChoice === 'admin' ? 'admin' : roleChoice === 'dealer' ? 'verified_dealer' : 'customer');

    if (roleChoice === 'admin' || target === 'admin') {
      showToast('Admin Portal (Demo)', 'Signed in with Administrator privileges.', 'success');
      onClose();
      navigate(options?.returnTo || '/admin');
      return;
    }

    if (roleChoice === 'dealer') {
      if (target === 'customer') {
        setAccessNotice({
          type: 'customer_attempted_dealer',
          title: 'Customer Account Detected',
          message:
            'You selected “Continue as Dealer”, but this account is registered as a Customer. Dealer access requires an authorized partner account and administrative verification. Customers cannot switch themselves to dealer permissions.',
          actionLabel: 'Go to My Bookings',
          actionTo: '/bookings',
        });
        return;
      }

      if (target === 'unverified_dealer') {
        setAccessNotice({
          type: 'unverified_dealer',
          title: 'Dealer Verification Pending',
          message:
            'Your dealer account is registered, but your merchant verification is currently pending administrative review. Once an Urban Scrap administrator approves your credentials, you will be granted access to the Dealer Dashboard.',
          actionLabel: 'Return to Home',
          actionTo: '/',
        });
        return;
      }

      // Verified dealer demo
      showToast('Demo Partner Active', 'Logged in as Demo Dealer Rajesh Metals.', 'success');
      onClose();
      navigate(options?.returnTo || '/dealer');
      return;
    }

    // Customer demo
    showToast('Demo Customer Active', 'Signed in as Customer.', 'success');
    onClose();
    if (options?.returnTo) {
      navigate(options.returnTo);
    }
  };

  // Sign Up Handler (Customer)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (fullName.trim().length < 2) {
      setErrorMsg('Full name must be at least 2 characters.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUp({
        email,
        password,
        fullName,
        phone: cleanPhone,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.emailConfirmationRequired) {
        setEmailVerificationSent(true);
      } else {
        showToast('Account Created!', 'Welcome to Urban Scrap.', 'success');
        onClose();
        if (options?.returnTo) {
          navigate(options.returnTo);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Dealer Partner Application Handler
  const handleDealerApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (fullName.trim().length < 2) {
      setErrorMsg('Full name must be at least 2 characters.');
      return;
    }

    if (!businessName.trim()) {
      setErrorMsg('Please enter your Scrap Merchant or Business Name.');
      return;
    }

    if (!serviceArea.trim()) {
      setErrorMsg('Please specify your operational service city or area.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid commercial email address.');
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await applyAsDealer({
        email,
        password,
        fullName,
        phone: cleanPhone,
        businessName,
        serviceArea,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.redirectToGst) {
        showToast(
          'Application Registered',
          'Please submit your GST verification credentials to activate collection route access.',
          'info'
        );
        onClose();
        navigate('/dealer/verify-gst');
      } else {
        setAccessNotice({
          type: 'unverified_dealer',
          title: 'Dealer Application Received',
          message: `Thank you for applying, ${businessName}! Your partner application is under administrative review. Please submit your GST details to complete registration.`,
          actionLabel: 'Submit GST Verification',
          actionTo: '/dealer/verify-gst',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Send Reset Email Link
  const handleSendResetEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendPasswordResetCode(email);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setResetEmailSent(true);
        showToast('Reset Link Sent', 'Please check your email for the password reset link.', 'success');
      }
    } finally {
      setLoading(false);
    }
  };

  // Phone OTP Flow: Send OTP
  const handleSendPhoneOtp = async () => {
    setErrorMsg(null);
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMsg('Enter a valid 10-digit mobile number to verify.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendPhoneVerificationOtp(cleanPhone);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setPhoneOtpSent(true);
        showToast('OTP Dispatched', `Verification code sent to +91 ${cleanPhone}.`, 'info');
      }
    } finally {
      setLoading(false);
    }
  };

  // Phone OTP Flow: Verify OTP
  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!otpCode.trim()) {
      setErrorMsg('Please enter the OTP code received via SMS.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyPhoneOtp(phoneNumber, otpCode);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        showToast('Phone Verified!', 'Your mobile number has been verified. You can now use it for login.', 'success');
        setMode('login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Handler
  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      const currentPath = window.location.pathname;
      const defaultReturn =
        currentPath && currentPath !== '/auth/callback' && currentPath !== '/reset-password'
          ? currentPath
          : '/';
      const targetReturn = roleChoice === 'dealer' ? '/dealer' : (options?.returnTo || defaultReturn);
      const res = await signInWithGoogle(targetReturn);
      if (res.error) {
        setErrorMsg(res.error);
        setGoogleLoading(false);
      } else if (!isConfigured) {
        showToast('Google Sign In (Demo)', 'Signed in as Alex Johnson via Google.', 'success');
        setGoogleLoading(false);
        onClose();
        if (targetReturn) {
          navigate(targetReturn);
        }
      }
      // With live Supabase, signInWithOAuth automatically initiates browser redirection to Google
    } catch {
      setErrorMsg('Failed to initialize Google Sign In. Please try again.');
      setGoogleLoading(false);
    }
  };

  // Google OAuth Button UI with clean divider
  const renderGoogleButton = (label = 'Continue with Google') => (
    <div className="space-y-3.5 mb-1">
      <button
        type="button"
        id="btn-google-auth"
        onClick={handleGoogleSignIn}
        disabled={loading || googleLoading}
        className="w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 sm:py-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-emerald-500/40 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.99] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
      >
        {googleLoading ? (
          <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{googleLoading ? 'Connecting to Google...' : label}</span>
      </button>

      <div className="relative flex items-center justify-center pt-0.5">
        <div className="border-t border-white/10 w-full" />
        <span className="bg-[#091610] px-3 text-[10px] sm:text-[11px] font-bold text-[#9cb1a4] tracking-wider uppercase shrink-0">
          or continue with {roleChoice === 'dealer' ? 'dealer email' : mode === 'login' ? 'credentials' : 'email'}
        </span>
        <div className="border-t border-white/10 w-full" />
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-3xl bg-[#091610]/95 backdrop-blur-2xl p-6 sm:p-8 text-left shadow-2xl shadow-black/80 transition-all border border-white/[0.12] text-white animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-white/10">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                {accessNotice
                  ? 'Access Notice'
                  : roleChoice === null
                  ? 'Access Portal'
                  : roleChoice === 'dealer'
                  ? 'Authorized Scrap Dealer'
                  : mode === 'login'
                  ? 'Customer Account'
                  : mode === 'signup'
                  ? 'Customer Registration'
                  : mode === 'verify_phone'
                  ? 'Mobile Verification'
                  : 'Account Recovery'}
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                {accessNotice
                  ? accessNotice.title
                  : roleChoice === null
                  ? 'How would you like to continue?'
                  : roleChoice === 'admin'
                  ? 'Admin Portal Sign In'
                  : roleChoice === 'dealer'
                  ? mode === 'signup'
                    ? 'Apply as Dealer Partner'
                    : 'Dealer Portal Sign In'
                  : mode === 'login'
                  ? 'Sign in to your account'
                  : mode === 'signup'
                  ? 'Create your account'
                  : mode === 'verify_phone'
                  ? 'Verify Phone Number'
                  : 'Reset your password'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-[#9cb1a4] hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors -mr-1"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Reason Banner if triggered by protected action */}
          {options?.reasonMessage && !accessNotice && roleChoice !== null && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{options.reasonMessage}</span>
            </div>
          )}

          {/* Backend Configuration Notice in demo mode */}
          {!isConfigured && (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-300">Demo / Testing Mode: </span>
                Supabase credentials are not configured in <code className="font-mono text-[11px] text-amber-300">.env</code>. You can test all customer, dealer, verification, and rejection flows using simulated actions.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* ACCESS DENIED / PENDING NOTIFICATION SCREEN (Requirement 4 & 5) */}
          {/* ============================================================== */}
          {accessNotice ? (
            <div className="py-6 text-center space-y-4">
              <div
                className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                  accessNotice.type === 'customer_attempted_dealer'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}
              >
                {accessNotice.type === 'customer_attempted_dealer' ? (
                  <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
                ) : (
                  <Clock className="w-8 h-8 stroke-[2.2]" />
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xl font-extrabold text-white">
                  {accessNotice.title}
                </h4>
                <p className="text-xs sm:text-sm text-[#9cb1a4] leading-relaxed max-w-sm mx-auto">
                  {accessNotice.message}
                </p>
              </div>

              <div className="pt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccessNotice(null);
                    onClose();
                    navigate(accessNotice.actionTo);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                >
                  <span>{accessNotice.actionLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {user && (
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                      setAccessNotice(null);
                      setRoleChoice(null);
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out Current Account</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setAccessNotice(null);
                    setRoleChoice(null);
                  }}
                  className="text-xs font-semibold text-[#9cb1a4] hover:text-white pt-1"
                >
                  ← Choose a different login option
                </button>
              </div>
            </div>
          ) : roleChoice === null ? (
            /* ============================================================== */
            /* CHOICE SCREEN: "Continue as Customer" vs "Continue as Dealer"   */
            /* (Requirement 1)                                                */
            /* ============================================================== */
            <div className="mt-5 space-y-3.5">
              <p className="text-xs text-[#9cb1a4] leading-relaxed">
                Please select your account type to proceed with the appropriate flow:
              </p>

              {/* Choice 1: Customer */}
              <button
                type="button"
                onClick={() => {
                  setRoleChoice('customer');
                  setMode('login');
                  setErrorMsg(null);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-500/30 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-150 group active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150">
                    <User className="w-6 h-6 stroke-[2.3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-base text-white group-hover:text-emerald-400 transition-colors">
                        Continue as Customer
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#9cb1a4] group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mt-0.5">
                      Household & Business Sellers
                    </span>
                    <p className="text-xs text-[#9cb1a4] mt-1.5 leading-relaxed">
                      Book free doorstep scrap pickups, check live market rates, and track digital payments.
                    </p>
                  </div>
                </div>
              </button>

              {/* Choice 2: Dealer */}
              <button
                type="button"
                onClick={() => {
                  setRoleChoice('dealer');
                  setMode('login');
                  setErrorMsg(null);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-white/15 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-150 group active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-white/10 text-emerald-400 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150">
                    <Store className="w-6 h-6 stroke-[2.3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-base text-white group-hover:text-emerald-400 transition-colors">
                        Continue as Dealer
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#9cb1a4] group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 mt-0.5">
                      Authorized Scrap Merchants
                    </span>
                    <p className="text-xs text-[#9cb1a4] mt-1.5 leading-relaxed">
                      For registered scrap dealers & EV pickup fleet partners managing assigned pickup orders.
                    </p>
                  </div>
                </div>
              </button>

              {/* Choice 3: Administrator (Login only - No public signups) */}
              <button
                type="button"
                onClick={() => {
                  setRoleChoice('admin');
                  setMode('login');
                  setErrorMsg(null);
                }}
                className="w-full text-left p-3.5 rounded-2xl border-2 border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/25 transition-all duration-150 group active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-white/10 text-amber-400 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150">
                    <ShieldCheck className="w-5 h-5 stroke-[2.3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-white">
                        Admin Portal
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-white/10 text-[#9cb1a4] border border-white/10 mt-0.5">
                      Staff & Reviewers Only
                    </span>
                    <p className="text-[11px] text-[#9cb1a4] mt-1 leading-relaxed">
                      Review dealer partner applications, inspect GST credentials, and manage operations.
                    </p>
                  </div>
                </div>
              </button>

              <div className="pt-2 text-center text-[11px] text-[#9cb1a4]">
                Scrap prices and the directory are publicly accessible without signing in.
              </div>
            </div>
          ) : emailVerificationSent ? (
            /* Email confirmation screen */
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#eaf8ef] text-[#16a34a] mx-auto flex items-center justify-center">
                <Mail className="w-8 h-8 stroke-[2.2]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-white">Check Your Inbox</h4>
                <p className="text-xs sm:text-sm text-[#9cb1a4] leading-relaxed max-w-sm mx-auto">
                  A verification link has been dispatched to <strong className="text-white">{email}</strong>.
                  Please confirm your email address before signing in.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmailVerificationSent(false);
                    setMode('login');
                  }}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-950/40 transition-colors"
                >
                  Proceed to Login
                </button>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* SPECIFIC ROLE FLOW: CUSTOMER OR DEALER                         */
            /* ============================================================== */
            <div className="mt-4">
              {/* Role Indicator & Switch Button */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs mb-4">
                <div className="flex items-center gap-1.5 text-white font-semibold">
                  {roleChoice === 'admin' ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Role: <strong>Administrator</strong></span>
                    </>
                  ) : roleChoice === 'dealer' ? (
                    <>
                      <Store className="w-4 h-4 text-emerald-400" />
                      <span>Role: <strong>Authorized Dealer</strong></span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 text-emerald-400" />
                      <span>Role: <strong>Customer</strong></span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRoleChoice(null);
                    setErrorMsg(null);
                  }}
                  className="text-xs font-bold text-emerald-400 hover:underline"
                >
                  Switch Role
                </button>
              </div>

              {/* DEALER SPECIFIC TABS */}
              {roleChoice === 'dealer' && (
                <div className="grid grid-cols-2 p-1 mb-4 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-bold text-[#9cb1a4]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      mode === 'login'
                        ? 'bg-emerald-500 text-[#07130c] font-black shadow-md'
                        : 'hover:text-white'
                    }`}
                  >
                    Partner Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      mode === 'signup'
                        ? 'bg-emerald-500 text-[#07130c] font-black shadow-md'
                        : 'hover:text-white'
                    }`}
                  >
                    Apply for Dealer
                  </button>
                </div>
              )}

              {/* ========================================================== */}
              {/* DEALER APPLICATION FORM (New applicants remain pending)    */}
              {/* ========================================================== */}
              {roleChoice === 'dealer' && mode === 'signup' ? (
                <form onSubmit={handleDealerApplication} className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
                    <strong>Partner Notice: </strong>
                    All new dealer accounts require administrative verification. Your account status will remain pending until approved by Urban Scrap.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Contact Person Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh Kumar"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Scrap Merchant / Yard Business Name <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/40" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. GreenEarth Recyclers Pvt Ltd"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        Operational Area / City <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Indiranagar, Bengaluru"
                        value={serviceArea}
                        onChange={(e) => setServiceArea(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        Phone (10 digits) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        placeholder="9876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Business Email Address <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="merchant@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Create Password (8+ chars) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-[#07130c] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Truck className="w-4 h-4" />
                        <span>Submit Dealer Application</span>
                      </>
                    )}
                  </button>
                </form>
              ) : mode === 'login' ? (
                /* ========================================================== */
                /* LOGIN FORM (Customer, Dealer, or Admin)                    */
                /* ========================================================== */
                <form onSubmit={handleSignIn} className="space-y-4">
                  {/* Google OAuth Button - Available for Customer & Dealer */}
                  {roleChoice !== 'admin' && renderGoogleButton(roleChoice === 'dealer' ? 'Sign in with Google' : 'Continue with Google')}

                  {/* Admin Information Notice */}
                  {roleChoice === 'admin' && (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-[#9cb1a4] leading-relaxed flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white">Administrator Portal: </span>
                        Sign in with your configured Urban Scrap account credentials. Administrator privileges must be assigned through database authorization policies.
                      </div>
                    </div>
                  )}

                  {/* Method Toggle: Email vs Phone */}
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-bold text-[#9cb1a4]">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod('email');
                        setErrorMsg(null);
                      }}
                      className={`py-2 rounded-lg transition-all ${
                        loginMethod === 'email'
                          ? 'bg-emerald-500 text-[#07130c] font-black shadow-md'
                          : 'hover:text-white'
                      }`}
                    >
                      Email + Password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod('phone');
                        setErrorMsg(null);
                      }}
                      className={`py-2 rounded-lg transition-all ${
                        loginMethod === 'phone'
                          ? 'bg-emerald-500 text-[#07130c] font-black shadow-md'
                          : 'hover:text-white'
                      }`}
                    >
                      Phone + Password
                    </button>
                  </div>

                  {loginMethod === 'email' ? (
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        {roleChoice === 'admin'
                          ? 'Administrator Email'
                          : roleChoice === 'dealer'
                          ? 'Registered Dealer Email'
                          : 'Email Address'}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/40" />
                        <input
                          type="email"
                          required
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        {roleChoice === 'admin'
                          ? 'Administrator Mobile Number'
                          : 'Verified Mobile Number'}
                      </label>
                      <div className="relative flex">
                        <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-white/10 bg-white/[0.06] text-xs font-bold text-emerald-300">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          required
                          placeholder="9876543210"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-3.5 py-2.5 text-sm rounded-r-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                        />
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-white">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot_password');
                          setErrorMsg(null);
                        }}
                        className="text-xs font-semibold text-emerald-400 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/40" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Enter account password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9cb1a4] hover:text-white"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-[#07130c] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>
                          {roleChoice === 'admin'
                            ? 'Sign In as Administrator'
                            : roleChoice === 'dealer'
                            ? 'Sign In as Dealer'
                            : 'Sign In'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Demo test helper in demo mode */}
                  {!isConfigured && (roleChoice === 'dealer' || roleChoice === 'admin') && (
                    <div className="pt-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-[#9cb1a4] space-y-1.5">
                      <div className="font-bold text-[11px] text-white">Demo Testing Shortcuts:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {roleChoice === 'admin' ? (
                          <button
                            type="button"
                            onClick={() => handleDemoSignIn('admin')}
                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-amber-300 rounded font-semibold text-[11px] border border-white/10"
                          >
                            Sign in as Demo Administrator
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDemoSignIn('verified_dealer')}
                              className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded font-semibold text-[11px] border border-emerald-500/30"
                            >
                              Simulate Verified Dealer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDemoSignIn('customer')}
                              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded font-semibold text-[11px] border border-rose-500/30"
                            >
                              Simulate Customer Block
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDemoSignIn('unverified_dealer')}
                              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-semibold text-[11px] border border-amber-500/30"
                            >
                              Simulate Pending Dealer
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Switch to Sign Up for Customer */}
                  {roleChoice === 'customer' && (
                    <div className="pt-3 border-t border-white/10 text-center text-xs text-[#9cb1a4]">
                      Don't have an Urban Scrap customer account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup');
                          setErrorMsg(null);
                        }}
                        className="font-bold text-emerald-400 hover:underline"
                      >
                        Create one now
                      </button>
                    </div>
                  )}

                  {/* Administrator notice: public signup strictly disabled */}
                  {roleChoice === 'admin' && (
                    <div className="pt-3 border-t border-white/10 text-center text-[11px] text-[#9cb1a4] leading-relaxed">
                      Public registration is disabled. Admin accounts are provisioned directly in the database.
                    </div>
                  )}
                </form>
              ) : mode === 'signup' ? (
                /* ========================================================== */
                /* CUSTOMER SIGN UP FORM                                      */
                /* ========================================================== */
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Google OAuth Button */}
                  {renderGoogleButton('Sign up with Google')}

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/40" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Kumar"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Email Address <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/40" />
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Mobile Number (10 digits) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative flex">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-white/10 bg-white/[0.06] text-xs font-bold text-emerald-300">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        placeholder="9876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-2.5 text-sm rounded-r-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        Password (8+ chars) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        Confirm Password <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-[#07130c] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Create Customer Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="pt-3 border-t border-white/10 text-center text-xs text-[#9cb1a4]">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg(null);
                      }}
                      className="font-bold text-emerald-400 hover:underline"
                    >
                      Sign in here
                    </button>
                  </div>
                </form>
              ) : mode === 'verify_phone' ? (
                /* Phone Verification */
                <div className="space-y-4">
                  {!phoneOtpSent ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          10-Digit Mobile Number
                        </label>
                        <div className="relative flex">
                          <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-white/10 bg-white/[0.06] text-xs font-bold text-emerald-300">
                            +91
                          </span>
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="9876543210"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3.5 py-2.5 text-sm rounded-r-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendPhoneOtp}
                        disabled={loading || phoneNumber.replace(/\D/g, '').length !== 10}
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <span className="w-4 h-4 border-2 border-[#07130c] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Phone className="w-4 h-4" />
                            <span>Send SMS Verification Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          Enter 6-Digit SMS Code sent to +91 {phoneNumber}
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          required
                          placeholder="123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-4 py-3 text-center tracking-widest text-lg font-mono font-bold rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || otpCode.length < 6}
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <span className="w-4 h-4 border-2 border-[#07130c] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Verify Mobile Code</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  <div className="pt-2 text-center text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg(null);
                      }}
                      className="font-semibold text-[#9cb1a4] hover:text-white flex items-center justify-center gap-1 mx-auto"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Return to Login</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Forgot Password */
                <div className="space-y-4">
                  {!resetEmailSent ? (
                    <form onSubmit={handleSendResetEmail} className="space-y-4">
                      <p className="text-xs text-[#9cb1a4] leading-relaxed">
                        Enter your registered email address and we'll send you a secure link to reset your password.
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/40" />
                          <input
                            type="email"
                            required
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <span className="w-4 h-4 border-2 border-[#07130c] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <KeyRound className="w-4 h-4" />
                            <span>Send Reset Link</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <div className="py-4 text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/25">
                        <Mail className="w-8 h-8 stroke-[2.2]" />
                      </div>

                      <div className="space-y-1.5">
                        <h4 className="text-xl font-bold text-white">Check Your Email</h4>
                        <p className="text-xs sm:text-sm text-[#9cb1a4] leading-relaxed max-w-sm mx-auto">
                          We've sent a password reset link to <strong className="text-white">{email}</strong>.
                          Click the link in your email to open the reset page and create your new password.
                        </p>
                      </div>

                      <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl text-left text-xs text-[#9cb1a4] space-y-1">
                        <p className="font-semibold text-white">Didn't receive the email?</p>
                        <p>Check your Spam or Junk folder, or click below to request another link.</p>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                        <button
                          type="button"
                          onClick={() => handleSendResetEmail()}
                          disabled={loading}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold border border-white/10 text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                          Resend Link
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetEmailSent(false);
                            setMode('login');
                          }}
                          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 text-[#07130c] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                          Return to Sign In
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 text-center text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg(null);
                      }}
                      className="font-semibold text-[#9cb1a4] hover:text-white flex items-center justify-center gap-1 mx-auto"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Return to Login</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
