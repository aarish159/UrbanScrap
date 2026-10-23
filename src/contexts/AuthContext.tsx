import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Database } from '../types/database';
import { AuthModal } from '../components/auth/AuthModal';
import { saveDealerApplication } from '../utils/storage';

export type UserProfile = Database['public']['Tables']['profiles']['Row'];
export type DealerProfile = Database['public']['Tables']['dealers']['Row'];
export type AuthRoleChoice = 'customer' | 'dealer' | null;

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
  }) => Promise<{ error?: string; pendingApproval?: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithPhone: (phone: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: (returnTo?: string) => Promise<{ error?: string }>;
  sendPhoneVerificationOtp: (phone: string) => Promise<{ error?: string }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error?: string }>;
  sendPasswordResetCode: (email: string) => Promise<{ error?: string }>;
  verifyPasswordResetCode: (email: string, token: string) => Promise<{ error?: string }>;
  updateUserPassword: (newPassword: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshDealer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generic error messages to prevent account enumeration / reconnaissance
const GENERIC_AUTH_ERROR = 'Invalid email, phone number, or password. Please verify your credentials.';

/**
 * Resolves the application base URL:
 * - Production: 'https://urbanscrap.onrender.com' (or configured VITE_APP_URL)
 * - Local development: 'http://localhost:3000' (or current window.location.origin)
 */
export function getAppBaseUrl(): string {
  const configuredAppUrl = import.meta.env.VITE_APP_URL as string | undefined;
  if (configuredAppUrl && configuredAppUrl.trim().length > 0) {
    return configuredAppUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local');

    if (isLocalhost) {
      return window.location.origin;
    }

    if (window.location.origin.includes('urbanscrap.onrender.com')) {
      return 'https://urbanscrap.onrender.com';
    }

    return window.location.origin;
  }

  return 'https://urbanscrap.onrender.com';
}

/**
 * Returns OAuth redirect URL:
 * - Local development: http://localhost:3000/auth/callback
 * - Production: https://urbanscrap.onrender.com/auth/callback
 */
export function getOAuthRedirectUrl(): string {
  return `${getAppBaseUrl()}/auth/callback`;
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
    if (!isConfigured) return;
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

  const fetchProfile = useCallback(async (userId: string) => {
    if (!isConfigured) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
        if (data.role === 'dealer' || data.role === 'admin') {
          await fetchDealer(userId);
        } else {
          setDealer(null);
        }
      } else if (!data) {
        // Missing profile (e.g. freshly authenticated via Google OAuth):
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
          } else {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
        setDealer(null);
      }
    } catch {
      // Safe fallback
    }
  }, [isConfigured, fetchDealer]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
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

        // Check if there was a saved returnTo destination from before OAuth redirect
        // Only navigate directly if NOT on /auth/callback (which manages its own transition state)
        if (window.location.pathname !== '/auth/callback') {
          const pendingReturnTo = sessionStorage.getItem('auth_return_to');
          if (pendingReturnTo) {
            sessionStorage.removeItem('auth_return_to');
            if (window.location.pathname !== pendingReturnTo) {
              window.location.replace(pendingReturnTo);
            }
          }
          // Clean hash fragments if Supabase redirected directly to root / with #access_token=...
          if (
            window.location.hash &&
            (window.location.hash.includes('access_token') ||
              window.location.hash.includes('refresh_token') ||
              window.location.hash.includes('error='))
          ) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      } else {
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
      const { error } = await supabase.auth.signInWithPassword({
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

      return {};
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

      const { error } = await supabase.auth.signInWithPassword({
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

      return {};
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
          redirectTo: `${getAppBaseUrl()}/reset-password`,
        }
      );

      if (error) {
        // Return generic success message regardless to prevent email enumeration
        return { error: undefined };
      }

      return {};
    } catch {
      return {};
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
      return { pendingApproval: true };
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
          await supabase.from('dealers').insert({
            user_id: data.session.user.id,
            business_name: businessName.trim(),
            phone: cleanPhone,
            service_area: serviceArea.trim(),
            is_verified: false,
          });
        } catch {
          // Fallback if trigger already inserted
        }
      }

      return { pendingApproval: true };
    } catch {
      return { error: 'Failed to submit dealer partner application. Please try again.' };
    }
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
