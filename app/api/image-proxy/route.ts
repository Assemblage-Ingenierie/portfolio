import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';

const ALLOWED_HOSTS = ['dl.airtable.com', 'v5.airtableusercontent.com', 'airtableusercontent.com'];

function isAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth;

  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isAllowed(url)) {
    return NextResponse.json({ error: 'URL non autorisée' }, { status: 400 });
  }

  const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!upstream.ok) {
    return NextResponse.json({ error: 'Erreur fetch image' }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
  const buffer = await upstream.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
