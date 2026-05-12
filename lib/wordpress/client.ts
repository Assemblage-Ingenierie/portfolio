function wpApi(): string {
  // Accepte indifféremment `https://site.tld` ou `https://site.tld/wp-json/wp/v2`
  // pour éviter que les requêtes finissent en `/wp-json/wp/v2/wp-json/wp/v2/...`
  // (cause de publications qui n'arrivent jamais en brouillon).
  const base = process.env.WP_BASE_URL!.replace(/\/$/, '').replace(/\/wp-json\/wp\/v2$/, '');
  return `${base}/wp-json/wp/v2`;
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
}

export async function createOrUpdatePost(
  payload: WpPostPayload,
  existingPostId?: number
): Promise<{ id: number; url: string; status: string; type: string; author: number }> {
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
  let data: { id?: number; link?: string; status?: string; type?: string; author?: number };
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
    status: data.status ?? 'unknown',
    type: data.type ?? 'unknown',
    author: data.author ?? 0,
  };
}

export function extractWpPostId(url: string): number | undefined {
  const match = url.match(/[?&]p=(\d+)/);
  if (match) return parseInt(match[1], 10);
  return undefined;
}
