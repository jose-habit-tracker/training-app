import { createClient } from '@supabase/supabase-js';
import { storage } from './storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace('/rest/v1/', '') ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
