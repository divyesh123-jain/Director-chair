import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lightweight auth proxy – no heavy Supabase SDK imports.
 * We only need to check whether auth cookies exist to decide routing.
 * Actual token verification happens inside each API route handler.
 */
export default async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  // Check for Supabase auth cookies (supports chunked tokens like .0, .1)
  const hasAuthCookie = request.cookies
    .getAll()
    .some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));

  // Public paths that don't require authentication
  const isAuthPage =
    url.pathname === '/login' ||
    url.pathname === '/signup' ||
    url.pathname === '/landing';

  // Protected paths
  const isProtectedRoute =
    url.pathname === '/' ||
    url.pathname.startsWith('/project') ||
    (url.pathname.startsWith('/api') && !url.pathname.startsWith('/api/auth/callback'));

  // Redirect unauthenticated users away from protected routes
  if (!hasAuthCookie && isProtectedRoute) {
    url.pathname = '/landing';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (hasAuthCookie && isAuthPage) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|demo|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)',
  ],
};
