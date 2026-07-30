function wpSiteRoot(): string {
  // Racine du site, sans suffixe `/wp-json/...` — accepte `https://site.tld`
  // ou `https://site.tld/wp-json/wp/v2`.
  return process.env.WP_BASE_URL!.replace(/\/$/, '').replace(/\/wp-json\/wp\/v2$/, '');
}

function wpApi(): string {
  // Accepte indifféremment `https://site.tld` ou `https://site.tld/wp-json/wp/v2`
  // pour éviter que les requêtes finissent en `/wp-json/wp/v2/wp-json/wp/v2/...`
  // (cause de publications qui n'arrivent jamais en brouillon).
  return `${wpSiteRoot()}/wp-json/wp/v2`;
}

function authHeaders(): Record<string, string> {
  const user = process.env.WP_USER ?? '';
  const pass = (process.env.WP_APP_PASSWORD ?? '').replace(/\s/g, '');
  const token = Buffer.from(`${user}:${pass}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

function mimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', gif: 'image/gif',
    webp: 'image/webp',
  };
  return map[ext] ?? 'image/jpeg';
}

export async function uploadMedia(
  imageUrl: string,
  filename: string
): Promise<{ id: number; url: string }> {
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageUrl}`);
  const buffer = await imageRes.arrayBuffer();

  const res = await fetch(`${wpApi()}/media`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': mimeType(filename),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WP media upload failed: ${err}`);
  }

  const data = await res.json();
  return { id: data.id, url: data.source_url };
}

interface WpPostPayload {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: 'draft' | 'publish';
  featured_media?: number;
  /** IDs de catégories WordPress à cocher sur le post (taxonomie). */
  categories?: number[];
  /** Post meta (ex. champs Yoast `_yoast_wpseo_focuskw` / `_yoast_wpseo_metadesc`).
   *  ⚠ N'est persisté que si la meta key est enregistrée pour le REST côté WP
   *  (register_post_meta avec show_in_rest:true) — sinon WP l'ignore. */
  meta?: Record<string, string>;
}

/**
 * Résout une liste de NOMS de catégories vers leurs IDs WordPress, en créant
 * les catégories manquantes. Utilisé à l'export pour cocher les catégories du
 * post (panneau « Catégories ») depuis le champ Airtable « Tags export WP ».
 *
 * Tolérant aux erreurs : une catégorie qui échoue est simplement ignorée
 * (l'export ne doit jamais planter à cause d'une catégorie).
 */
export async function ensureCategoryIds(names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    try {
      // 1. Chercher une catégorie existante (match exact insensible à la casse).
      const searchRes = await fetch(
        `${wpApi()}/categories?search=${encodeURIComponent(name)}&per_page=100`,
        { headers: authHeaders() }
      );
      if (searchRes.ok) {
        const arr = await searchRes.json();
        if (Array.isArray(arr)) {
          const match = arr.find(
            (c) => typeof c?.name === 'string' && c.name.toLowerCase() === name.toLowerCase()
          );
          if (match && typeof match.id === 'number') {
            ids.push(match.id);
            continue;
          }
        }
      }
      // 2. Créer la catégorie si elle n'existe pas.
      const createRes = await fetch(`${wpApi()}/categories`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await createRes.json().catch(() => null);
      if (createRes.ok && data && typeof data.id === 'number') {
        ids.push(data.id);
      } else {
        // WP renvoie 400 `term_exists` avec l'ID existant si une course a créé
        // la catégorie entre-temps — on le récupère.
        const existing = data?.data?.term_id ?? data?.data?.resource_id;
        if (typeof existing === 'number') ids.push(existing);
        else console.warn('[WP] catégorie non résolue:', name, JSON.stringify(data)?.slice(0, 200));
      }
    } catch (e) {
      console.warn('[WP] ensureCategoryIds erreur pour', name, e);
    }
  }
  return ids;
}

/** Statuts interrogeables en une requête (tous sauf `trash`, dont WP suffixe
 *  déjà le post_name en `__trashed` — il ne bloque donc aucun slug). */
const WP_LIVE_STATUSES = 'publish,future,draft,pending,private';

export interface WpPostRef {
  id: number;
  slug: string;
  status: string;
  url: string;
}

/**
 * Liste les posts (tous statuts vivants) qui portent EXACTEMENT ce slug.
 *
 * WordPress n'a pas de « compteur de versions » : à chaque insertion,
 * `wp_unique_post_slug()` teste `post_name` contre les autres posts du même
 * post_type et incrémente `-2`, `-3`… jusqu'à trouver un libre. Un seul post
 * vivant suffit donc à décaler le slug — d'où cette vérification préalable.
 */
export async function findPostsBySlug(slug: string): Promise<WpPostRef[]> {
  const url =
    `${wpApi()}/posts?slug=${encodeURIComponent(slug)}` +
    `&status=${WP_LIVE_STATUSES}&per_page=100&context=edit&_fields=id,slug,status,link`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WP findPostsBySlug ${res.status}: ${err.slice(0, 200)}`);
  }
  const arr = await res.json();
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((p) => typeof p?.id === 'number' && typeof p?.slug === 'string')
    .map((p) => ({ id: p.id, slug: p.slug, status: p.status ?? 'unknown', url: p.link ?? '' }));
}

/**
 * Libère le slug canonique d'une fiche AVANT de créer un nouveau brouillon,
 * pour que WordPress n'ait pas à le suffixer en `-2` / `-3` / `-4`.
 *
 * Les brouillons d'export précédents (qui squattent le slug) sont renommés en
 * `<slug>-brouillon-<id>`. On ne touche JAMAIS à un post publié : son
 * permalien est l'URL SEO de production, et c'est lui que le lookup doit
 * continuer de trouver.
 *
 * @returns `freed` = ids des brouillons renommés ; `publishedHolder` = le post
 *          publié qui détient le slug canonique, s'il existe (dans ce cas le
 *          nouveau brouillon recevra fatalement un suffixe).
 */
export async function releaseCanonicalSlug(
  slug: string
): Promise<{ freed: number[]; publishedHolder?: WpPostRef }> {
  const holders = await findPostsBySlug(slug);
  const freed: number[] = [];
  let publishedHolder: WpPostRef | undefined;

  for (const holder of holders) {
    if (holder.status === 'publish' || holder.status === 'future' || holder.status === 'private') {
      publishedHolder = holder;
      continue;
    }
    const res = await fetch(`${wpApi()}/posts/${holder.id}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: `${slug}-brouillon-${holder.id}` }),
    });
    if (res.ok) freed.push(holder.id);
    else console.warn('[WP] slug non libéré pour le post', holder.id, (await res.text()).slice(0, 200));
  }

  return { freed, publishedHolder };
}

export async function createOrUpdatePost(
  payload: WpPostPayload,
  existingPostId?: number
): Promise<{ id: number; url: string; slug: string; status: string; type: string; author: number }> {
  const endpoint = existingPostId
    ? `${wpApi()}/posts/${existingPostId}`
    : `${wpApi()}/posts`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`WP post ${res.status}: ${raw.slice(0, 400)}`);
  }
  // Si WP renvoie du HTML (mauvaise URL, intercepteur), on attrape ici plutôt
  // que de laisser un SyntaxError silencieux remonter.
  let data: { id?: number; link?: string; slug?: string; status?: string; type?: string; author?: number };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`WP post a renvoyé du non-JSON (status ${res.status}): ${raw.slice(0, 200)}`);
  }
  if (!data.id || !data.link) {
    throw new Error(`WP post: réponse incomplète — ${JSON.stringify(data).slice(0, 300)}`);
  }
  return {
    id: data.id,
    url: data.link,
    slug: data.slug ?? '',
    status: data.status ?? 'unknown',
    type: data.type ?? 'unknown',
    author: data.author ?? 0,
  };
}

/**
 * Ajoute une tuile à une galerie « Portfolio Filter Gallery Premium » via
 * l'endpoint custom `POST /wp-json/assemblage/v1/pfg/append` (snippet Code
 * Snippets, cf. docs/wordpress/pfg-append-snippet.php).
 *
 * L'endpoint est idempotent (pas de doublon par lien) et borné à l'allowlist
 * des galeries de pôle côté WP. Renvoie `{ added, reason?, total? }`.
 */
export async function appendToPoleGallery(payload: {
  galleryId: number;
  imageId: number;
  title: string;
  description: string;
  link: string;
  /** Ids de filtres PFG à assigner à la tuile (facultatif). */
  filters?: number[];
}): Promise<{ added: boolean; reason?: string; total?: number }> {
  const res = await fetch(`${wpSiteRoot()}/wp-json/assemblage/v1/pfg/append`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`PFG append ${res.status}: ${raw.slice(0, 300)}`);
  }
  let data: { added?: boolean; reason?: string; total?: number };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`PFG append a renvoyé du non-JSON (status ${res.status}): ${raw.slice(0, 200)}`);
  }
  return { added: Boolean(data.added), reason: data.reason, total: data.total };
}

export function extractWpPostId(url: string): number | undefined {
  const match = url.match(/[?&]p=(\d+)/);
  if (match) return parseInt(match[1], 10);
  return undefined;
}

/**
 * Trouve un post publié par son slug exact. Renvoie `undefined` si aucun
 * post ne matche.
 *
 * Note WP : l'endpoint `/posts?slug=...` est insensible au statut par défaut,
 * mais on filtre explicitement `status=publish` pour ne récupérer que la
 * version en production (et pas un draft homonyme par exemple).
 */
export async function findPublishedPostBySlug(
  slug: string
): Promise<{ id: number; url: string } | undefined> {
  const url = `${wpApi()}/posts?slug=${encodeURIComponent(slug)}&status=publish&per_page=1`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WP findPublishedPostBySlug ${res.status}: ${err.slice(0, 200)}`);
  }
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const first = arr[0];
  if (typeof first?.id !== 'number' || typeof first?.link !== 'string') return undefined;
  return { id: first.id, url: first.link };
}

/**
 * Trouve le post WP de PRODUCTION d'une fiche, en deux passes :
 *
 *  1. lookup par slug canonique (`status=publish`) — le cas nominal ;
 *  2. sinon, le post tracké dans Airtable (`urlWordpress` → `?p=<id>`), s'il
 *     est passé en `publish`.
 *
 * La passe 2 couvre le cas réel où l'utilisateur publie un brouillon à la main
 * depuis wp-admin : le brouillon avait hérité d'un slug suffixé (`-2`, `-3`…),
 * donc son permalien de production ne correspond plus au slug Airtable. On
 * s'appuie sur l'ID exact plutôt que sur un match `-\d+` approximatif, qui
 * confondrait deux fiches homonymes (`mon-projet` vs `mon-projet-2`).
 */
export async function findProductionPost(
  slug: string,
  trackedUrl?: string
): Promise<{ id: number; url: string } | undefined> {
  const bySlug = await findPublishedPostBySlug(slug);
  if (bySlug) return bySlug;

  const trackedId = trackedUrl ? extractWpPostId(trackedUrl) : undefined;
  if (!trackedId) return undefined;

  const res = await fetch(
    `${wpApi()}/posts/${trackedId}?context=edit&_fields=id,status,link`,
    { headers: authHeaders() }
  );
  if (!res.ok) return undefined;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'publish' || typeof data?.id !== 'number' || typeof data?.link !== 'string') {
    return undefined;
  }
  return { id: data.id, url: data.link };
}

/**
 * Récupère le contenu d'un post WP par son ID. Utilisé pour copier le
 * contenu d'un brouillon validé vers le post de production.
 *
 * On force `context=edit` parce que `content.rendered` (context=view) est
 * post-traité par WP (wpautop, shortcodes) alors qu'on veut le HTML brut
 * tel qu'il a été enregistré.
 */
export async function getPostContent(
  id: number
): Promise<{ title: string; content: string; excerpt: string; featured_media?: number }> {
  const url = `${wpApi()}/posts/${id}?context=edit`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WP getPostContent ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    title: data?.title?.raw ?? data?.title?.rendered ?? '',
    content: data?.content?.raw ?? data?.content?.rendered ?? '',
    excerpt: data?.excerpt?.raw ?? data?.excerpt?.rendered ?? '',
    featured_media: typeof data?.featured_media === 'number' ? data.featured_media : undefined,
  };
}
