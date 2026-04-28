import { NextRequest, NextResponse } from 'next/server';
import { updateProjetFields } from '@/lib/airtable';
import type { ProjetEditableFields } from '@/lib/airtable';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: ProjetEditableFields;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  try {
    await updateProjetFields(slug, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err)
        : String(err);
    console.error('Fields update error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
