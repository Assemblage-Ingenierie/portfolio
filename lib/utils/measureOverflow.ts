/**
 * Mesure le débordement du contenu d'une fiche projet par rapport au cadre
 * A4 (`.page`, 210mm × 297mm via SHARED_CSS).
 *
 * Vérifie les 4 bords (haut, bas, gauche, droite) :
 *  - via `scrollHeight/scrollWidth` du `.page` pour le contenu dans le flux
 *  - via bounding rect de chaque enfant pour les éléments translatés ou
 *    en `position: absolute` (photos translateY/X, liste mots-clés…)
 *
 * Les éléments masqués (display:none, visibility:hidden, opacity:0) sont
 * ignorés pour éviter les faux positifs.
 *
 * Retourne `null` si pas de `.page` trouvée ou pas encore stabilisée.
 */
export interface OverflowMeasure {
  /** Débordement maximum tous bords confondus, en pixels. 0 = OK. */
  overflowPx: number;
  /** Idem en mm (vertical) — calculé sur la hauteur A4 = 297mm. */
  overflowMm: number;
  /** Hauteur de la zone A4 en pixels (pour conversion px → mm). */
  pagePx: number;
  /** Détail par bord (en pixels). */
  topPx?: number;
  bottomPx?: number;
  leftPx?: number;
  rightPx?: number;
  /** Identifie quel(s) bord(s) débordent — utile pour le message UI. */
  edges?: Array<'haut' | 'bas' | 'gauche' | 'droite'>;
}

function isVisible(el: HTMLElement, win: Window): boolean {
  const style = win.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  return true;
}

/**
 * Pour un <img> avec `object-fit: contain`, le bounding rect de l'élément
 * couvre toute la "box" CSS (typiquement `width: 100%`), mais l'image
 * réellement rendue est letterboxée à l'intérieur selon le ratio naturel.
 * Cette fonction retourne le rect du contenu visuel effectif. Utile pour
 * mesurer le débordement horizontal : le cadre est large même quand la
 * photo affichée est petite.
 */
function getRenderedImgRect(img: HTMLImageElement, win: Window): DOMRect | null {
  if (!img.naturalWidth || !img.naturalHeight) return null;
  const style = win.getComputedStyle(img);
  if (style.objectFit !== 'contain') return null;
  const r = img.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const naturalRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = r.width / r.height;
  let rw = r.width;
  let rh = r.height;
  if (naturalRatio > boxRatio) {
    // Image plus large que la box → letterbox haut/bas
    rh = r.width / naturalRatio;
  } else {
    // Image plus étroite que la box → letterbox gauche/droite
    rw = r.height * naturalRatio;
  }
  // object-position par défaut = center center
  const left = r.left + (r.width - rw) / 2;
  const top = r.top + (r.height - rh) / 2;
  return new DOMRect(left, top, rw, rh);
}

export function measureOverflow(doc: Document | null | undefined): OverflowMeasure | null {
  if (!doc) return null;
  const page = doc.querySelector<HTMLElement>('.page');
  if (!page) return null;

  const pagePx = page.clientHeight;
  const pageWidthPx = page.clientWidth;
  if (pagePx === 0 || pageWidthPx === 0) return null;

  const win = doc.defaultView ?? window;

  // 1) Débordement par scroll* (contenu dans le flux). Tolérance 1px pour
  //    absorber le sub-pixel rounding du navigateur.
  const flowOverflowV = Math.max(0, page.scrollHeight - pagePx - 1);
  const flowOverflowH = Math.max(0, page.scrollWidth - pageWidthPx - 1);

  // 2) Débordement par enfants positionnés / translatés.
  const pageRect = page.getBoundingClientRect();
  let bottomOverflow = 0;
  let topOverflow = 0;
  let rightOverflow = 0;
  let leftOverflow = 0;

  const all = page.querySelectorAll<HTMLElement>('*');
  all.forEach((el) => {
    if (!isVisible(el, win)) return;
    // .photo-frame est `width: 100%` mais son contenu visuel est l'<img>
    // letterboxée à l'intérieur (object-fit:contain). On mesure l'img
    // séparément avec son rendered rect — sinon le frame reporte un
    // débordement horizontal alors que la photo affichée est plus petite.
    if (el.classList.contains('photo-frame')) return;
    let r: DOMRect = el.getBoundingClientRect();
    if (el.tagName === 'IMG') {
      const rendered = getRenderedImgRect(el as HTMLImageElement, win);
      if (rendered) r = rendered;
    }
    if (r.height === 0 || r.width === 0) return;
    const bottomDelta = r.bottom - pageRect.bottom;
    const topDelta = pageRect.top - r.top;
    const rightDelta = r.right - pageRect.right;
    const leftDelta = pageRect.left - r.left;
    if (bottomDelta > bottomOverflow) bottomOverflow = bottomDelta;
    if (topDelta > topOverflow) topOverflow = topDelta;
    if (rightDelta > rightOverflow) rightOverflow = rightDelta;
    if (leftDelta > leftOverflow) leftOverflow = leftDelta;
  });

  // Tolérance 1px sur chaque mesure
  const bottomPx = Math.max(0, Math.round(Math.max(flowOverflowV, bottomOverflow) - 1));
  const topPx = Math.max(0, Math.round(topOverflow - 1));
  const rightPx = Math.max(0, Math.round(Math.max(flowOverflowH, rightOverflow) - 1));
  const leftPx = Math.max(0, Math.round(leftOverflow - 1));

  const overflowPx = Math.max(bottomPx, topPx, rightPx, leftPx);
  const overflowMm = Math.round((overflowPx / pagePx) * 297);

  const edges: Array<'haut' | 'bas' | 'gauche' | 'droite'> = [];
  if (topPx > 0) edges.push('haut');
  if (bottomPx > 0) edges.push('bas');
  if (leftPx > 0) edges.push('gauche');
  if (rightPx > 0) edges.push('droite');

  return { overflowPx, overflowMm, pagePx, bottomPx, topPx, leftPx, rightPx, edges };
}
