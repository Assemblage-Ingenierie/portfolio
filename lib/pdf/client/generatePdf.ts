'use client';

import type { Projet } from '@/types/projet';
import type { jsPDF as JsPDFType } from 'jspdf';
import { authHeaders } from '@/lib/supabase/authHeaders';

let _loaded = false;

async function ensureJsPDF(): Promise<void> {
  if (_loaded) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => { _loaded = true; resolve(); };
    s.onerror = () => reject(new Error('Impossible de charger jsPDF'));
    document.head.appendChild(s);
  });
}

async function fetchImageBase64(imageUrl: string): Promise<string | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`, { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateAndDownloadPdf(projet: Projet): Promise<void> {
  await ensureJsPDF();

  // Pre-fetch all images in parallel
  const photoUrls = [
    projet.photoCouverture?.url,
    ...(projet.photosProjet ?? []).slice(0, 3).map(p => p.url),
  ].filter((u): u is string => Boolean(u));

  const images: Record<string, string> = {};
  await Promise.all(
    photoUrls.map(async (url) => {
      const b64 = await fetchImageBase64(url);
      if (b64) images[url] = b64;
    })
  );

  const { jsPDF } = (window as unknown as { jspdf: { jsPDF: typeof JsPDFType } }).jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const { registerFonts } = await import('./fonts');
  await registerFonts(doc);

  // Mapping legacy : Mosaïque/Galerie → magazine, autres → editorial.
  // (À terme ce flux client jsPDF sera remplacé par la route PDF serveur paged.js.)
  const isMagazineLike = projet.template === 'Mosaïque' || projet.template === 'Galerie';
  if (isMagazineLike) {
    const { drawMagazine } = await import('./layouts/magazine');
    drawMagazine(doc, projet, images);
  } else {
    const { drawEditorial } = await import('./layouts/editorial');
    drawEditorial(doc, projet, images);
  }

  const filename = `${projet.affaire || projet.slug}.pdf`;
  doc.save(filename);
}
