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
      setRoleChoice(
        options?.initialRole !== undefined ? options.initialRole : null
      );
      setMode(options?.initialMode || 'login');
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

      let authRes: { error?: string } = {};

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
      // Now inspect actual profile role to prevent role spoofing
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      if (!currentUserId) {
        onClose();
        return;
      }

      // Fetch actual profile from public.profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUserId)
        .maybeSingle();

      const actualRole = profileData?.role || 'customer';
      await refreshProfile();

      // Check if user chose "Dealer"
      if (roleChoice === 'dealer') {
        // Requirement 4 & 5:
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
            setAccessNotice({
              type: 'unverified_dealer',
              title: 'Dealer Verification Pending',
              message: `Welcome, ${dealerData?.business_name || profileData?.full_name || 'Partner'}! Your dealer account is registered, but pending administrative review. Once verified by an Urban Scrap administrator, you will receive full access to the Dealer Dashboard.`,
              actionLabel: 'Return to Home',
              actionTo: '/',
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
  const handleDemoSignIn = (preset?: 'customer' | 'verified_dealer' | 'unverified_dealer') => {
    const target = preset || (roleChoice === 'dealer' ? 'verified_dealer' : 'customer');

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
      } else {
        setAccessNotice({
          type: 'unverified_dealer',
          title: 'Dealer Application Received',
          message: `Thank you for applying, ${businessName}! Your partner application is under administrative review. Once verified by an Urban Scrap admin, your Dealer Dashboard and collection route access will be activated.`,
          actionLabel: 'Return to Home',
          actionTo: '/',
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
      const targetReturn = roleChoice === 'dealer' ? '/dealer' : (options?.returnTo || '/');
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
        className="w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 sm:py-3 rounded-xl border border-[#d1d5db] bg-white hover:bg-[#f8faf9] hover:border-[#9ca3af] text-sm font-semibold text-[#191c1a] shadow-2xs transition-all active:scale-[0.99] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#16a34a] cursor-pointer"
      >
        {googleLoading ? (
          <span className="w-4 h-4 border-2 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
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
        <div className="border-t border-[#e6e8e5] w-full" />
        <span className="bg-white px-3 text-[10px] sm:text-[11px] font-bold text-[#717a75] tracking-wider uppercase shrink-0">
          or continue with {roleChoice === 'dealer' ? 'dealer email' : mode === 'login' ? 'credentials' : 'email'}
        </span>
        <div className="border-t border-[#e6e8e5] w-full" />
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0a2417]/65 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-6 sm:p-8 text-left shadow-2xl transition-all border border-[#e6e8e5] animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-[#f1f3f1]">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#16a34a] block">
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
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#123b26] mt-0.5">
                {accessNotice
                  ? accessNotice.title
                  : roleChoice === null
                  ? 'How would you like to continue?'
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
              className="rounded-xl p-1.5 text-[#717a75] hover:bg-[#f1f3f1] hover:text-[#191c1a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] transition-colors -mr-1"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Reason Banner if triggered by protected action */}
          {options?.reasonMessage && !accessNotice && roleChoice !== null && (
            <div className="mt-4 p-3 rounded-xl bg-[#eaf8ef] border border-[#bbf7d0] text-xs text-[#123b26] flex items-center gap-2">
              <Info className="w-4 h-4 text-[#16a34a] shrink-0" />
              <span>{options.reasonMessage}</span>
            </div>
          )}

          {/* Backend Configuration Notice in demo mode */}
          {!isConfigured && (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">Demo / Testing Mode: </span>
                Supabase credentials are not configured in <code className="font-mono text-[11px]">.env</code>. You can test all customer, dealer, verification, and rejection flows using simulated actions.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
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
                <h4 className="text-xl font-extrabold text-[#123b26]">
                  {accessNotice.title}
                </h4>
                <p className="text-xs sm:text-sm text-[#525955] leading-relaxed max-w-sm mx-auto">
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
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#123b26] hover:bg-[#1a5336] text-white shadow-md transition-all active:scale-[0.98]"
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
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
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
                  className="text-xs font-semibold text-[#717a75] hover:text-[#191c1a] pt-1"
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
              <p className="text-xs text-[#525955] leading-relaxed">
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
                className="w-full text-left p-4 rounded-2xl border-2 border-[#16a34a]/30 bg-gradient-to-br from-[#f7fcf9] to-white hover:border-[#16a34a] hover:shadow-md hover:shadow-[#16a34a]/10 transition-all duration-150 group active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#eaf8ef] text-[#16a34a] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150">
                    <User className="w-6 h-6 stroke-[2.3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-base text-[#123b26] group-hover:text-[#16a34a] transition-colors">
                        Continue as Customer
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#717a75] group-hover:text-[#16a34a] group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#eaf8ef] text-[#123b26] mt-0.5">
                      Household & Business Sellers
                    </span>
                    <p className="text-xs text-[#525955] mt-1.5 leading-relaxed">
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
                className="w-full text-left p-4 rounded-2xl border-2 border-[#123b26]/20 bg-gradient-to-br from-[#f8faf9] to-white hover:border-[#123b26] hover:shadow-md hover:shadow-[#123b26]/10 transition-all duration-150 group active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#123b26]"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#123b26] text-[#4ade80] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150">
                    <Store className="w-6 h-6 stroke-[2.3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-base text-[#123b26]">
                        Continue as Dealer
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#717a75] group-hover:text-[#123b26] group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-200 mt-0.5">
                      Authorized Scrap Merchants
                    </span>
                    <p className="text-xs text-[#525955] mt-1.5 leading-relaxed">
                      For registered scrap dealers & EV pickup fleet partners managing assigned pickup orders.
                    </p>
                  </div>
                </div>
              </button>

              <div className="pt-2 text-center text-[11px] text-[#717a75]">
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
                <h4 className="text-xl font-bold text-[#123b26]">Check Your Inbox</h4>
                <p className="text-xs sm:text-sm text-[#525955] leading-relaxed max-w-sm mx-auto">
                  A verification link has been dispatched to <strong className="text-[#191c1a]">{email}</strong>.
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
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[#123b26] text-white hover:bg-[#1a5336]"
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
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f4f6f4] border border-[#e5e8e5] text-xs mb-4">
                <div className="flex items-center gap-1.5 text-[#123b26] font-semibold">
                  {roleChoice === 'dealer' ? (
                    <>
                      <Store className="w-4 h-4 text-[#123b26]" />
                      <span>Role: <strong>Authorized Dealer</strong></span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 text-[#16a34a]" />
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
                  className="text-xs font-bold text-[#16a34a] hover:underline"
                >
                  Switch Role
                </button>
              </div>

              {/* DEALER SPECIFIC TABS */}
              {roleChoice === 'dealer' && (
                <div className="grid grid-cols-2 p-1 mb-4 rounded-xl bg-[#f1f3f1] text-xs font-bold text-[#525955]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      mode === 'login'
                        ? 'bg-white text-[#123b26] shadow-2xs'
                        : 'hover:text-[#191c1a]'
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
                        ? 'bg-white text-[#123b26] shadow-2xs'
                        : 'hover:text-[#191c1a]'
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
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    <strong>Partner Notice: </strong>
                    All new dealer accounts require administrative verification. Your account status will remain pending until approved by Urban Scrap.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#191c1a] mb-1">
                      Contact Person Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh Kumar"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#123b26]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#191c1a] mb-1">
                      Scrap Merchant / Yard Business Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. GreenEarth Recyclers Pvt Ltd"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#123b26]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#191c1a] mb-1">
                        Operational Area / City <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Indiranagar, Bengaluru"
                        value={serviceArea}
                        onChange={(e) => setServiceArea(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#123b26]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#191c1a] mb-1">
                        Phone (10 digits) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        placeholder="9876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#123b26]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#191c1a] mb-1">
                      Business Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="merchant@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#123b26]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#191c1a] mb-1">
                      Create Password (8+ chars) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#123b26]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#123b26] hover:bg-[#1a5336] text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                /* LOGIN FORM (Customer or Dealer)                            */
                /* ========================================================== */
                <form onSubmit={handleSignIn} className="space-y-4">
                  {/* Google OAuth Button */}
                  {renderGoogleButton(roleChoice === 'dealer' ? 'Sign in with Google' : 'Continue with Google')}

                  {/* Method Toggle: Email vs Phone */}
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-[#f1f3f1] text-xs font-bold text-[#525955]">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod('email');
                        setErrorMsg(null);
                      }}
                      className={`py-2 rounded-lg transition-all ${
                        loginMethod === 'email'
                          ? 'bg-white text-[#123b26] shadow-2xs'
                          : 'hover:text-[#191c1a]'
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
                          ? 'bg-white text-[#123b26] shadow-2xs'
                          : 'hover:text-[#191c1a]'
                      }`}
                    >
                      Phone + Password
                    </button>
                  </div>

                  {loginMethod === 'email' ? (
                    <div>
                      <label className="block text-xs font-bold text-[#191c1a] mb-1">
                        {roleChoice === 'dealer' ? 'Registered Dealer Email' : 'Email Address'}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                        <input
                          type="email"
                          required
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-[#191c1a]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-[#191c1a] mb-1">
                        Verified Mobile Number
                      </label>
                      <div className="relative flex">
                        <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[#d1d5db] bg-[#f8faf9] text-xs font-bold text-[#525955]">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          required
                          placeholder="9876543210"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-3.5 py-2.5 text-sm rounded-r-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-[#191c1a]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-[#191c1a]">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot_password');
                          setErrorMsg(null);
                        }}
                        className="text-xs font-semibold text-[#16a34a] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Enter account password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-[#191c1a]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717a75] hover:text-[#191c1a]"
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
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50 ${
                      roleChoice === 'dealer'
                        ? 'bg-[#123b26] hover:bg-[#1a5336] shadow-[#123b26]/20'
                        : 'bg-gradient-to-r from-[#16a34a] to-[#123b26] hover:from-[#15803d] hover:to-[#0a2417] shadow-[#16a34a]/20'
                    }`}
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{roleChoice === 'dealer' ? 'Sign In as Dealer' : 'Sign In'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Demo test helper in demo mode */}
                  {!isConfigured && roleChoice === 'dealer' && (
                    <div className="pt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
                      <div className="font-bold text-[11px] text-slate-900">Demo Testing Shortcuts:</div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDemoSignIn('verified_dealer')}
                          className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded font-semibold text-[11px]"
                        >
                          Simulate Verified Dealer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDemoSignIn('customer')}
                          className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-semibold text-[11px]"
                        >
                          Simulate Customer Block
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDemoSignIn('unverified_dealer')}
                          className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-semibold text-[11px]"
                        >
                          Simulate Pending Dealer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Switch to Sign Up for Customer */}
                  {roleChoice === 'customer' && (
                    <div className="pt-3 border-t border-[#f1f3f1] text-center text-xs text-[#525955]">
                      Don't have an Urban Scrap customer account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup');
                          setErrorMsg(null);
                        }}
                        className="font-bold text-[#123b26] hover:underline"
                      >
                        Create one now
                      </button>
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
                    <label className="block text-xs font-bold text-[#191c1a] mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Kumar"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#191c1a] mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#191c1a] mb-1">
                      Mobile Number (10 digits) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[#d1d5db] bg-[#f8faf9] text-xs font-bold text-[#525955]">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        placeholder="9876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-2.5 text-sm rounded-r-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#191c1a] mb-1">
                        Password (8+ chars) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#191c1a] mb-1">
                        Confirm Password <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-[#16a34a] to-[#123b26] hover:from-[#15803d] hover:to-[#0a2417] text-white shadow-md shadow-[#16a34a]/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Create Customer Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="pt-3 border-t border-[#f1f3f1] text-center text-xs text-[#525955]">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg(null);
                      }}
                      className="font-bold text-[#123b26] hover:underline"
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
                        <label className="block text-xs font-bold text-[#191c1a] mb-1">
                          10-Digit Mobile Number
                        </label>
                        <div className="relative flex">
                          <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[#d1d5db] bg-[#f8faf9] text-xs font-bold text-[#525955]">
                            +91
                          </span>
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="9876543210"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3.5 py-2.5 text-sm rounded-r-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendPhoneOtp}
                        disabled={loading || phoneNumber.replace(/\D/g, '').length !== 10}
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#123b26] hover:bg-[#1a5336] text-white shadow-md transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                        <label className="block text-xs font-bold text-[#191c1a] mb-1">
                          Enter 6-Digit SMS Code sent to +91 {phoneNumber}
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          required
                          placeholder="123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-4 py-3 text-center tracking-widest text-lg font-mono font-bold rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || otpCode.length < 6}
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                      className="font-semibold text-[#717a75] hover:text-[#191c1a] flex items-center justify-center gap-1 mx-auto"
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
                      <p className="text-xs text-[#525955] leading-relaxed">
                        Enter your registered email address and we'll send you a secure link to reset your password.
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-[#191c1a] mb-1">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                          <input
                            type="email"
                            required
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#123b26] hover:bg-[#1a5336] text-white shadow-md transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                      <div className="w-16 h-16 rounded-2xl bg-[#eaf8ef] text-[#16a34a] mx-auto flex items-center justify-center shadow-inner">
                        <Mail className="w-8 h-8 stroke-[2.2]" />
                      </div>

                      <div className="space-y-1.5">
                        <h4 className="text-xl font-bold text-[#123b26]">Check Your Email</h4>
                        <p className="text-xs sm:text-sm text-[#525955] leading-relaxed max-w-sm mx-auto">
                          We've sent a password reset link to <strong className="text-[#191c1a]">{email}</strong>.
                          Click the link in your email to open the reset page and create your new password.
                        </p>
                      </div>

                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-left text-xs text-[#525955] space-y-1">
                        <p className="font-semibold text-gray-700">Didn't receive the email?</p>
                        <p>Check your Spam or Junk folder, or click below to request another link.</p>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                        <button
                          type="button"
                          onClick={() => handleSendResetEmail()}
                          disabled={loading}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[#d1d5db] text-[#123b26] hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          Resend Link
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetEmailSent(false);
                            setMode('login');
                          }}
                          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#123b26] text-white hover:bg-[#1a5336] transition-colors"
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
                      className="font-semibold text-[#717a75] hover:text-[#191c1a] flex items-center justify-center gap-1 mx-auto"
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
