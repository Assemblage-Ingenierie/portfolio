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
 * Rendu HTML d'une image avec crop CSS pur (non destructif).
 *
 * Principe : on construit un conteneur `aspect-ratio` égal au ratio du crop,
 * dans lequel l'image originale est agrandie à `100/cropW%` puis translatée
 * pour faire apparaître la zone voulue. Pas de canvas, pas de re-encodage.
 */
export function croppedPhotoHtml(
  photo: { url: string; filename?: string; width?: number; height?: number },
  alt: string,
  crop: CropData,
): string {
  // Sécurités numériques
  const cw = Math.max(0.01, crop.width);
  const ch = Math.max(0.01, crop.height);
  const cx = Math.max(0, crop.x);
  const cy = Math.max(0, crop.y);

  // Échelle interne : l'image devient (100 / cropWidth) × sa taille naturelle.
  // À 100 % la largeur du conteneur = la largeur du crop dans l'image scalée.
  const imgWidthPct = (100 / cw) * 100;
  const imgHeightPct = (100 / ch) * 100;

  // Aspect ratio du conteneur : on l'exprime à partir des dims natives si on
  // les a, sinon on tombe sur le ratio du crop pur (qui suffit dans 99 % des
  // cas pour un crop en %).
  let aspect: string;
  if (photo.width && photo.height) {
    const ratio = (photo.width * cw) / (photo.height * ch);
    aspect = `${ratio}`;
  } else {
    aspect = `${cw} / ${ch}`;
  }

  // Translation : on déplace l'image pour qu'à la position (cx, cy) on voit
  // le coin haut-gauche du conteneur. Comme l'image est scalée à 100/cw, une
  // translation en % de l'image (qui est elle-même 100/cw du conteneur)
  // équivaut à (cx · 100/cw)% du conteneur — mais translate(...%) sur l'img
  // utilise sa propre dimension : donc -cx% sur img = -(cx · 100/cw)%
  // visuel. C'est exactement ce qu'on veut.
  const tx = -((cx * 100) / cw);
  const ty = -((cy * 100) / ch);

  const containerStyle = [
    'position:relative',
    'overflow:hidden',
    'max-width:100%',
    'max-height:100%',
    `aspect-ratio:${aspect}`,
    'width:100%',
  ].join(';');

  const imgStyle = [
    'position:absolute',
    'top:0',
    'left:0',
    `width:${imgWidthPct}%`,
    `height:${imgHeightPct}%`,
    'max-width:none',
    'max-height:none',
    `transform:translate(${tx}%, ${ty}%)`,
    'transform-origin:top left',
    'display:block',
    'object-fit:fill',
  ].join(';');

  return `<div class="photo-cropped" style="${containerStyle}"><img src="${esc(photo.url)}" alt="${esc(alt)}" style="${imgStyle}" /></div>`;
}
