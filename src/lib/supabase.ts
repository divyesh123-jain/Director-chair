import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';

// =============================================================================
// Supabase Clients for Director's Chair
// =============================================================================
// Two clients:
//   1. Server client  — uses SERVICE_ROLE_KEY, bypasses RLS, for API routes
//   2. Browser client — uses ANON_KEY, for client-side React Query reads
//
// No auth/RLS in this hackathon build, so we keep it simple.
// =============================================================================

// ─── Server Client (API Routes) ─────────────────────────────────────────────

let _serverClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client for use in API routes / server-side code.
 * Uses the service role key so it has full access (no RLS).
 * Singleton — created once and reused.
 */
export function getServerSupabase(): SupabaseClient {
  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase server env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }

  _serverClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _serverClient;
}

// ─── Browser Client (Client Components) ─────────────────────────────────────

let _browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Returns a Supabase client for use in client-side components.
 * Uses the anon key (public, safe to expose).
 * Singleton — created once and reused across the React tree.
 */
export function getBrowserSupabase() {
  if (_browserClient) return _browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase browser env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  _browserClient = createBrowserClient(url, anonKey);
  return _browserClient;
}

// ─── Server Component Client (RSC / Server Actions) ─────────────────────────

/**
 * Creates a Supabase client for use in React Server Components.
 * Unlike the server client above, this uses the anon key and respects
 * cookie-based auth (if we ever add it). For now, functionally similar
 * to the browser client but safe to use in server components.
 *
 * NOT a singleton — create per-request in server components.
 */
export function createServerComponentClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      // Hackathon build: no auth cookies, so we stub these out.
      getAll: () => [],
      setAll: () => {},
    },
  });
}
