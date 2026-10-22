import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Validates whether Supabase environment credentials are real, non-placeholder values.
 */
export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (
    supabaseUrl.includes('your-project-ref') ||
    supabaseUrl.includes('your-project-id') ||
    supabaseAnonKey.includes('your-anon') ||
    supabaseAnonKey.includes('placeholder')
  ) {
    return false;
  }
  return true;
}

// Fallback dummy client for when environment variables are missing
// so the UI can gracefully render a configuration guide instead of crashing.
export const supabase = createClient<Database>(
  isSupabaseConfigured() ? supabaseUrl! : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey! : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
