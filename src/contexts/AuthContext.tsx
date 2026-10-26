import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Database } from '../types/database';
import { AuthModal } from '../components/auth/AuthModal';
import { saveDealerApplication, getDealerApplications, submitDealerGstDetails } from '../utils/storage';

export type UserProfile = Database['public']['Tables']['profiles']['Row'];
export type DealerProfile = Database['public']['Tables']['dealers']['Row'];
export type AuthRoleChoice = 'customer' | 'dealer' | 'admin' | null;

export interface OpenAuthModalOptions {
  initialRole?: AuthRoleChoice;
  initialMode?: 'login' | 'signup' | 'forgot_password' | 'verify_phone';
  returnTo?: string | null;
  reasonMessage?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  dealer: DealerProfile | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  isAuthModalOpen: boolean;
  authModalOptions: OpenAuthModalOptions | null;
  openAuthModal: (options?: OpenAuthModalOptions) => void;
  closeAuthModal: () => void;
  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => Promise<{ error?: string; emailConfirmationRequired?: boolean }>;
  applyAsDealer: (params: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    businessName: string;
    serviceArea: string;
  }) => Promise<{ error?: string; pendingApproval?: boolean; redirectToGst?: boolean; emailConfirmationRequired?: boolean }>;
  submitDealerGst: (params: {
    gstin: string;
    legalBusinessName: string;
    businessAddress: string;
    state: string;
    gstCertificateFile?: File | null;
    gstCertificateUrl?: string | null;
  }) => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string; user?: User | null; session?: Session | null }>;
  signInWithPhone: (phone: string, password: string) => Promise<{ error?: string; user?: User | null; session?: Session | null }>;
  signInWithGoogle: (returnTo?: string) => Promise<{ error?: string }>;
  sendPhoneVerificationOtp: (phone: string) => Promise<{ error?: string }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error?: string }>;
  sendPasswordResetCode: (email: string) => Promise<{ error?: string }>;
  verifyPasswordResetCode: (email: string, token: string) => Promise<{ error?: string }>;
  updateUserPassword: (newPassword: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: (targetUserId?: string) => Promise<UserProfile | null>;
  refreshDealer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generic error messages to prevent account enumeration / reconnaissance
const GENERIC_AUTH_ERROR = 'Invalid email, phone number, or password. Please verify your credentials.';

/**
 * Resolves the application base URL:
 * - Production on Render: 'https://urbanscrap.onrender.com' (or non-localhost VITE_APP_URL)
 * - Local development: 'http://localhost:3000' (or current window.location.origin on local loopback)
 *
 * GUARANTEE: In production or when accessed via public hosts, this function will NEVER
 * return a localhost URL, even if VITE_APP_URL was mistakenly set to localhost.
 */
export function getAppBaseUrl(): string {
  // 1. In browser window context
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local');

    // ONLY allow localhost URLs when actively running on a local development machine
    if (isLocalhost) {
      return window.location.port ? `http://localhost:${window.location.port}` : 'http://localhost:3000';
    }

    // Explicit check for Render production domain
    if (hostname.includes('urbanscrap.onrender.com') || hostname.includes('onrender.com')) {
      return 'https://urbanscrap.onrender.com';
    }

    // Check configured VITE_APP_URL - ONLY use if it's NOT a localhost URL
    const envUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/$/, '');
    }

    // If window.location.origin is available and not localhost
    if (
      window.location.origin &&
      !window.location.origin.includes('localhost') &&
      !window.location.origin.includes('127.0.0.1')
    ) {
      return window.location.origin.replace(/\/$/, '');
    }

    // Default to production origin
    return 'https://urbanscrap.onrender.com';
  }

  // 2. Non-browser context (SSR / build / test)
  const envUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }

  return 'https://urbanscrap.onrender.com';
}

/**
 * Returns OAuth redirect URL:
 * - Local development: http://localhost:3000/auth/callback
 * - Production: https://urbanscrap.onrender.com/auth/callback
 */
export function getOAuthRedirectUrl(): string {
  const base = getAppBaseUrl();
  const isHashRouting = typeof window !== 'undefined' && window.location.hash.startsWith('#/');
  const route = isHashRouting ? '#/auth/callback' : 'auth/callback';
  return `${base}/${route}`;
}

/**
 * Returns Password Reset redirect URL:
 * - Local development: http://localhost:3000/reset-password
 * - Production: https://urbanscrap.onrender.com/reset-password
 */
export function getResetPasswordRedirectUrl(): string {
  const base = getAppBaseUrl();
  const isHashRouting = typeof window !== 'undefined' && window.location.hash.startsWith('#/');
  const route = isHashRouting ? '#/reset-password' : 'reset-password';
  return `${base}/${route}`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalOptions, setAuthModalOptions] = useState<OpenAuthModalOptions | null>(null);
  const isConfigured = isSupabaseConfigured();

  const openAuthModal = useCallback((options?: OpenAuthModalOptions) => {
    setAuthModalOptions(options ?? null);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthModalOptions(null);
  }, []);

  const fetchDealer = useCallback(async (userId: string) => {
    if (!isConfigured) {
      // In demo / local storage mode: find user's dealer application
      const apps = getDealerApplications();
      const localDealer = apps.find((d) => d.userId === userId || d.id === userId);
      if (localDealer) {
        setDealer({
          id: localDealer.id,
          user_id: userId,
          business_name: localDealer.businessName,
          phone: localDealer.phone,
          service_area: localDealer.serviceArea,
          vehicle_type: localDealer.vehicleType,
          rating: localDealer.rating,
          is_verified: localDealer.isVerified,
          gstin: localDealer.gstin || null,
          legal_business_name: localDealer.legalBusinessName || null,
          business_address: localDealer.businessAddress || null,
          state: localDealer.state || null,
          gst_certificate_url: localDealer.gstCertificateUrl || null,
          verification_status:
            localDealer.status === 'verified' || localDealer.status === 'approved'
              ? 'approved'
              : localDealer.status === 'rejected'
              ? 'rejected'
              : 'pending',
          rejection_reason: localDealer.rejectionReason || null,
          review_notes: localDealer.reviewNotes || null,
          reviewed_by: localDealer.reviewedBy || null,
          reviewed_at: localDealer.reviewedAt || null,
          submitted_at: localDealer.submittedAt || null,
          created_at: localDealer.createdAt,
          updated_at: localDealer.updatedAt,
        });
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        setDealer(data);
      } else {
        setDealer(null);
      }
    } catch {
      setDealer(null);
    }
  }, [isConfigured]);

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (!isConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
        // Always check if user has a dealer registration (pending, approved, or rejected)
        await fetchDealer(userId);
        return data;
      }

      if (error) {
        console.error('Error fetching profile from database:', error);
        return null;
      }

      if (!data) {
        // Truly missing profile in database (e.g. freshly authenticated via Google OAuth):
        // Automatically create and link customer profile from auth metadata
        const { data: authUserData } = await supabase.auth.getUser();
        const authUser = authUserData?.user;
        if (authUser && authUser.id === userId) {
          const userMeta = authUser.user_metadata || {};
          const fullName =
            userMeta.full_name ||
            userMeta.name ||
            authUser.email?.split('@')[0] ||
            'Customer';
          const rawPhone = userMeta.phone ? String(userMeta.phone).replace(/\D/g, '') : null;

          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              full_name: fullName,
              phone: rawPhone,
              phone_verified: false,
              role: 'customer',
            })
            .select()
            .maybeSingle();

          if (!createError && createdProfile) {
            setProfile(createdProfile);
            return createdProfile;
          } else {
            setProfile(null);
            return null;
          }
        } else {
          setProfile(null);
          return null;
        }
      }
      return null;
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
      return null;
    }
  }, [isConfigured, fetchDealer]);

  const refreshProfile = useCallback(async (targetUserId?: string): Promise<UserProfile | null> => {
    const effectiveUserId = targetUserId || user?.id || (await supabase.auth.getUser()).data.user?.id;
    if (effectiveUserId) {
      return await fetchProfile(effectiveUserId);
    }
    return null;
  }, [user?.id, fetchProfile]);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Initialize current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen to Supabase auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);

        // Route password recovery event to /reset-password
        if (_event === 'PASSWORD_RECOVERY') {
          sessionStorage.setItem('is_password_recovery', 'true');
          if (window.location.pathname !== '/reset-password') {
            window.location.replace('/reset-password' + window.location.search + window.location.hash);
            return;
          }
        }

        // Check if user landed on any non-reset route with recovery parameters
        if (window.location.pathname !== '/reset-password' && window.location.pathname !== '/auth/callback') {
          const hash = window.location.hash || '';
          const search = window.location.search || '';
          if (
            hash.includes('type=recovery') ||
            search.includes('type=recovery') ||
            hash.includes('otp_expired') ||
            search.includes('otp_expired')
          ) {
            window.location.replace('/reset-password' + search + hash);
            return;
          }
        }

        // Check if there was a saved returnTo destination from before OAuth redirect
        // Only navigate directly if NOT on /auth/callback and NOT on /reset-password
        if (window.location.pathname !== '/auth/callback' && window.location.pathname !== '/reset-password') {
          const pendingReturnTo = sessionStorage.getItem('auth_return_to');
          if (pendingReturnTo) {
            sessionStorage.removeItem('auth_return_to');
            if (window.location.pathname !== pendingReturnTo) {
              window.location.replace(pendingReturnTo);
            }
          }
          // Clean hash fragments for normal logins if Supabase redirected directly to root / with #access_token=...
          if (
            window.location.hash &&
            (window.location.hash.includes('access_token') ||
              window.location.hash.includes('refresh_token') ||
              window.location.hash.includes('error=')) &&
            !window.location.hash.includes('type=recovery')
          ) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      } else {
        // Forward to /reset-password if recovery token expired or produced error on arrival
        if (window.location.pathname !== '/reset-password' && window.location.pathname !== '/auth/callback') {
          const hash = window.location.hash || '';
          const search = window.location.search || '';
          if (
            hash.includes('type=recovery') ||
            search.includes('type=recovery') ||
            hash.includes('otp_expired') ||
            search.includes('otp_expired')
          ) {
            window.location.replace('/reset-password' + search + hash);
            return;
          }
        }
        setProfile(null);
        setDealer(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, fetchProfile]);

  // Sign Up with Email, Full Name, Phone (Always customer role)
  const signUp = async ({
    email,
    password,
    fullName,
    phone,
  }: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => {
    if (!isConfigured) {
      return {
        error:
          'Supabase backend credentials are not yet configured. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    try {
      const formattedPhone = phone ? phone.replace(/\D/g, '') : undefined;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: formattedPhone,
          },
          emailRedirectTo: `${getAppBaseUrl()}/`,
        },
      });

      if (error) {
        return { error: error.message };
      }

      // Check if email confirmation is required by Supabase project settings
      const requiresEmailConfirm = !data.session && !!data.user;
      return { emailConfirmationRequired: requiresEmailConfirm };
    } catch {
      return { error: 'An unexpected error occurred during signup. Please try again.' };
    }
  };

  // Sign In using Email + Password
  const signInWithEmail = async (email: string, password: string) => {
    if (!isConfigured) {
      return { error: 'Supabase credentials are not configured in your environment.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        // If email not confirmed, provide clear instructions
        if (
          error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('not confirmed')
        ) {
          return {
            error:
              'Email verification required. Please check your inbox and confirm your email before signing in.',
          };
        }
        return { error: GENERIC_AUTH_ERROR };
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.user);
      }

      return { user: data?.user, session: data?.session };
    } catch {
      return { error: GENERIC_AUTH_ERROR };
    }
  };

  // Sign In using Phone + Password
  // Note: Requires phone number to be formatted in E.164 format (+91XXXXXXXXXX)
  const signInWithPhone = async (phone: string, password: string) => {
    if (!isConfigured) {
      return { error: 'Supabase credentials are not configured in your environment.' };
    }

    try {
      const cleanDigits = phone.replace(/\D/g, '');
      const formattedPhone = cleanDigits.startsWith('91') && cleanDigits.length === 12
        ? `+${cleanDigits}`
        : cleanDigits.length === 10
        ? `+91${cleanDigits}`
        : `+${cleanDigits}`;

      const { data, error } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('phone not confirmed') ||
          error.message.toLowerCase().includes('not confirmed')
        ) {
          return {
            error:
              'Phone number has not been verified yet. Please verify your phone number via OTP first.',
          };
        }
        return { error: GENERIC_AUTH_ERROR };
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.user);
      }

      return { user: data?.user, session: data?.session };
    } catch {
      return { error: GENERIC_AUTH_ERROR };
    }
  };

  // Sign In / Sign Up with Google OAuth
  const signInWithGoogle = async (returnTo?: string) => {
    if (returnTo) {
      sessionStorage.setItem('auth_return_to', returnTo);
    }

    if (!isConfigured) {
      // Demo / simulated mode fallback for seamless local testing
      const demoUser = {
        id: 'google-demo-user-123',
        email: 'alex.google@example.com',
        user_metadata: {
          full_name: 'Alex Johnson (Google)',
          avatar_url:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        },
      } as unknown as User;
      setUser(demoUser);
      setProfile({
        id: 'google-demo-user-123',
        full_name: 'Alex Johnson (Google)',
        phone: null,
        phone_verified: false,
        role: 'customer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return {};
    }

    try {
      // Dynamic OAuth redirect URL:
      // Local development: http://localhost:3000/auth/callback
      // Production on Render: https://urbanscrap.onrender.com/auth/callback
      const redirectTo = getOAuthRedirectUrl();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data?.url) {
        window.location.href = data.url;
      }

      return {};
    } catch {
      return { error: 'Failed to initialize Google Sign In. Please try again.' };
    }
  };

  // Send Phone Verification OTP (requires SMS provider configured in Supabase)
  const sendPhoneVerificationOtp = async (phone: string) => {
    if (!isConfigured) {
      return { error: 'Supabase credentials are not configured in your environment.' };
    }

    try {
      const cleanDigits = phone.replace(/\D/g, '');
      const formattedPhone = cleanDigits.startsWith('91') && cleanDigits.length === 12
        ? `+${cleanDigits}`
        : `+91${cleanDigits}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        // If SMS provider is not yet hooked up, give an actionable message
        if (
          error.message.toLowerCase().includes('sms') ||
          error.message.toLowerCase().includes('provider')
        ) {
          return {
            error:
              'SMS Gateway is not yet configured in Supabase project settings. Please configure Twilio / MessageBird in Supabase Auth -> Providers -> Phone.',
          };
        }
        return { error: error.message };
      }

      return {};
    } catch {
      return { error: 'Could not send verification code. Please try again.' };
    }
  };

  // Verify Phone OTP and mark phone_verified in public.profiles
  const verifyPhoneOtp = async (phone: string, token: string) => {
    if (!isConfigured) {
      return { error: 'Supabase credentials are not configured in your environment.' };
    }

    try {
      const cleanDigits = phone.replace(/\D/g, '');
      const formattedPhone = cleanDigits.startsWith('91') && cleanDigits.length === 12
        ? `+${cleanDigits}`
        : `+91${cleanDigits}`;

      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: token.trim(),
        type: 'sms',
      });

      if (error) {
        return { error: 'Invalid or expired phone verification code.' };
      }

      if (data.user) {
        // Update public.profiles phone_verified flag
        await supabase
          .from('profiles')
          .update({ phone_verified: true, phone: cleanDigits.slice(-10) })
          .eq('id', data.user.id);

        await refreshProfile();
      }

      return {};
    } catch {
      return { error: 'Failed to verify phone OTP.' };
    }
  };

  // Send password reset code / recovery email
  const sendPasswordResetCode = async (email: string) => {
    if (!isConfigured) {
      return { error: 'Supabase credentials are not configured in your environment.' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: getResetPasswordRedirectUrl(),
        }
      );

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch {
      return { error: 'Failed to send reset password email. Please try again.' };
    }
  };

  // Verify password reset code (email token)
  const verifyPasswordResetCode = async (email: string, token: string) => {
    if (!isConfigured) {
      return { error: 'Supabase credentials are not configured in your environment.' };
    }

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'recovery',
      });

      if (error) {
        return { error: 'Invalid or expired password reset code. Please request a new one.' };
      }

      return {};
    } catch {
      return { error: 'Failed to verify recovery code.' };
    }
  };

  // Update password after recovery or in account settings
  const updateUserPassword = async (newPassword: string) => {
    if (!isConfigured) {
      return { error: 'Supabase credentials are not configured in your environment.' };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch {
      return { error: 'Failed to update password. Please try again.' };
    }
  };

  const refreshDealer = useCallback(async () => {
    if (user?.id) {
      await fetchDealer(user.id);
    }
  }, [user?.id, fetchDealer]);

  // Apply as Dealer: registers account with dealer metadata
  // Note: Customer role is assigned by trigger, so dealer status remains pending approval
  const applyAsDealer = async ({
    email,
    password,
    fullName,
    phone,
    businessName,
    serviceArea,
  }: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    businessName: string;
    serviceArea: string;
  }) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const newAppId = `dealer-app-${Date.now()}`;

    // Always record locally so admin dashboard reflects applicant immediately
    saveDealerApplication({
      id: newAppId,
      businessName: businessName.trim(),
      applicantName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: cleanPhone,
      serviceArea: serviceArea.trim(),
      vehicleType: 'EV Loader / Three-Wheeler',
      rating: 4.8,
      isVerified: false,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (!isConfigured) {
      const demoUserId = `dealer-demo-${Date.now()}`;
      const demoUser = {
        id: demoUserId,
        email: email.trim().toLowerCase(),
        user_metadata: { full_name: fullName.trim(), phone: cleanPhone },
      } as unknown as User;
      setUser(demoUser);
      setProfile({
        id: demoUserId,
        full_name: fullName.trim(),
        phone: cleanPhone,
        phone_verified: true,
        role: 'customer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setDealer({
        id: newAppId,
        user_id: demoUserId,
        business_name: businessName.trim(),
        phone: cleanPhone,
        service_area: serviceArea.trim(),
        vehicle_type: 'EV Loader / Three-Wheeler',
        rating: 4.8,
        is_verified: false,
        verification_status: 'pending',
        gstin: null,
        legal_business_name: null,
        business_address: null,
        state: null,
        gst_certificate_url: null,
        rejection_reason: null,
        review_notes: null,
        reviewed_by: null,
        reviewed_at: null,
        submitted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { pendingApproval: true, redirectToGst: true };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: cleanPhone,
            business_name: businessName.trim(),
            service_area: serviceArea.trim(),
            dealer_applicant: true,
          },
          emailRedirectTo: `${getAppBaseUrl()}/`,
        },
      });

      if (error) {
        return { error: error.message };
      }

      // If user session is active, insert into public.dealers as unverified
      if (data?.session?.user) {
        try {
          const { data: insertedDealer } = await supabase.from('dealers').insert({
            user_id: data.session.user.id,
            business_name: businessName.trim(),
            phone: cleanPhone,
            service_area: serviceArea.trim(),
            is_verified: false,
            verification_status: 'pending',
          }).select().maybeSingle();

          if (insertedDealer) {
            setDealer(insertedDealer);
          }

          if (insertedDealer?.id) {
            await supabase.from('dealer_reviews').insert({
              dealer_id: insertedDealer.id,
              action: 'submitted',
              notes: 'Initial dealer partner application registration.',
            });
          }
        } catch {
          // Fallback if trigger or duplicate
        }

        return { pendingApproval: true, redirectToGst: true };
      }

      // If email confirmation is required by Supabase project settings
      const requiresEmailConfirm = !data.session && !!data.user;
      return { pendingApproval: true, emailConfirmationRequired: requiresEmailConfirm };
    } catch {
      return { error: 'Failed to submit dealer partner application. Please try again.' };
    }
  };

  // Submit / Resubmit Dealer GST Details
  const submitDealerGst = async (params: {
    gstin: string;
    legalBusinessName: string;
    businessAddress: string;
    state: string;
    gstCertificateFile?: File | null;
    gstCertificateUrl?: string | null;
  }) => {
    // 1. Validate GSTIN format only (15 alphanumeric characters)
    const cleanGstin = params.gstin.trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(cleanGstin)) {
      return {
        error:
          'Invalid GSTIN format. A valid Indian GSTIN contains 15 alphanumeric characters (e.g. 29AABCU9603R1ZM).',
      };
    }

    if (!params.legalBusinessName.trim()) {
      return { error: 'Please enter your GST-registered legal business name.' };
    }

    if (!params.businessAddress.trim()) {
      return { error: 'Please enter your registered business address.' };
    }

    if (!params.state.trim()) {
      return { error: 'Please select your registration State or Union Territory.' };
    }

    let certificateUrl = params.gstCertificateUrl || null;

    // 2. Upload file to Supabase Storage if file provided and Supabase configured
    if (params.gstCertificateFile && user && isConfigured && isSupabaseConfigured()) {
      try {
        const fileExt = params.gstCertificateFile.name.split('.').pop();
        const filePath = `${user.id}/gst-certificate-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('dealer-documents')
          .upload(filePath, params.gstCertificateFile, {
            upsert: true,
            contentType: params.gstCertificateFile.type,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('dealer-documents')
            .getPublicUrl(filePath);
          certificateUrl = urlData?.publicUrl || filePath;
        }
      } catch (err) {
        console.warn('Storage upload error, falling back:', err);
      }
    }

    // Fallback URL if local file
    if (!certificateUrl && params.gstCertificateFile) {
      certificateUrl = URL.createObjectURL(params.gstCertificateFile);
    }

    const isResubmission = dealer?.verification_status === 'rejected';
    const nowIso = new Date().toISOString();

    // 3. Update Supabase if configured
    if (user && isConfigured && isSupabaseConfigured()) {
      try {
        const { error: updateError } = await supabase
          .from('dealers')
          .update({
            gstin: cleanGstin,
            legal_business_name: params.legalBusinessName.trim(),
            business_address: params.businessAddress.trim(),
            state: params.state.trim(),
            gst_certificate_url: certificateUrl,
            verification_status: 'pending',
            is_verified: false,
            rejection_reason: null,
            submitted_at: nowIso,
            updated_at: nowIso,
          })
          .eq('user_id', user.id);

        if (updateError) {
          return { error: updateError.message };
        }

        // Insert into dealer_reviews audit table
        if (dealer?.id) {
          await supabase.from('dealer_reviews').insert({
            dealer_id: dealer.id,
            action: isResubmission ? 'resubmitted' : 'submitted',
            notes: isResubmission
              ? 'Dealer updated and resubmitted GST credentials after rejection.'
              : 'Initial GST credentials submitted.',
          });
        }

        await fetchDealer(user.id);
      } catch {
        return { error: 'Failed to save GST verification details. Please try again.' };
      }
    }

    // Always update local storage for offline / demo mode
    const targetDealerId = dealer?.id || user?.id || 'demo-dealer';
    const updated = submitDealerGstDetails({
      dealerId: targetDealerId,
      gstin: cleanGstin,
      legalBusinessName: params.legalBusinessName,
      businessAddress: params.businessAddress,
      state: params.state,
      gstCertificateUrl: certificateUrl,
    });

    if (updated) {
      setDealer({
        id: updated.id,
        user_id: user?.id || null,
        business_name: updated.businessName,
        phone: updated.phone,
        service_area: updated.serviceArea,
        vehicle_type: updated.vehicleType,
        rating: updated.rating,
        is_verified: false,
        gstin: updated.gstin || null,
        legal_business_name: updated.legalBusinessName || null,
        business_address: updated.businessAddress || null,
        state: updated.state || null,
        gst_certificate_url: updated.gstCertificateUrl || null,
        verification_status: 'pending',
        rejection_reason: null,
        review_notes: updated.reviewNotes || null,
        reviewed_by: updated.reviewedBy || null,
        reviewed_at: updated.reviewedAt || null,
        submitted_at: updated.submittedAt || null,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      });
    }

    return {};
  };

  // Sign out
  const signOut = async () => {
    if (isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Safe fallback
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setDealer(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        dealer,
        session,
        loading,
        isConfigured,
        isAuthModalOpen,
        authModalOptions,
        openAuthModal,
        closeAuthModal,
        signUp,
        applyAsDealer,
        submitDealerGst,
        signInWithEmail,
        signInWithPhone,
        signInWithGoogle,
        sendPhoneVerificationOtp,
        verifyPhoneOtp,
        sendPasswordResetCode,
        verifyPasswordResetCode,
        updateUserPassword,
        signOut,
        refreshProfile,
        refreshDealer,
      }}
    >
      {children}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        options={authModalOptions}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
