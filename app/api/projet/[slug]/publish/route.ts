import { NextRequest, NextResponse } from 'next/server';
import { getProjet, updateProjetUrl } from '@/lib/airtable';
import { uploadMedia, createOrUpdatePost, extractWpPostId } from '@/lib/wordpress';
import { buildWpContent } from '@/lib/wordpress/builders';
import { buildWpContentV2 } from '@/lib/wordpress/buildersV2';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';

const ALLOWED_IMAGE_HOSTS = ['dl.airtable.com', 'v5.airtableusercontent.com', 'airtableusercontent.com'];

function isAllowedImageUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_IMAGE_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth;

  const { slug } = await params;
  const projet = await getProjet(slug);

  if (!projet) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
  }

  // Variante de mise en page : v1 (par défaut) ou v2
  let variant: 'v1' | 'v2' = 'v1';
  try {
    const body = await req.json();
    if (body?.variant === 'v2') variant = 'v2';
  } catch {
    // Pas de body — variante v1 par défaut
  }

  try {
    // 1. Upload cover photo
    let coverId: number | undefined;
    let coverUrl: string | undefined;
    if (projet.photoCouverture) {
      if (!isAllowedImageUrl(projet.photoCouverture.url)) {
        return NextResponse.json({ error: 'URL de couverture non autorisée' }, { status: 400 });
      }
      const uploaded = await uploadMedia(projet.photoCouverture.url, `${slug}-cover.jpg`);
      coverId = uploaded.id;
      coverUrl = uploaded.url;
    }

    // 2. Upload project photos
    const photoUrls: string[] = [];
    for (let i = 0; i < (projet.photosProjet ?? []).length; i++) {
      const photo = projet.photosProjet![i];
      if (!isAllowedImageUrl(photo.url)) continue;
      const uploaded = await uploadMedia(photo.url, `${slug}-photo-${i + 1}.jpg`);
      photoUrls.push(uploaded.url);
    }

    // 3. Build styled WordPress HTML matching the defined layout
    const content = variant === 'v2'
      ? buildWpContentV2(projet, coverUrl, photoUrls)
      : buildWpContent(projet, coverUrl, photoUrls);

    // 4. Create or update post
    const existingId = projet.urlWordpress ? extractWpPostId(projet.urlWordpress) : undefined;
    const { id, url } = await createOrUpdatePost(
      {
        title: projet.nom,
        slug: projet.slug,
        content,
        excerpt: projet.pitch,
        status: 'draft',
        featured_media: coverId,
      },
      existingId
    );

    // 5. Write back URL to Airtable (non-blocking)
    let airtableWarning: string | undefined;
    try {
      await updateProjetUrl(slug, url);
    } catch (airtableErr) {
      console.warn('Airtable URL write-back failed (non-fatal):', airtableErr);
      airtableWarning = 'URL non sauvegardée dans Airtable';
    }

    return NextResponse.json({ id, url, warning: airtableWarning });
  } catch (err) {
    console.error('Publish error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
