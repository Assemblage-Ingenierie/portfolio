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
  /**
   * Dépassement de la MARGE intérieure (zone de contenu délimitée par le
   * padding de `.page`), en mm, alors que le contenu reste DANS la feuille
   * A4 (pas de coupe à l'export). Sert au message orange « Le contenu dépasse
   * de la marge ». 0 = contenu dans la marge.
   */
  marginMm: number;
  /** Bords où le contenu dépasse la marge (sans sortir de la feuille). */
  marginEdges?: Array<'haut' | 'bas' | 'gauche' | 'droite'>;
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

/**
 * Équivalent pour les photos recadrées rendues en `<svg>` avec
 * `preserveAspectRatio="xMidYMid meet"` (= object-fit:contain sémantique).
 * Le viewBox définit l'aspect du contenu effectivement rendu ; quand la
 * box CSS a une aspect différente (max-height clamp, etc.), le contenu
 * est letterboxé centré. On retourne le rect du contenu visible — sinon
 * la mesure utilise la box CSS, plus large, et produit des faux positifs.
 */
function getRenderedSvgRect(svg: SVGSVGElement): DOMRect | null {
  const vb = svg.getAttribute('viewBox');
  if (!vb) return null;
  const parts = vb.split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !isFinite(n))) return null;
  const [, , vbW, vbH] = parts;
  if (vbW <= 0 || vbH <= 0) return null;
  const par = svg.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet';
  if (!par.includes('meet')) return null;
  const r = svg.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const vbRatio = vbW / vbH;
  const boxRatio = r.width / r.height;
  let rw = r.width;
  let rh = r.height;
  if (vbRatio > boxRatio) {
    rh = r.width / vbRatio;
  } else {
    rw = r.height * vbRatio;
  }
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

  // 1) Débordement « flux ». Les deux mesures globales scroll* sont
  //    désormais NEUTRALISÉES (= 0) ; tous les bords sont mesurés via le
  //    bounding rect rendu de chaque enfant (boucle ci-dessous).
  //
  // ⚠ flowOverflowH (page.scrollWidth) : ignoré car les <svg class="photo-
  //   cropped"> letterboxés (preserveAspectRatio=meet) ont une box CSS plus
  //   large que leur contenu visible → scrollWidth = faux positif. Ce sont
  //   getRenderedSvgRect / getRenderedImgRect qui font foi à l'horizontale.
  //
  // ⚠ flowOverflowV (page.scrollHeight) : ignoré car scrollHeight est
  //   AVEUGLE AUX TRANSFORMS CSS. Plusieurs blocs in-flow sont déplacés
  //   visuellement par `transform: translate(...)` piloté par les sliders de
  //   position — notamment le bloc « Prestation Assemblage » du template Dev
  //   (`.dev-presta`, flex item translaté), mais aussi les photos. Quand un
  //   tel bloc déborde puis qu'on le remonte, scrollHeight continue de
  //   compter son emplacement de FLUX d'origine (+ le padding bas de la
  //   .page) : la mesure du bord bas restait alors figée (~11mm) malgré le
  //   repositionnement. Le bounding rect, lui, reflète la translation — et
  //   correspond au plan de coupe réel à l'export (.page overflow:hidden à
  //   pageRect.bottom), donc à l'overflow physiquement exact.
  const flowOverflowV = 0;
  const flowOverflowH = 0;

  // 2) Débordement par enfants positionnés / translatés.
  const pageRect = page.getBoundingClientRect();
  let bottomOverflow = 0;
  let topOverflow = 0;
  let rightOverflow = 0;
  let leftOverflow = 0;

  // Conversion px ↔ mm via la hauteur du cadre. Lue depuis l'attribut
  // `data-height-mm` du .page (A4 portrait 297mm / paysage 210mm pour les
  // exports tableau). Fallback A4 portrait.
  const pageMm = Number(page.dataset.heightMm);
  const heightMm = Number.isFinite(pageMm) && pageMm > 0 ? pageMm : 297;
  const mmToPx = (mm: number) => (mm / heightMm) * pagePx;

  // 2bis) Dépassement de la MARGE intérieure (zone de contenu). Sert au
  //   message orange : contenu qui sort de la marge mais reste DANS la
  //   feuille. Haut / gauche / droite suivent le padding de .page (lu en
  //   computed style — dev/manuel : 14mm / 18mm / 18mm). La marge BASSE est
  //   fixée à 8mm (indépendante du padding CSS), pour alerter au plus près du
  //   bord inférieur.
  const BOTTOM_MARGIN_MM = 8;
  const cs = win.getComputedStyle(page);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const padRight = parseFloat(cs.paddingRight) || 0;
  const padLeft = parseFloat(cs.paddingLeft) || 0;
  const marginTopY = pageRect.top + padTop;
  const marginBottomY = pageRect.bottom - mmToPx(BOTTOM_MARGIN_MM);
  const marginLeftX = pageRect.left + padLeft;
  const marginRightX = pageRect.right - padRight;
  let mBottom = 0;
  let mTop = 0;
  let mRight = 0;
  let mLeft = 0;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const all = page.querySelectorAll<HTMLElement>('*');
  all.forEach((el) => {
    if (!isVisible(el, win)) return;
    // .photo-frame est `width: 100%` mais son contenu visuel est l'<img>
    // letterboxée à l'intérieur (object-fit:contain). On mesure l'img
    // séparément avec son rendered rect — sinon le frame reporte un
    // débordement horizontal alors que la photo affichée est plus petite.
    if (el.classList.contains('photo-frame')) return;

    // Checks cross-realm safe : `instanceof SVGElement` ne marche PAS ici
    // car les éléments viennent de l'iframe (autre realm que celui où
    // tourne measureOverflow). On utilise namespaceURI + tagName qui sont
    // des strings, donc indépendants des classes JS de chaque realm.
    const inSvgNs = el.namespaceURI === SVG_NS;
    const isSvgRoot = inSvgNs && el.tagName.toLowerCase() === 'svg';

    // Éléments internes à un SVG (<image>, <g>, <path>…) : leur bounding
    // rect peut être bien plus grand que le SVG container (notamment
    // <image x=0 y=0 width=NATURAL_PX> qui projette en coords écran à
    // travers le viewBox = peut faire 2-10× la taille du SVG). On les
    // skip — seul le `<svg>` container compte pour l'overflow.
    if (inSvgNs && !isSvgRoot) return;

    let r: DOMRect;
    if (el.tagName === 'IMG') {
      const img = el as HTMLImageElement;
      // Si l'image n'est pas encore décodée (naturalWidth=0), son bounding
      // rect = la box CSS (`width: 100%`), ce qui surestime largement la
      // largeur réellement rendue. On la skip entièrement plutôt que de
      // produire un faux positif — la mesure sera refaite au prochain
      // raf après le load.
      if (!img.naturalWidth || !img.naturalHeight) return;
      const rendered = getRenderedImgRect(img, win);
      // getRenderedImgRect retourne null si object-fit n'est pas 'contain'
      // — dans ce cas on garde le bounding rect comme avant.
      r = rendered ?? img.getBoundingClientRect();
    } else if (isSvgRoot) {
      // Photo recadrée : on calcule le rect du contenu effectivement
      // rendu (letterboxing preserveAspectRatio=meet).
      const rendered = getRenderedSvgRect(el as unknown as SVGSVGElement);
      r = rendered ?? el.getBoundingClientRect();
    } else {
      r = el.getBoundingClientRect();
    }
    if (r.height === 0 || r.width === 0) return;

    // Plus d'exemption horizontale pour les éléments dans `.photo-frame` :
    // les sliders H peuvent pousser une photo hors-page (cf. screenshot
    // utilisateur où le 3e photo va à -50% du slot et sort par la gauche).
    // On veut que l'alarme se déclenche dans ce cas. Pour les <img> et
    // <svg> photos, les rendered rects ci-dessus excluent déjà le
    // letterboxing donc pas de faux positif sur leur box CSS surdimensionnée.
    const bottomDelta = r.bottom - pageRect.bottom;
    const topDelta = pageRect.top - r.top;
    const rightDelta = r.right - pageRect.right;
    const leftDelta = pageRect.left - r.left;
    if (bottomDelta > bottomOverflow) bottomOverflow = bottomDelta;
    if (topDelta > topOverflow) topOverflow = topDelta;
    if (rightDelta > rightOverflow) rightOverflow = rightDelta;
    if (leftDelta > leftOverflow) leftOverflow = leftDelta;

    // Mêmes deltas mais contre la marge intérieure (pour le message orange).
    const mBottomDelta = r.bottom - marginBottomY;
    const mTopDelta = marginTopY - r.top;
    const mRightDelta = r.right - marginRightX;
    const mLeftDelta = marginLeftX - r.left;
    if (mBottomDelta > mBottom) mBottom = mBottomDelta;
    if (mTopDelta > mTop) mTop = mTopDelta;
    if (mRightDelta > mRight) mRight = mRightDelta;
    if (mLeftDelta > mLeft) mLeft = mLeftDelta;
  });

  // Tolérance : 1px en vertical, 3px en horizontal (le letterboxing
  // object-fit:contain a un arrondi sub-pixel plus marqué que les flux
  // verticaux — sans tolérance on déclenche à tort des warnings de 1-2mm).
  const V_TOL = 1;
  const H_TOL = 3;
  const bottomPx = Math.max(0, Math.round(Math.max(flowOverflowV, bottomOverflow) - V_TOL));
  const topPx = Math.max(0, Math.round(topOverflow - V_TOL));
  const rightPx = Math.max(0, Math.round(Math.max(flowOverflowH, rightOverflow) - H_TOL));
  const leftPx = Math.max(0, Math.round(leftOverflow - H_TOL));

  const overflowPx = Math.max(bottomPx, topPx, rightPx, leftPx);
  const rawMm = Math.floor((overflowPx / pagePx) * heightMm);

  // Seuil de signalement : en dessous de MIN_REPORTABLE_MM, on considere le
  // depassement comme cosmetique (sous-pixel d'`object-fit: contain`, scaling
  // d'iframe, scrollbar du navigateur, etc.) et on rapporte 0. Le visuel
  // reste correct car le contenu reste dans la marge de tolerance.
  const MIN_REPORTABLE_MM = 3;
  const overflowMm = rawMm >= MIN_REPORTABLE_MM ? rawMm : 0;

  // Si on clamp a 0, on n'expose aucun bord debordant (sinon l'UI affiche
  // "0mm (bord droite)" — incoherent).
  const edges: Array<'haut' | 'bas' | 'gauche' | 'droite'> = [];
  if (overflowMm > 0) {
    if (topPx > 0) edges.push('haut');
    if (bottomPx > 0) edges.push('bas');
    if (leftPx > 0) edges.push('gauche');
    if (rightPx > 0) edges.push('droite');
  }

  // Dépassement de marge (message orange). Mêmes tolérances que la page,
  // mais PAS de seuil de signalement : tout dépassement (≥ 1mm après
  // tolérance) est rapporté.
  const mBottomPx = Math.max(0, Math.round(mBottom - V_TOL));
  const mTopPx = Math.max(0, Math.round(mTop - V_TOL));
  const mRightPx = Math.max(0, Math.round(mRight - H_TOL));
  const mLeftPx = Math.max(0, Math.round(mLeft - H_TOL));
  const marginOverflowPx = Math.max(mBottomPx, mTopPx, mRightPx, mLeftPx);
  const marginMm = Math.floor((marginOverflowPx / pagePx) * heightMm);

  const marginEdges: Array<'haut' | 'bas' | 'gauche' | 'droite'> = [];
  if (marginMm > 0) {
    if (mTopPx > 0) marginEdges.push('haut');
    if (mBottomPx > 0) marginEdges.push('bas');
    if (mLeftPx > 0) marginEdges.push('gauche');
    if (mRightPx > 0) marginEdges.push('droite');
  }

  return { overflowPx, overflowMm, pagePx, bottomPx, topPx, leftPx, rightPx, edges, marginMm, marginEdges };
}
