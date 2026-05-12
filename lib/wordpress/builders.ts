import type { Projet } from '@/types/projet';
import { renderMarkdown } from '@/lib/utils/markdown';

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
export const SANS   = "'Open Sans', system-ui, sans-serif";

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

// startIdx : index lightbox de la première photo (0 = couverture, 1+ = galerie)
export function imageGallery(urls: string[], alt: string, startIdx = 1): string {
  if (urls.length === 0) return '';
  const cols = urls.length === 1 ? 1 : urls.length === 2 ? 2 : 3;
  return `
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;margin:40px 0;">
      ${urls.map((u, i) => `
        <figure data-ai-idx="${startIdx + i}" style="margin:0;aspect-ratio:4/3;overflow:hidden;background:${GRIS};cursor:pointer;">
          <img src="${esc(u)}" alt="${esc(alt)} — photo ${startIdx + i}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;" />
        </figure>`).join('')}
    </div>`;
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

function buildWpEditorial(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  const pitch = esc(projet.pitch ?? '');
  const description = projet.description ?? '';
  const chiffresCles = projet.chiffresCles ?? [];
  const allPhotos = [coverUrl, ...photoUrls].filter((u): u is string => !!u);

  // Champs clés affichés à droite de la photo de couverture, dans l'ordre souhaité.
  // Mission AI mise en valeur en rouge. Filtre les champs vides automatiquement.
  const etat = projet.statut && projet.anneeLivraison
    ? `${projet.statut} en ${projet.anneeLivraison}`
    : projet.statut || (projet.anneeLivraison ? String(projet.anneeLivraison) : undefined);

  // Programme : principal en valeur, secondaire en complément entre parenthèses
  // (variante WP — pas de structure "sub" comme dans le PDF, on reste sur
  // une liste à puces, donc on combine sur une ligne).
  const programme = projet.programmePrincipal && projet.programmeSecondaire
    ? `${projet.programmePrincipal} (${projet.programmeSecondaire})`
    : projet.programmePrincipal ?? projet.programmeSecondaire;

  const champsCles: { label: string; value?: string; highlight?: boolean }[] = [
    { label: 'Lieu',              value: projet.lieu },
    { label: "Maître d'ouvrage", value: projet.moa },
    { label: 'Architecte',       value: projet.architecte },
    { label: 'Mission AI',       value: projet.missionAi, highlight: true },
    { label: 'Mandataire',       value: projet.mandataire },
    { label: 'BET associés',     value: projet.betAssocies },
    { label: 'Entreprise',       value: projet.entreprise },
    { label: 'Bailleur',         value: projet.bailleur },
    { label: 'Programme',        value: programme },
    { label: 'Surface',          value: projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined },
    { label: 'Budget',           value: projet.budgetHT },
    { label: 'État',             value: etat },
  ].filter(f => !!f.value);

  return `
<article style="font-family:${SANS};color:#000;line-height:1.6;">

  <!-- Titre du projet (Open Sans 14pt) + pitch.
       Note : le thème WP rend aussi post.title — si doublon visible, masquer
       le titre du thème côté WP plutôt que de retirer ce <h1>. -->
  <header style="margin:0 0 40px;">
    <h1 style="font-family:${SANS};font-size:14pt;font-weight:700;line-height:1.2;color:#000;margin:0 0 12px;">${esc(projet.nom)}</h1>
    ${chiffresCles.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:24px;font-family:${SANS};font-size:10pt;line-height:1.4;color:#000;margin:0 0 16px;">
        ${chiffresCles.map(c => `
          <div><strong style="font-weight:700;">${esc(c.valeur)}</strong> ${esc(c.label)}</div>
        `).join('')}
      </div>` : ''}
    ${pitch ? `<p style="font-family:${SERIF};font-size:20px;font-style:italic;line-height:1.4;color:${VIOLET};margin:0;max-width:780px;">${pitch}</p>` : ''}
  </header>

  <!-- Photo couverture (gauche) + champs clés (droite) -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start;margin-bottom:48px;">
    <div>
      ${coverUrl
        ? `<figure data-ai-idx="0" style="margin:0;aspect-ratio:4/3;overflow:hidden;background:${GRIS};cursor:pointer;">
            <img src="${esc(coverUrl)}" alt="${esc(projet.nom)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;" />
          </figure>`
        : ''}
    </div>
    <ul style="list-style:none;margin:0;padding:0;font-family:${SANS};font-size:10pt;line-height:1.5;color:#000;">
      ${champsCles.map(f => `
        <li style="padding:6px 0;${f.highlight ? `color:${ROUGE};` : ''}font-weight:400;">
          <span>${esc(f.label)} :</span> ${esc(f.value!)}
        </li>`).join('')}
    </ul>
  </div>

  <!-- Description pleine largeur, 1 colonne — markdown rendu -->
  <div class="ai-md" style="border-top:1px dotted ${ROUGE};padding-top:32px;margin-bottom:48px;font-family:${SANS};font-size:16px;line-height:1.7;color:#1a1a1a;">
    ${renderMarkdown(description)}
  </div>

  <!-- Galerie des photos restantes (cover déjà affichée en haut, idx 0) -->
  ${imageGallery(photoUrls, projet.nom, 1)}

  ${lightboxHtml(allPhotos, projet.nom)}

</article>`;
}

export function buildWpContent(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  // Tous les templates restants (Solo, Diptyque, Triptyque, Manuel) routent
  // vers le builder Editorial pour la publication WordPress. buildWpMagazine
  // est conservé en parallèle pour archivage mais n'est plus appelé.
  return buildWpEditorial(projet, coverUrl, photoUrls);
}
