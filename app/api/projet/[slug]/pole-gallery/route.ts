import { NextRequest, NextResponse } from 'next/server';
import { getProjet } from '@/lib/airtable';
import {
  findPublishedPostBySlug,
  getPostContent,
  addProjetToPoleGalleries,
  pfgGalleriesForPoles,
} from '@/lib/wordpress';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';

/**
 * POST /api/projet/[slug]/pole-gallery
 *
 * Ajoute le projet sur sa/ses page(s) de pôle WordPress (galeries Portfolio
 * Filter Gallery), indépendamment du flux « Mettre à jour la production ».
 *
 * - Le pôle vient de `projet.vignettePoles` (champ Airtable « Vignette pôle ») ;
 *   un projet multi-pôle est ajouté dans chaque galerie correspondante.
 * - La tuile = image à la une du post publié + nom + lieu + lien vers l'URL prod.
 * - Nécessite une version PUBLIÉE (lookup par slug) : la tuile doit pointer vers
 *   un article public, pas un brouillon.
 *
 * Réponses :
 *   - 404 si aucune version publiée n'existe pour ce slug
 *   - 422 si le projet n'a aucune Vignette pôle exploitable
 *   - 200 { results: PoleGalleryResult[] } sinon
 */
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

  const targets = pfgGalleriesForPoles(projet.vignettePoles);
  if (targets.length === 0) {
    return NextResponse.json(
      { error: 'Aucun pôle exploitable sur ce projet (champ « Vignette pôle » vide). Renseigne STR / ENV / DEV.' },
      { status: 422 }
    );
  }

  try {
    const prod = await findPublishedPostBySlug(slug);
    if (!prod) {
      return NextResponse.json(
        { error: "Aucune version publiée trouvée pour cette fiche. Publie d'abord l'article en production, puis réessaie." },
        { status: 404 }
      );
    }

    // L'image de tuile = image à la une du post publié.
    const content = await getPostContent(prod.id);
    const imageId = content.featured_media;
    if (!imageId) {
      return NextResponse.json(
        { error: "L'article publié n'a pas d'image à la une — impossible de créer la tuile." },
        { status: 422 }
      );
    }

    const results = await addProjetToPoleGalleries(projet, { link: prod.url, imageId });
    console.log('[WP-POLE-GALLERY]', { slug, prodId: prod.id, results });

    return NextResponse.json({ ok: true, prodUrl: prod.url, results });
  } catch (err) {
    console.error('pole-gallery error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
