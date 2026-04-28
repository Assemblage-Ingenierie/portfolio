import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabase
    .from('portfolio_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.is_approved === 'boolean') patch.is_approved = body.is_approved;
  if (body.role === 'admin' || body.role === 'user') patch.role = body.role;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('portfolio_profiles')
    .update(patch)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
