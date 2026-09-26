import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const authenticatedFetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('custom_token') : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: authenticatedFetch } })
  : null;
