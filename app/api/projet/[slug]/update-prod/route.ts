import { NextRequest, NextResponse } from 'next/server';
import { getProjet } from '@/lib/airtable';
import {
  createOrUpdatePost,
  extractWpPostId,
  findPublishedPostBySlug,
  getPostContent,
  addProjetToPoleGalleries,
  type PoleGalleryResult,
} from '@/lib/wordpress';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';

/**
 * POST /api/projet/[slug]/update-prod
 *
 * Promeut le contenu du dernier brouillon créé (tracké dans
 * `projet.urlWordpress` — l'URL du dernier draft retournée par /publish)
 * vers le post de production WP existant (recherché par slug + status=publish).
 *
 * Comportement :
 *   - 400 si aucun draft URL n'est tracké dans Airtable (faire un /publish d'abord)
 *   - 404 si aucune version publiée n'existe pour ce slug (publier manuellement
 *     un draft via WP admin d'abord)
 *   - 200 avec { prodUrl, prodId, draftUrl, draftId } sinon
 *
 * Le draft d'origine reste en place — c'est l'utilisateur qui décide de le
 * supprimer une fois la promotion validée (cf. workflow draft/preview/promotion).
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

  const draftUrlFromAirtable = projet.urlWordpress;
  if (!draftUrlFromAirtable) {
    return NextResponse.json(
      {
        error:
          "Aucun brouillon à promouvoir. Lance d'abord Export WP 1 pour créer un brouillon.",
      },
      { status: 400 }
    );
  }

  const draftId = extractWpPostId(draftUrlFromAirtable);
  if (!draftId) {
    return NextResponse.json(
      {
        error:
          "URL de brouillon Airtable invalide (format ?p=<id> attendu). Relance Export WP 1.",
      },
      { status: 400 }
    );
  }

  try {
    // 1. Récupère le post de production via lookup slug + status=publish
    const prod = await findPublishedPostBySlug(slug);
    if (!prod) {
      return NextResponse.json(
        {
          error:
            "Aucune version publiée trouvée pour cette fiche. Publie d'abord un brouillon en production via WP admin, puis réessaie.",
        },
        { status: 404 }
      );
    }

    // 2. Récupère le contenu du brouillon validé (context=edit pour avoir le raw HTML)
    const draftContent = await getPostContent(draftId);

    // 3. PATCH le post de production avec ce contenu. On ne touche pas au
    //    status (reste 'publish'), on ne touche pas au slug (préserve l'URL
    //    SEO de la production). Title / content / excerpt / featured_media
    //    sont remplacés par ceux du draft.
    const updated = await createOrUpdatePost(
      {
        title: draftContent.title,
        slug: projet.slug,
        content: draftContent.content,
        excerpt: draftContent.excerpt,
        // status omis explicitement = WP conserve 'publish' sur un post déjà publié
        status: 'publish',
        featured_media: draftContent.featured_media,
      },
      prod.id
    );

    console.log('[WP-UPDATE-PROD]', {
      slug,
      draftId,
      prodId: prod.id,
      updatedId: updated.id,
      updatedStatus: updated.status,
    });

    // 4. Ajout (non-bloquant) du projet sur sa/ses page(s) de pôle. Un échec
    //    galerie NE DOIT PAS faire échouer la promotion en production.
    let gallery: PoleGalleryResult[] | undefined;
    try {
      gallery = await addProjetToPoleGalleries(projet, {
        link: updated.url,
        imageId: draftContent.featured_media ?? 0,
      });
      console.log('[WP-UPDATE-PROD] gallery', gallery);
    } catch (galErr) {
      console.warn('Ajout galerie pôle échoué (non-fatal):', galErr);
    }

    return NextResponse.json({
      prodId: updated.id,
      prodUrl: updated.url,
      draftId,
      draftUrl: draftUrlFromAirtable,
      gallery,
    });
  } catch (err) {
    console.error('Update-prod error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
