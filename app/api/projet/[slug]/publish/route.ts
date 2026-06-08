import { NextRequest, NextResponse } from 'next/server';
import { getProjet, updateProjetUrl } from '@/lib/airtable';
import { uploadMedia, createOrUpdatePost, ensureCategoryIds } from '@/lib/wordpress';
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
    // 1. Upload cover photo (on préserve son filename Airtable pour que le
    //    builder retrouve les réglages utilisateur post-upload).
    let coverId: number | undefined;
    let cover: { url: string; filename: string } | undefined;
    let coverUrl: string | undefined;
    if (projet.photoCouverture) {
      if (!isAllowedImageUrl(projet.photoCouverture.url)) {
        return NextResponse.json({ error: 'URL de couverture non autorisée' }, { status: 400 });
      }
      const uploaded = await uploadMedia(projet.photoCouverture.url, `${slug}-cover.jpg`);
      coverId = uploaded.id;
      coverUrl = uploaded.url;
      cover = { url: uploaded.url, filename: projet.photoCouverture.filename };
    }

    // 2. Upload project photos (filename Airtable préservé).
    const photoUrls: string[] = [];
    const gallery: { url: string; filename: string }[] = [];
    for (let i = 0; i < (projet.photosProjet ?? []).length; i++) {
      const photo = projet.photosProjet![i];
      if (!isAllowedImageUrl(photo.url)) continue;
      const uploaded = await uploadMedia(photo.url, `${slug}-photo-${i + 1}.jpg`);
      photoUrls.push(uploaded.url);
      gallery.push({ url: uploaded.url, filename: photo.filename });
    }

    // 3. Build styled WordPress HTML matching the defined layout.
    //    V2 garde la signature historique (URLs simples) ; V1 prend les objets
    //    photos pour pouvoir appliquer les réglages par filename.
    const content = variant === 'v2'
      ? buildWpContentV2(projet, coverUrl, photoUrls)
      : buildWpContent(projet, cover, gallery, projet.wpConfig);

    // 4. TOUJOURS créer un nouveau draft.
    //    On ne réutilise jamais l'ID d'un post existant (extractWpPostId est
    //    volontairement abandonné ici), pour deux raisons :
    //    - garantir que le nouveau post apparaît systématiquement dans
    //      /wp-admin/edit.php (cf. cas "La maison sur le fleuve" où l'UPDATE
    //      sur post existant retournait status=draft/type=post valides mais
    //      le post restait invisible dans la liste — cause WP inconnue)
    //    - immuniser les exports contre toute modification accidentelle
    //      d'un post déjà publié en production (la mise à jour de la prod
    //      se fait via la route dédiée /update-prod, sur action explicite)
    //    Le code n'envoie JAMAIS status: 'trash' ni DELETE → impossibilité
    //    par construction de mettre un post existant à la corbeille.
    //    WP gère automatiquement les collisions de slug en suffixant
    //    -2, -3, etc. — chaque draft est donc unique et visible.
    // Catégories WordPress (panneau « Catégories ») depuis le champ Airtable
    // « Tags export WP ». Résolues en IDs (créées si manquantes). Non bloquant.
    let categories: number[] | undefined;
    let categoryIds: number[] = [];
    try {
      if (projet.tagsExportWp.length > 0) {
        categoryIds = await ensureCategoryIds(projet.tagsExportWp);
        if (categoryIds.length > 0) categories = categoryIds;
      }
    } catch (catErr) {
      console.warn('Catégories WP non assignées (non-fatal):', catErr);
    }
    console.log('[WP-PUBLISH] categories', { tags: projet.tagsExportWp, ids: categoryIds });

    // Méta SEO Yoast : focus keyphrase = nom du projet ; méta description =
    // champ aiText Airtable « Méta description SEO ». N'est persisté côté WP
    // que si les meta keys `_yoast_wpseo_*` sont enregistrées pour le REST
    // (register_post_meta show_in_rest) — sinon WP les ignore silencieusement.
    const seoMeta: Record<string, string> = { _yoast_wpseo_focuskw: projet.nom };
    if (projet.metaDescription) seoMeta._yoast_wpseo_metadesc = projet.metaDescription;
    console.log('[WP-PUBLISH] yoast meta', { focuskw: projet.nom, hasMetadesc: !!projet.metaDescription });

    const previousUrl = projet.urlWordpress;
    const { id, url, status, type, author } = await createOrUpdatePost({
      title: projet.nom,
      slug: projet.slug,
      content,
      excerpt: projet.pitch,
      status: 'draft',
      featured_media: coverId,
      categories,
      meta: seoMeta,
    });
    console.log('[WP-PUBLISH]', { id, status, type, author, url, previousUrl });

    // 5. Write back URL to Airtable (non-blocking). urlWordpress reflète
    //    désormais le DERNIER draft créé — utile à /update-prod pour
    //    retrouver le draft à promouvoir.
    let airtableWarning: string | undefined;
    try {
      await updateProjetUrl(slug, url);
    } catch (airtableErr) {
      console.warn('Airtable URL write-back failed (non-fatal):', airtableErr);
      airtableWarning = 'URL non sauvegardée dans Airtable';
    }

    return NextResponse.json({
      id, url, status, type, author, previousUrl, warning: airtableWarning,
      // Diagnostic catégories : noms demandés (Airtable) + nb d'IDs WP assignés.
      categoryNames: projet.tagsExportWp,
      categoryCount: categoryIds.length,
      // Diagnostic SEO Yoast (visible côté UI).
      focusKeyphrase: projet.nom,
      hasMetaDescription: !!projet.metaDescription,
    });
  } catch (err) {
    console.error('Publish error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
