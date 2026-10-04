import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/auth/admin';
import { ADMIN_SCOPE, ADMIN_SCOPE_HEADER } from '@/lib/admin-scope';

export async function middleware(request: NextRequest) {
  // Every matched request is /admin/*: tell the root layout so it renders
  // lang="es" regardless of pp_lang. Rebuilt after setAll so refreshed auth
  // cookies (written into request.headers) are forwarded too.
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set(ADMIN_SCOPE_HEADER, ADMIN_SCOPE);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = next();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');
  const isLogin = request.nextUrl.pathname === '/admin/login';

  // A session alone is not enough: pages that render customer PII require an
  // allowlisted admin email, mirroring the server-action requireAdmin gate.
  if (isAdminPath && !isLogin && !isAdminEmail(user?.email)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ['/admin/:path*'] };
