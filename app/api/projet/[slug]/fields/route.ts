import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { updateProjetFields } from '@/lib/airtable';
import { PROJETS_TAG } from '@/lib/airtable/queries';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';
import type { ProjetEditableFields } from '@/lib/airtable';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireApprovedUser();
  if (auth instanceof NextResponse) return auth;

  const { slug } = await params;

  let body: ProjetEditableFields;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  try {
    const result = await updateProjetFields(slug, body);
    revalidateTag(PROJETS_TAG, 'max');
    return NextResponse.json({ ok: true, slug: result.slug });
  } catch (err) {
    // Log côté serveur uniquement — ne pas renvoyer le message brut au client
    // (les erreurs Airtable contiennent l'URL upstream avec le base id et autres
    // détails infrastructure).
    console.error('Fields update error:', err);
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 });
  }
}
