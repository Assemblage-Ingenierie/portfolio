import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Routes publiques
  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) {
    if (user) {
      const { data: profile } = await supabase
        .from('portfolio_profiles')
        .select('is_approved')
        .eq('id', user.id)
        .single();
      if (profile && !profile.is_approved) {
        return NextResponse.redirect(new URL('/attente', request.url));
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
    return supabaseResponse;
  }

  // Page d'attente : accessible aux utilisateurs connectés non approuvés
  if (pathname.startsWith('/attente')) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url));
    return supabaseResponse;
  }

  // Routes protégées : authentification requise
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Vérifier approbation et rôle
  const { data: profile } = await supabase
    .from('portfolio_profiles')
    .select('is_approved, role')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_approved) {
    return NextResponse.redirect(new URL('/attente', request.url));
  }

  // Routes admin
  if (pathname.startsWith('/admin') && profile.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
