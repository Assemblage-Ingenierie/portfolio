import { type NextRequest, NextResponse } from 'next/server';

// Le proxy ne gère plus l'auth (gérée côté client par AuthGate + useAuth).
// Il ne fait que passer les requêtes sans modification.
export async function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
