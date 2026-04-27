const WP_BASE = process.env.WP_BASE_URL!.replace(/\/$/, '');
const WP_API = `${WP_BASE}/wp-json/wp/v2`;

function authHeaders(): Record<string, string> {
  return { 'X-Api-Key': process.env.WP_API_KEY ?? '' };
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

  const res = await fetch(`${WP_API}/media`, {
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
): Promise<{ id: number; url: string }> {
  const endpoint = existingPostId
    ? `${WP_API}/posts/${existingPostId}`
    : `${WP_API}/posts`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WP post failed: ${err}`);
  }

  const data = await res.json();
  return { id: data.id, url: data.link };
}

export function extractWpPostId(url: string): number | undefined {
  const match = url.match(/[?&]p=(\d+)/);
  if (match) return parseInt(match[1], 10);
  return undefined;
}
