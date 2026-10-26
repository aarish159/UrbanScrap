import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: max 5 login attempts per 60 seconds per IP
const MAX_ATTEMPTS_PER_WINDOW = 5;
const WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(clientIp: string, now: number): { allowed: boolean; retryAfter?: number } {
  // Prune map if it gets large
  if (rateLimitMap.size > 200) {
    for (const [ip, timestamps] of rateLimitMap.entries()) {
      const active = timestamps.filter((t) => now - t < WINDOW_MS);
      if (active.length === 0) {
        rateLimitMap.delete(ip);
      } else {
        rateLimitMap.set(ip, active);
      }
    }
  }

  const active = (rateLimitMap.get(clientIp) ?? []).filter((t) => now - t < WINDOW_MS);
  rateLimitMap.set(clientIp, active);

  if (active.length >= MAX_ATTEMPTS_PER_WINDOW) {
    const oldest = active[0];
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    return { allowed: false, retryAfter };
  }

  active.push(now);
  rateLimitMap.set(clientIp, active);
  return { allowed: true };
}

serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are allowed.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    );
  }

  // 2. Client IP Rate Limiting
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'anonymous_client';

  const now = Date.now();
  const rateLimit = checkRateLimit(clientIp, now);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'RATE_LIMITED',
        message: `Too many login attempts. Please wait ${rateLimit.retryAfter} seconds before trying again.`,
        retryAfter: rateLimit.retryAfter,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      }
    );
  }

  try {
    const demoEmail = Deno.env.get('DEMO_DEALER_EMAIL')?.trim();
    const demoPassword = Deno.env.get('DEMO_DEALER_PASSWORD')?.trim();

    if (!demoEmail || !demoPassword) {
      return new Response(
        JSON.stringify({
          error: 'DEMO_DEALER_NOT_CONFIGURED',
          message:
            'Demo dealer credentials are not configured in server secrets. Please set DEMO_DEALER_EMAIL and DEMO_DEALER_PASSWORD in Supabase secrets.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: 'SUPABASE_CONFIG_MISSING',
          message: 'Server environment is missing SUPABASE_URL or SUPABASE_ANON_KEY.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });

    if (error || !data.session) {
      // Safe logging: do not log credentials, passwords, or tokens
      console.warn('Demo dealer sign-in rejected by Supabase Auth:', error?.message || 'No session returned');
      return new Response(
        JSON.stringify({
          error: 'DEMO_AUTH_FAILED',
          message: error?.message || 'Authentication with configured demo dealer credentials failed.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Return session tokens for client to set active Supabase Auth session
    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type,
        },
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err: any) {
    console.error('Unexpected error in demo-dealer-login edge function');
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: err?.message || 'Unexpected error during demo dealer login.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
