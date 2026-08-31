import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getProjet, updateProjetUrl, updateProjetFields } from '@/lib/airtable';
import { PROJETS_LIST_TAG, projetTag } from '@/lib/airtable/queries';
import { uploadMedia, createOrUpdatePost, ensureCategoryIds, releaseCanonicalSlug } from '@/lib/wordpress';
import { addProjetToPoleGalleries, pfgGalleriesForPoles } from '@/lib/wordpress/poleGallery';
import { buildWpContent } from '@/lib/wordpress/builders';
import { buildWpContentV2 } from '@/lib/wordpress/buildersV2';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';

/**
 * Valeur de la meta `post_layout` du thème « architecturer » (ThemeGoods).
 * C'est le libellé exact du menu « Post Options → Post Layout » côté wp-admin —
 * les autres choix sont « With Left Sidebar » et « Fullwidth ».
 */
const WP_POST_LAYOUT = 'With Right Sidebar';

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

  // Une photo de couverture est obligatoire : elle sert d'image à la une du
  // post WP et de vignette sur les pages de pôle. Sans elle, on aurait un post
  // sans featured_media et une tuile galerie cassée (cf. update-prod). On bloque
  // donc l'export tôt avec un message actionnable.
  if (!projet.photoCouverture?.url) {
    return NextResponse.json(
      { error: 'Photo de couverture manquante : ajoute au moins une image dans le champ « Photo couverture » de la fiche Airtable avant de publier.' },
      { status: 422 }
    );
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
    //
    //    4bis. On libère d'abord le slug canonique, sinon WP suffixe le
    //    nouveau brouillon en -2 / -3 / -4 (un brouillon d'export précédent
    //    détient déjà `post_name`). Un slug suffixé casse ensuite le lookup
    //    par slug de /update-prod et /pole-gallery. Les brouillons squatteurs
    //    sont renommés `<slug>-brouillon-<id>` ; un post PUBLIÉ n'est jamais
    //    touché (son permalien est l'URL SEO de production).
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

    // Metas envoyées au post WordPress.
    //
    // ⚠ Une meta n'est persistée QUE si sa clé est enregistrée côté WP avec
    // `register_post_meta(..., show_in_rest: true)`. Sinon l'API REST l'ignore
    // EN SILENCE — aucune erreur, la valeur disparaît. Cf.
    // docs/wordpress/post-meta-register-snippet.php.
    const postMeta: Record<string, string> = {
      // SEO Yoast : focus keyphrase = nom du projet ; méta description = champ
      // aiText Airtable « Méta description SEO ».
      _yoast_wpseo_focuskw: projet.nom,
      // Mise en page de l'article, lue par le thème « architecturer »
      // (ThemeGoods) — metabox « Post Options → Post Layout ».
      //
      // Indispensable depuis la publication directe : le thème n'a AUCUN défaut
      // global pour un article seul (le Customizer ne couvre que les pages
      // d'archive / catégorie / tag). Meta absente ⇒ rendu en pleine largeur,
      // donc SANS le menu latéral. Auparavant la valeur était écrite par
      // l'éditeur wp-admin lors de la publication manuelle ; ce passage a
      // disparu du workflow, d'où la régression.
      //
      // ⚠ La valeur attendue est le LIBELLÉ affiché dans le menu déroulant du
      // thème, pas un slug. Vérifié sur les articles existants :
      // `post_layout = "With Right Sidebar"`. Changer de thème = revoir ceci.
      post_layout: WP_POST_LAYOUT,
    };
    if (projet.metaDescription) postMeta._yoast_wpseo_metadesc = projet.metaDescription;
    console.log('[WP-PUBLISH] meta', { focuskw: projet.nom, hasMetadesc: !!projet.metaDescription, post_layout: WP_POST_LAYOUT });

    let slugWarning: string | undefined;
    try {
      const { freed, publishedHolder } = await releaseCanonicalSlug(projet.slug);
      console.log('[WP-PUBLISH] slug', { canonical: projet.slug, freed, holder: publishedHolder?.id });
      if (publishedHolder) {
        // NB : « Mettre à jour la production » n'existe plus (retiré le
        // 31/08/26). Avec la publication directe, le remède est de supprimer
        // l'ancien article dans wp-admin AVANT de réexporter.
        slugWarning =
          `Le slug « ${projet.slug} » est déjà pris par l'article publié #${publishedHolder.id} : ` +
          `le nouvel article recevra un suffixe -2, ce qui dégrade son URL SEO. ` +
          `Supprime l'ancien article dans wp-admin, puis relance l'export.`;
      }
    } catch (slugErr) {
      // Non bloquant : au pire WP suffixe le slug comme avant.
      console.warn('Libération du slug canonique échouée (non-fatal):', slugErr);
    }

    const previousUrl = projet.urlWordpress;
    const { id, url, slug: wpSlug, status, type, author } = await createOrUpdatePost({
      title: projet.nom,
      slug: projet.slug,
      content,
      excerpt: projet.pitch,
      // Publication DIRECTE (choix 31/08/26). L'ancien flux creait un brouillon
      // qu'il fallait publier a la main dans wp-admin ; l'apercu de la fiche
      // (/projet/[slug]/wordpress) remplace desormais le brouillon comme etape
      // de relecture. Pour remplacer un article existant, le workflow retenu est
      // de SUPPRIMER l'ancien dans wp-admin avant de reexporter (sinon WordPress
      // suffixe le slug en -2 et le slugWarning ci-dessous le signale).
      status: 'publish',
      featured_media: coverId,
      categories,
      meta: postMeta,
    });
    console.log('[WP-PUBLISH]', { id, status, type, author, url, wpSlug, previousUrl });

    // Filet : si WP a quand même suffixé (course, brouillon non libérable…),
    // on le remonte à l'UI plutôt que de le découvrir au moment du lookup.
    if (!slugWarning && wpSlug && wpSlug !== projet.slug) {
      slugWarning = `WordPress a attribué le slug « ${wpSlug} » au lieu de « ${projet.slug} ».`;
    }

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

    // Statut de fiche → « Publié ». L'article etant en ligne, le panneau
    // « Etat de publication » de la home doit le refleter sans action manuelle.
    // updateProjetFields fait un merge du ProjectConfig : les cles bandeau /
    // manuel / wp / photoCrops sont preservees.
    //
    // NON BLOQUANT comme le reste des ecritures Airtable : l'article est deja
    // publie, un echec ici ne doit pas transformer la reponse en erreur.
    //
    // ⚠ « Publié » VERROUILLE la mise en page (cf. isFicheLocked). Pour
    // corriger une fiche publiee, passer le statut a « À mettre à jour ».
    let statusWarning: string | undefined;
    try {
      await updateProjetFields(slug, { ficheStatus: 'Publié' });
      // ficheStatus alimente le decompte par statut de la home → il faut
      // invalider la LISTE, pas seulement la fiche.
      revalidateTag(projetTag(slug), 'max');
      revalidateTag(PROJETS_LIST_TAG, 'max');
    } catch (statusErr) {
      console.warn('Passage du statut de fiche a « Publié » echoue (non-fatal):', statusErr);
      statusWarning = 'Statut de fiche non mis a jour (« Publié »)';
    }

    // 6. Ajout aux galeries de pole, dans la continuite de la publication.
    //    NON BLOQUANT (choix 31/08/26) : si l'etape echoue, l'article reste
    //    publie et on remonte un avertissement — a l'utilisateur de reessayer
    //    via le bouton « Ajouter a la page pole ».
    //
    //    Deux NON-erreurs signalees explicitement, sinon elles passent en
    //    silence : « Vignette pole » vide (aucune galerie cible) et absence de
    //    photo de couverture (une tuile PFG exige une image).
    let poleResults: Awaited<ReturnType<typeof addProjetToPoleGalleries>> | undefined;
    let galleryWarning: string | undefined;
    const poleTargets = pfgGalleriesForPoles(projet.vignettePoles);
    if (poleTargets.length === 0) {
      galleryWarning = 'Aucune page pole ciblee : le champ « Vignette pole » est vide.';
    } else if (!coverId) {
      galleryWarning = "Pages pole ignorees : la fiche n'a pas de photo de couverture.";
    } else {
      try {
        poleResults = await addProjetToPoleGalleries(projet, { link: url, imageId: coverId });
        // Seul `error` marque un ECHEC. `added: false` sans erreur signifie
        // « tuile deja presente » : l'endpoint /pfg/append est idempotent, et
        // c'est le cas normal d'un reexport. Ne pas confondre les deux, sinon
        // on avertit a tort a chaque republication.
        const failed = poleResults.filter((g) => g.error);
        if (failed.length > 0) {
          galleryWarning = 'Page(s) pole non mise(s) a jour : '
            + failed.map((g) => `${g.label} (${g.error ?? g.reason ?? 'raison inconnue'})`).join(', ')
            + ". L'article reste publie — reessayer avec « Ajouter a la page pole ».";
        }
      } catch (poleErr) {
        console.warn('Ajout aux galeries de pole echoue (non-fatal):', poleErr);
        galleryWarning = 'Ajout aux pages pole echoue : '
          + (poleErr instanceof Error ? poleErr.message : 'erreur inconnue')
          + ". L'article reste publie.";
      }
    }

    return NextResponse.json({
      id, url, status, type, author, previousUrl,
      // Resultat par page pole (meme forme que la reponse de /pole-gallery,
      // que l'UI sait deja afficher via poleResultsSummary).
      gallery: poleResults,
      warning: [airtableWarning, statusWarning, slugWarning, galleryWarning].filter(Boolean).join(' — ') || undefined,
      // Slug réellement attribué par WP (doit être égal au slug Airtable).
      wpSlug, slugSuffixed: !!wpSlug && wpSlug !== projet.slug,
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
