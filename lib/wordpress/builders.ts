import type { Projet, CrmField, CrmLink } from '@/types/projet';
import { renderMarkdown } from '@/lib/utils/markdown';
import {
  resolveWpConfig,
  effectiveFieldStyle,
  wpTemplateFor,
  wpFieldOrder,
  WP_FIELD_LABELS,
  type WpConfig,
  type WpFieldKey,
  type ResolvedWpConfig,
} from './wpConfig';

/** Photo passée au builder : URL effective (Airtable ou WP uploadée) + filename
 *  pour servir d'index 0+ dans `wpConfig.photos.gallery[].photoIndex`. */
export interface WpPhoto {
  url: string;
  filename: string;
}

export function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const ROUGE  = '#E30513';
export const VIOLET = '#30323E';
export const GRIS   = '#DFE4E8';
export const NOIR70 = '#4D4D4D';
export const SERIF  = 'Georgia, serif';
export const SANS   = "Geomanist, 'Open Sans', system-ui, sans-serif";

/**
 * Sécurise une URL pour un attribut href : n'autorise que http(s).
 * Retourne undefined si le schéma n'est pas sûr (évite javascript:, data:, …).
 */
function safeHref(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Tolère les URLs sans schéma saisies dans Airtable (ex. "www.exemple.fr")
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return `https://${trimmed}`;
  return undefined;
}

/**
 * Rend une valeur de champ CRM (MOA, Architecte, …) en chaîne HTML : chaque
 * entité dont l'URL site est connue devient un lien hypertexte (nouvel onglet),
 * les autres restent en texte simple. Fallback sur la string jointe `plain`
 * quand aucune entrée structurée n'est disponible (fiche non résolue).
 */
function crmCellHtml(links: CrmLink[] | undefined, plain: string | undefined): string {
  if (!links || links.length === 0) return esc(plain ?? '');
  return links
    .map((l) => {
      const href = safeHref(l.url);
      return href
        ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${esc(l.name)}</a>`
        : esc(l.name);
    })
    .join(', ');
}

function infoItem(label: string, value?: string | number, sub?: string): string {
  if (!value && value !== 0) return '';
  return `
    <div style="margin-bottom:10px;">
      <span style="display:block;font-family:${SANS};font-size:11px;font-weight:400;letter-spacing:0.06em;font-variant:small-caps;color:${NOIR70};margin-bottom:2px;">${label}</span>
      <div style="font-family:${SERIF};font-size:13px;font-weight:400;line-height:1.2;color:#000;">${esc(value)}</div>
      ${sub ? `<div style="font-family:${SANS};font-size:10px;color:${NOIR70};margin-top:2px;">${esc(sub)}</div>` : ''}
    </div>`;
}

function buildWpMagazine(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  const pitch = esc(projet.pitch ?? '');
  const description = projet.description ?? '';
  const badge = [projet.programme, projet.pole].filter(Boolean).map(esc).join(' · ');
  const chiffresCles = projet.chiffresCles ?? [];

  const heroStyle = coverUrl
    ? `background-image:url(${coverUrl});background-size:cover;background-position:center;`
    : `background-color:${VIOLET};`;

  const galerie = photoUrls.length > 0
    ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:16px;height:120px;">
        ${photoUrls.slice(0, 3).map(u =>
          `<div style="background-image:url(${u});background-size:cover;background-position:center;background-color:${GRIS};"></div>`
        ).join('')}
      </div>`
    : '';

  const secondaire = [
    { label: 'Pôle', value: projet.pole },
    { label: 'Département', value: projet.departement },
    { label: 'Programme', value: projet.programme },
    { label: 'Rehab / Neuf', value: projet.rehabNeuf },
    { label: 'Mandataire', value: projet.mandataire },
    { label: 'BET associés', value: projet.betAssocies },
    { label: 'Entreprise', value: projet.entreprise },
    { label: 'Bailleur', value: projet.bailleur },
  ].filter(f => !!f.value);

  return `
<div style="font-family:${SANS};max-width:900px;margin:0 auto;background:white;">

  <!-- Hero -->
  <div style="position:relative;height:300px;${heroStyle}overflow:hidden;">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(48,50,62,0.78) 100%);"></div>
    <div style="position:absolute;top:14px;right:28px;font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:white;z-index:2;">
      Assemblage ingénierie · <span style="color:${ROUGE};font-family:${SERIF};font-weight:700;font-size:14px;">.A</span>
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;padding:20px 28px;z-index:2;">
      ${badge ? `<div style="display:inline-block;background:${ROUGE};color:white;padding:2px 10px;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">${badge}</div>` : ''}
      <h1 style="font-family:${SERIF};font-size:34px;font-weight:400;line-height:1;letter-spacing:-0.02em;color:white;margin:0 0 6px;">${esc(projet.nom)}</h1>
      ${projet.lieu ? `<div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">${esc(projet.lieu)}</div>` : ''}
    </div>
  </div>

  <!-- Corps -->
  <div style="display:grid;grid-template-columns:220px 1fr;gap:0;padding:28px;">

    <!-- Sidebar -->
    <div style="border-right:1px solid ${GRIS};padding-right:24px;">
      ${pitch ? `<p style="font-family:${SERIF};font-size:14px;font-style:italic;line-height:1.4;color:${VIOLET};margin:0 0 14px;padding-bottom:14px;border-bottom:2px solid ${ROUGE};">${pitch}</p>` : ''}
      ${infoItem("Maître d'ouvrage", projet.moa)}
      ${infoItem('Mission', projet.missionAi, 'Assemblage ingénierie')}
      ${infoItem('Budget travaux', projet.budgetHT)}
      ${infoItem('Calendrier', projet.anneeLivraison, projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined)}
      ${secondaire.length > 0 ? `
        <div style="margin-top:14px;padding-top:14px;border-top:1px dotted ${GRIS};">
          ${secondaire.map(f => infoItem(f.label, f.value)).join('')}
        </div>` : ''}
      ${chiffresCles.length > 0 ? `
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid ${GRIS};">
          ${chiffresCles.map(c => `
            <div style="margin-bottom:10px;">
              <div style="font-family:${SERIF};font-size:28px;font-weight:600;line-height:1;color:${VIOLET};letter-spacing:-0.02em;">${esc(c.valeur)}</div>
              <div style="font-family:${SANS};font-size:8px;font-weight:600;color:${NOIR70};letter-spacing:0.05em;text-transform:uppercase;margin-top:2px;">${esc(c.label)}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>

    <!-- Principal -->
    <div style="padding-left:24px;">
      <h2 style="font-family:${SERIF};font-size:22px;font-weight:500;line-height:1.1;color:#000;letter-spacing:-0.01em;margin:0 0 16px;">${esc(projet.nom)}</h2>
      <div class="ai-md" style="columns:2;column-gap:16px;column-rule:1px solid ${GRIS};font-family:${SANS};font-size:11px;line-height:1.5;color:#000;">
        ${renderMarkdown(description)}
      </div>
      ${galerie}
    </div>

  </div>

  <!-- Footer -->
  <div style="background:${VIOLET};color:white;padding:10px 28px;display:flex;justify-content:space-between;align-items:center;font-family:${SANS};font-size:9px;">
    <span style="font-family:${SERIF};font-size:16px;font-weight:700;color:${ROUGE};">.A</span>
    <div style="text-align:center;flex:1;padding:0 16px;opacity:0.8;">
      <strong>Assemblage ingénierie</strong> S.A.S · 137 rue d'Aboukir, 75002 Paris · contact@assemblage.net · assemblage.net
    </div>
    <div style="text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:${ROUGE};">${esc(projet.affaire)}</div>
  </div>

</div>`;
}

/** Slot de galerie résolu (photo + offsets + taille), prêt à être rendu. */
interface ResolvedSlot {
  photo: WpPhoto;
  sizePercent: number;
  offsetX: number;
  offsetY: number;
  lightboxIdx: number;
}

/** Rend la galerie HTML à partir de slots déjà résolus. */
function renderGallerySlots(
  slots: ResolvedSlot[],
  alt: string,
  cfgPhotos: ResolvedWpConfig['photos'],
): string {
  if (slots.length === 0) return '';
  const cols = cfgPhotos.galleryColumns && cfgPhotos.galleryColumns > 0
    ? Math.min(cfgPhotos.galleryColumns, slots.length)
    : (slots.length === 1 ? 1 : slots.length === 2 ? 2 : 3);
  return `
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${cfgPhotos.galleryGapPx}px;margin:40px 0;">
      ${slots.map((s) => `
        <figure data-ai-idx="${s.lightboxIdx}" style="margin:0;display:flex;justify-content:center;cursor:pointer;">
          <div style="width:${s.sizePercent}%;aspect-ratio:${cfgPhotos.galleryAspectRatio};overflow:hidden;background:${GRIS};">
            <img src="${esc(s.photo.url)}" alt="${esc(alt)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:${s.offsetX}% ${s.offsetY}%;display:block;pointer-events:none;" />
          </div>
        </figure>`).join('')}
    </div>`;
}

/** Helper rétro-compat pour les anciens usages (tests, build externe). */
export function imageGallery(
  urls: string[],
  alt: string,
  startIdx = 1,
  photos?: ResolvedWpConfig['photos'],
): string {
  if (urls.length === 0) return '';
  const slots: ResolvedSlot[] = urls.map((u, i) => ({
    photo: { url: u, filename: `photo-${i + 1}` },
    sizePercent: 100, offsetX: 50, offsetY: 50,
    lightboxIdx: startIdx + i,
  }));
  return renderGallerySlots(slots, alt, photos ?? resolveWpConfig().photos);
}

export function lightboxHtml(allPhotos: string[], alt: string): string {
  if (allPhotos.length === 0) return '';
  const photosJson = JSON.stringify(allPhotos);
  return `
<div id="ai-lightbox" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.75);align-items:center;justify-content:flex-start;flex-direction:column;padding:0 60px 60px;overflow-y:auto;">
  <button id="ai-lb-close" style="position:absolute;top:20px;right:28px;background:none;border:none;color:white;font-size:36px;line-height:1;cursor:pointer;opacity:0.8;">×</button>
  <button id="ai-lb-prev" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.12);border:none;color:white;font-size:48px;line-height:1;cursor:pointer;padding:12px 18px;border-radius:4px;">‹</button>
  <img id="ai-lb-img" src="" alt="${esc(alt)}" style="max-width:90vw;max-height:calc(100vh - 160px);object-fit:contain;display:block;border-radius:2px;margin-top:100px;flex-shrink:0;" />
  <div id="ai-lb-counter" style="position:absolute;bottom:20px;color:white;font-family:${SANS};font-size:13px;opacity:0.6;letter-spacing:0.08em;"></div>
  <button id="ai-lb-next" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.12);border:none;color:white;font-size:48px;line-height:1;cursor:pointer;padding:12px 18px;border-radius:4px;">›</button>
</div>
<script>
(function(){
  var photos=${photosJson};
  var idx=0;
  var lb=document.getElementById('ai-lightbox');
  // Déplacer le lightbox vers document.body pour échapper à tout contexte
  // d'empilement créé par un parent (transform, filter, will-change…)
  // qui empêcherait position:fixed de couvrir tout le viewport.
  if(lb&&lb.parentNode!==document.body){document.body.appendChild(lb);}
  var lbImg=document.getElementById('ai-lb-img');
  var lbCounter=document.getElementById('ai-lb-counter');
  function show(i){
    idx=(i+photos.length)%photos.length;
    lbImg.src=photos[idx];
    lbCounter.textContent=(idx+1)+' / '+photos.length;
    lb.style.display='flex';
    document.body.style.overflow='hidden';
  }
  function close(){lb.style.display='none';document.body.style.overflow='';}
  document.getElementById('ai-lb-prev').onclick=function(e){e.stopPropagation();show(idx-1);};
  document.getElementById('ai-lb-next').onclick=function(e){e.stopPropagation();show(idx+1);};
  document.getElementById('ai-lb-close').onclick=close;
  lb.onclick=function(e){if(e.target===lb)close();};
  document.addEventListener('keydown',function(e){
    if(lb.style.display==='none')return;
    if(e.key==='ArrowLeft')show(idx-1);
    if(e.key==='ArrowRight')show(idx+1);
    if(e.key==='Escape')close();
  });
  document.querySelectorAll('[data-ai-idx]').forEach(function(el){
    el.addEventListener('click',function(){show(parseInt(el.getAttribute('data-ai-idx'),10));});
  });
})();
</script>`;
}

function buildWpEditorial(
  projet: Projet,
  defaultCover: WpPhoto | undefined,
  galleryInput: WpPhoto[],
  wpConfig?: WpConfig,
): string {
  const resolved = resolveWpConfig(wpConfig);
  const { typo, photos, spacing } = resolved;
  const pitch = esc(projet.pitch ?? '');
  const description = projet.description ?? '';
  const chiffresCles = projet.chiffresCles ?? [];

  // Pool de toutes les photos disponibles (cover Airtable + photos projet),
  // indexé par position : 0 = cover, 1+ = photos projet. C'est l'indexation
  // utilisée par `wpConfig.photos.gallery[].photoIndex` (miroir du
  // `allPhotos(projet)` de la fiche PDF / section Photos additionnelles).
  const pool: WpPhoto[] = [];
  if (defaultCover) pool.push(defaultCover);
  for (const p of galleryInput) {
    if (!pool.some((q) => q.filename === p.filename)) pool.push(p);
  }
  const byFilename = new Map(pool.map((p) => [p.filename, p]));

  // Couverture effective : choisie par l'utilisateur (coverFilename) si
  // disponible, sinon la photo de couverture Airtable par défaut.
  const cover = (photos.coverFilename && byFilename.get(photos.coverFilename))
    || defaultCover
    || undefined;
  const coverUrl = cover?.url;
  const coverOffsetX = photos.coverOffsetX ?? 50;
  const coverOffsetY = photos.coverOffsetY ?? 50;

  // Slots de galerie : si l'utilisateur a configuré `gallery`, on respecte
  // l'ordre et les réglages ; sinon, on rend toutes les photos du pool sauf
  // la couverture (comportement historique).
  let slots: ResolvedSlot[] = [];
  if (photos.galleryEnabled !== false) {
    if (photos.gallery && photos.gallery.length > 0) {
      slots = photos.gallery
        .filter((s) => s.enabled !== false)
        .map((s) => ({
          photo: pool[s.photoIndex],
          sizePercent: s.sizePercent ?? 100,
          offsetX: s.offsetX ?? 50,
          offsetY: s.offsetY ?? 50,
          lightboxIdx: s.photoIndex,
        }))
        .filter((s): s is ResolvedSlot => !!s.photo);
    } else {
      // Fallback historique : toutes les photos sauf la couverture, à la suite.
      slots = pool
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => !cover || p.filename !== cover.filename)
        .map(({ p, i }) => ({
          photo: p, sizePercent: 100, offsetX: 50, offsetY: 50, lightboxIdx: i,
        }));
    }
  }

  // Pour le lightbox : on liste TOUTES les URLs du pool (cover + photos),
  // indexées comme le `photoIndex` des slots.
  const allPhotos = pool.map((p) => p.url);

  // Template d'export dérivé de la Vignette pôle (DEV → Dev, sinon Str-Env).
  const wpTemplate = wpTemplateFor(projet.vignettePoles);

  // Helper : rend un champ CRM en HTML cliquable (fallback string jointe).
  const crm = (key: CrmField, plain?: string): string =>
    crmCellHtml(projet.crmLinks?.[key], plain);

  // Style inline d'une valeur de champ (utilisé pour le span « Programme
  // secondaire » rendu DANS la cellule Programme, avec sa propre typo).
  const valueSpanStyle = (key: WpFieldKey): string => {
    const st = effectiveFieldStyle(resolved, key);
    const sizePt = st.sizePt ?? typo.fieldsSizePt;
    return `font-family:${SANS} !important;letter-spacing:normal !important;font-size:${sizePt}pt !important;`
      + `text-transform:${st.upperCase ? 'uppercase' : 'none'} !important;`
      + `font-variant:${st.smallCaps ? 'small-caps' : 'normal'} !important;`
      + `font-weight:${st.valueBold ? 700 : 400} !important;color:${st.valueColor} !important;`;
  };

  // Programme : principal dans la cellule « Programme principal » ; le
  // secondaire est rendu APRÈS, séparé d'un point médian, avec sa propre typo
  // (clé `programmeSecondaire`). Masquable via son option « Masquer ».
  const principal = projet.programmePrincipal;
  const secondaire = projet.programmeSecondaire;
  const secHidden = effectiveFieldStyle(resolved, 'programmeSecondaire').hidden;
  const programmeHtml = (principal || secondaire)
    ? `${esc(principal ?? secondaire ?? '')}`
      + (principal && secondaire && !secHidden
        ? ` · <span style="${valueSpanStyle('programmeSecondaire')}">${esc(secondaire)}</span>`
        : '')
    : undefined;

  const materiaux = projet.materiaux && projet.materiaux.length > 0
    ? projet.materiaux.join(', ')
    : undefined;

  // Valeur de chaque champ par clé. `value` = texte brut (échappé au rendu) ;
  // `html` = HTML déjà sûr (liens CRM, rendu tel quel). Budget et Surface sont
  // deux cellules distinctes.
  const fieldData: Partial<Record<WpFieldKey, { value?: string; html?: string }>> = {
    moa:         { value: projet.moa,         html: crm('moa', projet.moa) },
    bailleur:    { value: projet.bailleur,    html: crm('bailleur', projet.bailleur) },
    architecte:  { value: projet.architecte,  html: crm('architecte', projet.architecte) },
    betAssocies: { value: projet.betAssocies, html: crm('betAssocies', projet.betAssocies) },
    budget:      { value: projet.budgetHT },
    surface:     { value: projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined },
    entreprise:  { value: projet.entreprise,  html: crm('entreprise', projet.entreprise) },
    missionAi:   { value: projet.missionAi },
    programme:   { html: programmeHtml },
    // `programmeSecondaire` : pas de cellule autonome (rendu dans Programme).
    materiaux:   { value: materiaux },
  };

  // Champs effectivement rendus : valeur/html non vide, non masqués, dans
  // l'ordre du template (Str-Env ou Dev). Chaque champ porte son style effectif.
  const champsCles = wpFieldOrder(wpTemplate)
    .map((key) => {
      const d = fieldData[key];
      if (!d || (!d.value && !d.html)) return null;
      const st = effectiveFieldStyle(resolved, key);
      if (st.hidden) return null;
      return { key, label: WP_FIELD_LABELS[key], value: d.value, html: d.html, style: st };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  // Les catégories ne sont PLUS rendues dans le contenu : elles sont assignées
  // comme catégories WordPress (taxonomie) à l'export, depuis le champ Airtable
  // « Tags export WP » (cf. publish/route.ts → ensureCategoryIds). Le thème WP
  // les affiche alors au-dessus du titre.

  return `
<article style="font-family:${SANS};color:#000;line-height:1.6;">

  <!-- Le titre est rendu par le thème WP depuis post.title (ne pas dupliquer ici).
       margin-top = espacement titre ↔ accroche ; margin-bottom = accroche ↔ photo. -->
  <header style="margin:${spacing.titlePitchPx}px 0 ${spacing.pitchPhotoPx}px;">
    ${chiffresCles.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:24px;font-family:${SANS};font-size:10pt;line-height:1.4;color:#000;margin:0 0 16px;">
        ${chiffresCles.map(c => `
          <div><strong style="font-weight:700;">${esc(c.valeur)}</strong> ${esc(c.label)}</div>
        `).join('')}
      </div>` : ''}
    ${pitch ? `<p style="font-family:${SERIF};font-size:${typo.pitchSizePx}px;font-style:italic;line-height:1.4;color:${VIOLET};margin:0;max-width:780px;">${pitch}</p>` : ''}
  </header>

  <!-- Photo couverture + champs clés. coverFullWidth → photo pleine largeur
       au-dessus de la liste ; sinon côte à côte (2 colonnes). -->
  <div style="display:grid;grid-template-columns:${photos.coverFullWidth ? '1fr' : '1fr 1fr'};gap:48px;align-items:start;margin-bottom:${spacing.photoDescPx}px;">
    ${coverUrl
      ? `<figure data-ai-idx="0" style="margin:0;aspect-ratio:${photos.coverAspectRatio};overflow:hidden;background:${GRIS};cursor:pointer;">
          <img src="${esc(coverUrl)}" alt="${esc(projet.nom)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:${coverOffsetX}% ${coverOffsetY}%;display:block;pointer-events:none;" />
        </figure>`
      : '<div></div>'}
    <ul style="list-style:none;margin:0;padding:0;font-family:${SANS} !important;font-size:${typo.fieldsSizePt}pt !important;line-height:1.5 !important;color:#000;font-variant:normal !important;text-transform:none !important;letter-spacing:normal !important;">
      ${champsCles.map(f => {
        // Resets !important pour neutraliser le thème WP, + style par champ
        // (libellé vs valeur indépendants : poids, couleur, taille).
        // Tailles libellé / valeur indépendantes : la valeur retombe sur le
        // défaut global ; le libellé retombe sur sa propre taille, sinon sur la
        // taille valeur, sinon sur le défaut global.
        const valueSize = f.style.sizePt ?? typo.fieldsSizePt;
        const labelSize = f.style.labelSizePt ?? f.style.sizePt ?? typo.fieldsSizePt;
        // `reset` ne fige NI text-transform NI font-variant : définis par span
        // (le libellé reste normal ; la valeur peut être en petites/grandes
        // capitales). La taille est posée par span (libellé vs valeur).
        const reset = `font-family:${SANS} !important;letter-spacing:normal !important;`;
        const labelStyle = `${reset}font-size:${labelSize}pt !important;text-transform:none !important;font-variant:normal !important;font-weight:${f.style.labelBold ? 700 : 400} !important;color:${f.style.labelColor} !important;`;
        const valueStyle = `${reset}font-size:${valueSize}pt !important;text-transform:${f.style.upperCase ? 'uppercase' : 'none'} !important;font-variant:${f.style.smallCaps ? 'small-caps' : 'normal'} !important;font-weight:${f.style.valueBold ? 700 : 400} !important;color:${f.style.valueColor} !important;`;
        return `
        <li style="padding:8px 0;${reset}">
          <span style="${labelStyle}">${esc(f.label)} :</span> <span style="${valueStyle}">${f.html ?? esc(f.value!)}</span>
        </li>`;
      }).join('')}
    </ul>
  </div>

  ${(() => {
    // Blocs textuels et galerie réordonnables. La position du bloc
    // « Prestation Assemblage » (template Dev) est pilotée par
    // `photos.prestationPosition`.
    const descBlock = `
  <div class="ai-md" style="margin-bottom:48px;font-family:${SANS};font-size:${typo.descriptionSizePx}px;line-height:${typo.descriptionLineHeight};color:#1a1a1a;">
    ${renderMarkdown(description)}
  </div>`;
    const hasPresta = wpTemplate === 'Dev' && (projet.prestationAssemblage ?? '').trim();
    const p = resolved.prestation;
    const pLabelFont = p.labelFont === 'serif' ? SERIF : SANS;
    const pValueFont = p.valueFont === 'serif' ? SERIF : SANS;
    const prestaBlock = hasPresta ? `
  <section class="ai-md" style="margin:0 0 48px;font-family:${pValueFont};font-size:${p.valueSizePx}px;line-height:${p.valueLineHeight};color:${p.valueColor};font-weight:${p.valueBold ? 700 : 400};">
    <h2 style="font-family:${pLabelFont};font-size:${p.labelSizePt}pt;font-weight:${p.labelBold ? 700 : 400};line-height:1.2;color:${p.labelColor};margin:0 0 16px;letter-spacing:-0.01em;text-transform:${p.labelUpperCase ? 'uppercase' : 'none'};">Prestation Assemblage</h2>
    ${renderMarkdown(projet.prestationAssemblage!)}
  </section>` : '';
    const galleryBlock = renderGallerySlots(slots, projet.nom, photos);

    const position = photos.prestationPosition ?? 'after-description';
    if (!hasPresta) return descBlock + galleryBlock;
    if (position === 'before-description') return prestaBlock + descBlock + galleryBlock;
    if (position === 'after-photos') return descBlock + galleryBlock + prestaBlock;
    return descBlock + prestaBlock + galleryBlock; // after-description (défaut)
  })()}

  ${lightboxHtml(allPhotos, projet.nom)}

</article>`;
}

export function buildWpContent(
  projet: Projet,
  cover: WpPhoto | undefined,
  gallery: WpPhoto[],
  wpConfig?: WpConfig,
): string {
  // Tous les templates restants (Solo, Diptyque, Triptyque, Manuel) routent
  // vers le builder Editorial pour la publication WordPress. buildWpMagazine
  // est conservé en parallèle pour archivage mais n'est plus appelé.
  // `wpConfig` (optionnel) pilote la typo + la disposition des photos ;
  // absent → DEFAULT_WP_CONFIG = rendu historique.
  return buildWpEditorial(projet, cover, gallery, wpConfig);
}
