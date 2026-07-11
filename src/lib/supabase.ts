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

/**
 * Creates a cookie-aware Supabase client for Server Components, Route Handlers, and Server Actions.
 */
export async function getServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}
