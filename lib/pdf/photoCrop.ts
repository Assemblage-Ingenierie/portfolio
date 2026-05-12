/**
 * Crop non-destructif d'une photo, stocké en pourcentage de l'image source.
 * On ne touche jamais à l'image originale (Airtable attachment) — le crop est
 * appliqué au rendu via CSS (clip-path / overflow + transform) côté HTML PDF.
 *
 * Objectif d'usage : aligner les bords horizontaux de plusieurs photos
 * placées côte à côte dans la fiche A4.
 */
export interface CropData {
  unit: '%';
  x: number;       // 0..100  offset gauche du crop dans l'image
  y: number;       // 0..100  offset haut du crop dans l'image
  width: number;   // 0..100  largeur du crop
  height: number;  // 0..100  hauteur du crop
}

/** Identifiant stable pour mapper un crop à une photo. On utilise le filename
 *  (présent sur tous les attachments Airtable) ; fallback URL si absent. */
export function photoCropKey(photo: { url: string; filename?: string }): string {
  return photo.filename ?? photo.url;
}

/** Un crop est "meaningful" s'il rogne réellement quelque chose. Permet
 *  d'éviter de générer du CSS inutile pour les photos non recadrées. */
export function isMeaningfulCrop(c: CropData | undefined | null): c is CropData {
  if (!c) return false;
  if (c.unit !== '%') return false;
  return !(c.x <= 0.01 && c.y <= 0.01 && c.width >= 99.99 && c.height >= 99.99);
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Rendu HTML d'une image avec crop non destructif via SVG + viewBox.
 *
 * Pourquoi SVG plutôt qu'un div avec aspect-ratio + transform ?
 * — Le slider Taille de la sidebar applique `max-height: var(--cell-max)`
 *   sur `.photo-img`. Avec une `<div>` + `aspect-ratio`, quand max-height
 *   clamp la hauteur, la width ne shrink PAS proportionnellement (la spec
 *   CSS ne le garantit pas), donc la box devient mal proportionnée et
 *   l'image est aplatie.
 * — L'`<img>` original évitait ça via `object-fit: contain` qui letterbox
 *   l'image dans la box (même mal proportionnée) en gardant son aspect.
 * — SVG est l'équivalent sémantique exact : `viewBox` définit la zone
 *   visible, `preserveAspectRatio="xMidYMid meet"` = `object-fit: contain`
 *   natif. Quel que soit le shape de la box (clamp max-width et/ou
 *   max-height), le contenu garde son aspect, letterboxé si besoin.
 *
 * On garde la classe `photo-img` pour que les règles CSS des templates
 * (transforms, max-height variables, etc.) continuent de s'appliquer.
 */
export function croppedPhotoHtml(
  photo: { url: string; filename?: string; width?: number; height?: number },
  alt: string,
  crop: CropData,
): string {
  const cw = Math.max(0.01, crop.width);
  const ch = Math.max(0.01, crop.height);
  const cx = Math.max(0, crop.x);
  const cy = Math.max(0, crop.y);

  // Cas standard : on connaît les dimensions natives Airtable → on peut
  // construire un viewBox en pixels image, sémantiquement parfait.
  if (photo.width && photo.height) {
    const vbX = (cx * photo.width) / 100;
    const vbY = (cy * photo.height) / 100;
    const vbW = (cw * photo.width) / 100;
    const vbH = (ch * photo.height) / 100;

    return `<svg class="photo-cropped photo-img" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" overflow="hidden" role="img" aria-label="${esc(alt)}" style="overflow:hidden"><image href="${esc(photo.url)}" x="0" y="0" width="${photo.width}" height="${photo.height}" /></svg>`;
  }

  // Fallback : pas de dims natives → on utilise un viewBox arbitraire et
  // l'image SVG remplit ce viewBox via preserveAspectRatio="none" (l'image
  // intrinsèque a la même aspect que la zone cropée, donc pas de distorsion
  // visuelle). Moins propre que le cas standard mais reste robuste.
  return `<svg class="photo-cropped photo-img" viewBox="${cx} ${cy} ${cw} ${ch}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(alt)}"><image href="${esc(photo.url)}" x="0" y="0" width="100" height="100" preserveAspectRatio="none" /></svg>`;
}
