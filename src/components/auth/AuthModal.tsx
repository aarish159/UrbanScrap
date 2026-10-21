import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  User,
  Store,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building,
  CheckCircle2,
  Info,
  KeyRound,
} from 'lucide-react';
import { useToast } from '../ui/Toast';

export type AuthRole = 'customer' | 'merchant';
export type AuthMode = 'login' | 'signup';
export type AuthStep = 'role_select' | 'auth_form' | 'forgot_password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: AuthRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialRole,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState<AuthStep>('role_select');
  const [role, setRole] = useState<AuthRole>('customer');
  const [mode, setMode] = useState<AuthMode>('login');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission feedback placeholder
  const [submittedNotice, setSubmittedNotice] = useState<{
    title: string;
    message: string;
    role: AuthRole;
    mode: AuthMode;
    redirectPath: string;
    redirectLabel: string;
  } | null>(null);

  // Reset or initialize state on open
  useEffect(() => {
    if (isOpen) {
      if (initialRole) {
        setRole(initialRole);
        setStep('auth_form');
      } else {
        setStep('role_select');
      }
      setMode('login');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setBusinessName('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setErrors({});
      setSubmittedNotice(null);
    }
  }, [isOpen, initialRole]);

  // Handle Escape key and prevent background scroll
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

  const handleSelectRole = (selectedRole: AuthRole) => {
    setRole(selectedRole);
    setStep('auth_form');
    setMode('login');
    setErrors({});
    setSubmittedNotice(null);
  };

  const handleBackToRoleSelect = () => {
    setStep('role_select');
    setErrors({});
    setSubmittedNotice(null);
  };

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // Validate email
    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!validateEmail(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    // Validate password
    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        newErrors.fullName =
          role === 'merchant'
            ? 'Contact representative name is required.'
            : 'Full name is required.';
      }

      if (role === 'merchant' && !businessName.trim()) {
        newErrors.businessName = 'Business or scrap shop name is required.';
      }

      if (!confirmPassword) {
        newErrors.confirmPassword = 'Confirm your password.';
      } else if (confirmPassword !== password) {
        newErrors.confirmPassword = 'Passwords do not match.';
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    // Notice per specification: Frontend integration placeholder, do not invent credentials
    const isSignup = mode === 'signup';
    const title = isSignup
      ? `${role === 'merchant' ? 'Merchant' : 'Customer'} Registration Submitted`
      : `${role === 'merchant' ? 'Merchant' : 'Customer'} Sign-In Submitted`;

    const message = isSignup
      ? `Registration validated successfully for "${email}". Since this is a frontend prototype without a live auth server, this demonstrates the client validation flow before calling POST /api/v1/auth/signup.`
      : `Sign-in credentials formatted and validated for "${email}". In a production environment with an API connected, this submits to POST /api/v1/auth/login.`;

    const redirectPath = role === 'merchant' ? '/dealer' : '/bookings';
    const redirectLabel =
      role === 'merchant' ? 'Go to Dealer Dashboard' : 'Go to My Bookings';

    setSubmittedNotice({
      title,
      message,
      role,
      mode,
      redirectPath,
      redirectLabel,
    });

    showToast(
      `${role === 'merchant' ? 'Dealer' : 'Customer'} Form Validated`,
      'Frontend authentication placeholder triggered successfully.',
      'info'
    );
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!email.trim()) {
      newErrors.email = 'Please enter your registered email address.';
    } else if (!validateEmail(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setSubmittedNotice({
        title: 'Password Reset Request Sent',
        message: `A simulated password reset link has been dispatched to ${email}. In a production environment, this triggers an email with a secure reset token.`,
        role,
        mode: 'login',
        redirectPath: role === 'merchant' ? '/dealer' : '/',
        redirectLabel: 'Return to Urban Scrap',
      });
      showToast('Reset Link Dispatched', `Password instructions sent to ${email}`, 'info');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0d281a]/65 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
        <div
          className="relative w-full max-w-lg transform overflow-hidden rounded-3xl bg-[#ffffff] p-6 sm:p-8 text-left shadow-2xl transition-all border border-[#e8e8e3] animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-[#717a75] hover:text-[#191c1a] hover:bg-[#f1f3f1] transition-colors focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ================= STEP 1: ROLE SELECTION ================= */}
          {step === 'role_select' && (
            <div className="space-y-6">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#dcfce7] text-[#143e29] mb-2">
                  Urban Scrap Account
                </span>
                <h2
                  id="auth-modal-title"
                  className="text-2xl sm:text-3xl font-extrabold text-[#143e29] tracking-tight"
                >
                  Welcome back
                </h2>
                <p className="text-sm text-[#555c58] mt-1">
                  Choose how you'd like to continue.
                </p>
              </div>

              {/* Two distinct role cards */}
              <div className="space-y-3.5 pt-1">
                {/* Option 1: Customer */}
                <button
                  type="button"
                  onClick={() => handleSelectRole('customer')}
                  className="w-full text-left p-5 rounded-2xl border-2 border-[#e8e8e3] hover:border-[#16a34a] hover:bg-[#fbfdfb] transition-all duration-150 group focus:outline-none focus:ring-2 focus:ring-[#16a34a] shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#dcfce7] text-[#16a34a] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <User className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-[#143e29] group-hover:text-[#16a34a] transition-colors">
                            Customer
                          </h3>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Household / RWA
                          </span>
                        </div>
                        <p className="text-xs text-[#555c58] mt-1 leading-relaxed">
                          For households, apartment societies, and offices looking to sell scrap and book doorstep pickups.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-[#f1f3f1] flex items-center justify-between text-xs font-bold text-[#16a34a]">
                    <span>Continue as Customer</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Option 2: Merchant */}
                <button
                  type="button"
                  onClick={() => handleSelectRole('merchant')}
                  className="w-full text-left p-5 rounded-2xl border-2 border-[#e8e8e3] hover:border-[#d97706] hover:bg-[#fffdf9] transition-all duration-150 group focus:outline-none focus:ring-2 focus:ring-[#d97706] shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Store className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-[#143e29] group-hover:text-amber-800 transition-colors">
                            Merchant
                          </h3>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Scrap Dealer Partner
                          </span>
                        </div>
                        <p className="text-xs text-[#555c58] mt-1 leading-relaxed">
                          For verified scrap dealers, kabadiwalas, and recyclers managing customer pickup manifests and daily routes.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-[#f1f3f1] flex items-center justify-between text-xs font-bold text-amber-800">
                    <span>Continue as Merchant</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>

              {/* Informative footer note */}
              <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#e8e8e3] text-xs text-[#717a75] flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#16a34a] shrink-0 mt-0.5" />
                <span>
                  Separate authentication paths ensure secure access to customer booking history and dealer dispatch operations.
                </span>
              </div>
            </div>
          )}

          {/* ================= STEP 2: AUTHENTICATION FORM ================= */}
          {step === 'auth_form' && (
            <div className="space-y-5">
              {/* Top Bar with Back and Role Badge */}
              <div className="flex items-center justify-between pb-3 border-b border-[#f1f3f1] -mt-1">
                <button
                  type="button"
                  onClick={handleBackToRoleSelect}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#555c58] hover:text-[#143e29] transition-colors focus:outline-none focus:ring-2 focus:ring-[#16a34a] rounded-lg px-1 py-0.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Role</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      role === 'merchant'
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    }`}
                  >
                    {role === 'merchant' ? (
                      <Store className="w-3.5 h-3.5 text-amber-700" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-emerald-700" />
                    )}
                    <span>{role === 'merchant' ? 'Merchant Portal' : 'Customer Portal'}</span>
                  </span>
                </div>
              </div>

              {/* Title & Login / Sign-up Tabs */}
              <div>
                <h2
                  id="auth-modal-title"
                  className="text-2xl font-extrabold text-[#143e29] tracking-tight"
                >
                  {mode === 'login'
                    ? `Log In to ${role === 'merchant' ? 'Merchant' : 'Customer'} Account`
                    : `Create ${role === 'merchant' ? 'Merchant' : 'Customer'} Account`}
                </h2>
                <p className="text-xs text-[#555c58] mt-0.5">
                  {mode === 'login'
                    ? 'Enter your credentials to access your dashboard.'
                    : role === 'merchant'
                    ? 'Register your scrap business to receive verified doorstep pickup leads.'
                    : 'Register to book pickups and track your recyclable scrap payouts.'}
                </p>

                {/* Tab switch */}
                <div className="flex p-1 bg-[#f1f3f1] rounded-xl mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrors({});
                      setSubmittedNotice(null);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      mode === 'login'
                        ? 'bg-white text-[#143e29] shadow-sm'
                        : 'text-[#717a75] hover:text-[#191c1a]'
                    }`}
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrors({});
                      setSubmittedNotice(null);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      mode === 'signup'
                        ? 'bg-white text-[#143e29] shadow-sm'
                        : 'text-[#717a75] hover:text-[#191c1a]'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              {/* Submission Notice / Placeholder Feedback */}
              {submittedNotice ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-3 animate-in fade-in-50">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-emerald-900">
                        {submittedNotice.title}
                      </h4>
                      <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
                        {submittedNotice.message}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/80 border border-emerald-200 text-[11px] text-[#3f4441] flex items-start gap-2">
                    <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      <strong>Backend Placeholder:</strong> Connect an authentication provider (e.g. Supabase, Firebase, or custom Express/Postgres API) to persist live sessions and token cookies.
                    </span>
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(submittedNotice.redirectPath);
                      }}
                      className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#143e29] hover:bg-[#1a5336] text-white shadow-sm transition-all"
                    >
                      <span>{submittedNotice.redirectLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmittedNotice(null)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-[#555c58] hover:text-[#191c1a] hover:bg-emerald-100/50"
                    >
                      Back to Form
                    </button>
                  </div>
                </div>
              ) : (
                /* Form Fields */
                <form onSubmit={handleFormSubmit} className="space-y-3.5" noValidate>
                  {/* SIGN UP ONLY: Name fields */}
                  {mode === 'signup' && (
                    <>
                      {/* Representative / Full Name */}
                      <div>
                        <label className="block text-xs font-bold text-[#191c1a] mb-1">
                          {role === 'merchant' ? 'Contact Person Name' : 'Full Name'}{' '}
                          <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                          <input
                            type="text"
                            placeholder={
                              role === 'merchant' ? 'e.g. Rajesh Kumar' : 'e.g. Priya Sharma'
                            }
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                              errors.fullName
                                ? 'border-rose-400 focus:ring-rose-400'
                                : 'border-[#d1d5db] focus:ring-[#16a34a]'
                            }`}
                          />
                        </div>
                        {errors.fullName && (
                          <p className="text-xs text-rose-500 mt-1">{errors.fullName}</p>
                        )}
                      </div>

                      {/* MERCHANT ONLY: Business Name */}
                      {role === 'merchant' && (
                        <div>
                          <label className="block text-xs font-bold text-[#191c1a] mb-1">
                            Scrap Business / Agency Name <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                            <input
                              type="text"
                              placeholder="e.g. GreenCycle Eco Recyclers"
                              value={businessName}
                              onChange={(e) => setBusinessName(e.target.value)}
                              className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                                errors.businessName
                                  ? 'border-rose-400 focus:ring-rose-400'
                                  : 'border-[#d1d5db] focus:ring-[#16a34a]'
                              }`}
                            />
                          </div>
                          {errors.businessName && (
                            <p className="text-xs text-rose-500 mt-1">{errors.businessName}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Email Field */}
                  <div>
                    <label className="block text-xs font-bold text-[#191c1a] mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                      <input
                        type="email"
                        placeholder={
                          role === 'merchant'
                            ? 'dealer@example.com'
                            : 'customer@example.com'
                        }
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                          errors.email
                            ? 'border-rose-400 focus:ring-rose-400'
                            : 'border-[#d1d5db] focus:ring-[#16a34a]'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-rose-500 mt-1">{errors.email}</p>
                    )}
                  </div>

                  {/* Password Field with Show/Hide */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-[#191c1a]">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setStep('forgot_password');
                            setErrors({});
                            setSubmittedNotice(null);
                          }}
                          className="text-xs font-semibold text-[#16a34a] hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                          errors.password
                            ? 'border-rose-400 focus:ring-rose-400'
                            : 'border-[#d1d5db] focus:ring-[#16a34a]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#717a75] hover:text-[#191c1a] focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-rose-500 mt-1">{errors.password}</p>
                    )}
                  </div>

                  {/* SIGN UP ONLY: Confirm Password Field */}
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-bold text-[#191c1a] mb-1">
                        Confirm Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                            errors.confirmPassword
                              ? 'border-rose-400 focus:ring-rose-400'
                              : 'border-[#d1d5db] focus:ring-[#16a34a]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#717a75] hover:text-[#191c1a] focus:outline-none"
                          aria-label={
                            showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-xs text-rose-500 mt-1">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className={`w-full py-3 px-5 rounded-xl font-bold text-sm text-white shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${
                        role === 'merchant'
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                          : 'bg-[#16a34a] hover:bg-[#15803d] shadow-[#16a34a]/20'
                      }`}
                    >
                      <span>
                        {mode === 'login'
                          ? `Log In as ${role === 'merchant' ? 'Merchant' : 'Customer'}`
                          : `Create ${role === 'merchant' ? 'Merchant' : 'Customer'} Account`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Toggle Mode footer */}
                  <div className="pt-2 text-center text-xs text-[#555c58]">
                    {mode === 'login' ? (
                      <p>
                        Don't have an account yet?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setMode('signup');
                            setErrors({});
                          }}
                          className="font-bold text-[#143e29] hover:underline"
                        >
                          Sign Up now
                        </button>
                      </p>
                    ) : (
                      <p>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setMode('login');
                            setErrors({});
                          }}
                          className="font-bold text-[#143e29] hover:underline"
                        >
                          Log In
                        </button>
                      </p>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ================= STEP 3: FORGOT PASSWORD ================= */}
          {step === 'forgot_password' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#f1f3f1] -mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('auth_form');
                    setErrors({});
                    setSubmittedNotice(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#555c58] hover:text-[#143e29] transition-colors rounded-lg px-1 py-0.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Log In</span>
                </button>
                <span className="text-xs font-bold text-[#717a75] capitalize">
                  {role} Password Recovery
                </span>
              </div>

              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2
                  id="auth-modal-title"
                  className="text-2xl font-extrabold text-[#143e29] tracking-tight"
                >
                  Reset your password
                </h2>
                <p className="text-xs text-[#555c58] mt-1">
                  Enter the email associated with your {role} account and we'll send password reset instructions.
                </p>
              </div>

              {submittedNotice ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-emerald-900">
                        {submittedNotice.title}
                      </h4>
                      <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
                        {submittedNotice.message}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('auth_form');
                      setSubmittedNotice(null);
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#143e29] text-white"
                  >
                    Return to Log In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-xs font-bold text-[#191c1a] mb-1">
                      Registered Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                          errors.email
                            ? 'border-rose-400 focus:ring-rose-400'
                            : 'border-[#d1d5db] focus:ring-[#16a34a]'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-rose-500 mt-1">{errors.email}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-5 rounded-xl font-bold text-sm bg-[#143e29] hover:bg-[#1a5336] text-white shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
