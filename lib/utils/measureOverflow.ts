/**
 * Mesure le débordement vertical du contenu d'une fiche projet par rapport
 * au cadre A4 (`.page`, hauteur fixée à 297mm via SHARED_CSS).
 *
 * Combine deux signaux :
 *  - `scrollHeight - clientHeight` : capture les éléments dans le flux normal
 *    qui dépassent (description trop longue, etc.). Le `.page` a
 *    `overflow: hidden` mais scrollHeight reflète quand même le contenu réel.
 *  - bounding rect par enfant : capture les éléments en `position: relative`
 *    avec `translateY` (photos additionnelles Manuel) qui peuvent dépasser
 *    sans incrémenter scrollHeight.
 *
 * Retourne `null` si pas de `.page` trouvée ou pas encore stabilisée.
 */
export interface OverflowMeasure {
  /** Débordement vertical en pixels (toujours ≥ 0). 0 = OK. */
  overflowPx: number;
  /** Idem en mm (utile pour l'affichage utilisateur). */
  overflowMm: number;
  /** Hauteur de la zone A4 en pixels (pour conversion px → mm). */
  pagePx: number;
}

export function measureOverflow(doc: Document | null | undefined): OverflowMeasure | null {
  if (!doc) return null;
  const page = doc.querySelector<HTMLElement>('.page');
  if (!page) return null;

  const pagePx = page.clientHeight;
  if (pagePx === 0) return null;

  // 1) Débordement par scrollHeight (contenu dans le flux)
  const flowOverflow = Math.max(0, page.scrollHeight - pagePx);

  // 2) Débordement par enfants positionnés (translateY, absolute…)
  //    On regarde le bas de chaque descendant direct + petits-enfants utiles.
  const pageRect = page.getBoundingClientRect();
  let positionedOverflow = 0;
  const all = page.querySelectorAll<HTMLElement>('*');
  all.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    const delta = r.bottom - pageRect.bottom;
    if (delta > positionedOverflow) positionedOverflow = delta;
  });

  const overflowPx = Math.max(flowOverflow, Math.round(positionedOverflow));
  const overflowMm = Math.round((overflowPx / pagePx) * 297);
  return { overflowPx, overflowMm, pagePx };
}
