import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // Auth via Bearer (flow implicit → JWT en localStorage, pas en cookie).
  // requireApprovedUser vérifie le JWT + is_approved ; on exige en plus le
  // rôle admin. Aucune écriture Airtable / aucun revalidateTag ici → zéro
  // write ISR ajouté.
  const auth = await requireApprovedUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.is_approved === 'boolean') patch.is_approved = body.is_approved;
  if (body.role === 'admin' || body.role === 'user') patch.role = body.role;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  // Écriture sous RLS via le client authentifié de l'appelant (policy
  // "Admin updates" / is_admin()).
  const { error } = await auth.supabase
    .from('portfolio_profiles')
    .update(patch)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
