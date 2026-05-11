/**
 * Mesure le débordement vertical du contenu d'une fiche projet par rapport
 * au cadre A4 (`.page`, hauteur fixée à 297mm via SHARED_CSS).
 *
 * Combine plusieurs signaux :
 *  - `scrollHeight - clientHeight` du `.page` : capture les éléments dans
 *    le flux normal qui dépassent (description trop longue, etc.). Le
 *    `.page` a `overflow: hidden` mais scrollHeight reflète quand même
 *    le contenu réel.
 *  - bounding rect par enfant : capture les éléments en `position: relative`
 *    avec `translateY` (photos additionnelles / principale du template Manuel,
 *    liste de mots-clés flottante) qui peuvent dépasser sans incrémenter
 *    scrollHeight. On vérifie à la fois les débordements en bas ET en haut
 *    de la page (un élément remonté trop haut est aussi coupé).
 *
 * On ignore les éléments masqués (display:none, visibility:hidden, opacity:0)
 * pour éviter les faux positifs sur du contenu qui n'est de toute façon pas
 * imprimé.
 *
 * Retourne `null` si pas de `.page` trouvée ou pas encore stabilisée.
 */
export interface OverflowMeasure {
  /** Débordement vertical total en pixels (max top + bottom). 0 = OK. */
  overflowPx: number;
  /** Idem en mm. */
  overflowMm: number;
  /** Hauteur de la zone A4 en pixels (pour conversion px → mm). */
  pagePx: number;
  /** Débordement par le bas (px). */
  bottomPx?: number;
  /** Débordement par le haut (px). */
  topPx?: number;
}

function isVisible(el: HTMLElement, win: Window): boolean {
  const style = win.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  return true;
}

export function measureOverflow(doc: Document | null | undefined): OverflowMeasure | null {
  if (!doc) return null;
  const page = doc.querySelector<HTMLElement>('.page');
  if (!page) return null;

  const pagePx = page.clientHeight;
  if (pagePx === 0) return null;

  const win = doc.defaultView ?? window;

  // 1) Débordement par scrollHeight (contenu dans le flux). On utilise une
  //    tolérance d'1px pour absorber le sub-pixel rounding du navigateur.
  const flowOverflow = Math.max(0, page.scrollHeight - pagePx - 1);

  // 2) Débordement par enfants positionnés (translateY, absolute…).
  //    Tolérance d'1px sur top et bottom pour les mêmes raisons.
  const pageRect = page.getBoundingClientRect();
  let bottomOverflow = 0;
  let topOverflow = 0;

  const all = page.querySelectorAll<HTMLElement>('*');
  all.forEach((el) => {
    if (!isVisible(el, win)) return;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) return;
    const bottomDelta = r.bottom - pageRect.bottom;
    const topDelta = pageRect.top - r.top;
    if (bottomDelta > bottomOverflow) bottomOverflow = bottomDelta;
    if (topDelta > topOverflow) topOverflow = topDelta;
  });

  const bottomPx = Math.max(0, Math.round(bottomOverflow - 1));
  const topPx = Math.max(0, Math.round(topOverflow - 1));
  const positionedOverflow = Math.max(bottomPx, topPx);
  const overflowPx = Math.max(flowOverflow, positionedOverflow);
  const overflowMm = Math.round((overflowPx / pagePx) * 297);

  return { overflowPx, overflowMm, pagePx, bottomPx, topPx };
}
