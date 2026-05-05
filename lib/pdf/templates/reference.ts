import type { Projet } from '@/types/projet';
import {
  TemplateBundle,
  esc,
  photoImg, allPhotos,
} from './shared';

const CSS = `
:root {
  --ai-rouge: #E30513;
  --ai-violet: #30323E;
  --ai-gris: #DFE4E8;
  --ai-gris-tres-clair: #F2F2F2;
  --ai-noir70: #4D4D4D;
  --ai-noir: #000000;
  --serif: 'Newsreader', Georgia, serif;
  --sans: 'Open Sans', system-ui, sans-serif;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: white; font-family: var(--sans); color: var(--ai-noir); }

.ref-wrap {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 40px 64px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Header */
.ref-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1.5px solid var(--ai-rouge);
  padding-bottom: 8px;
}
.ref-header-label {
  font-family: var(--sans);
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ai-noir70);
}
.ref-header-statut {
  font-family: var(--sans);
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ai-rouge);
}

/* Photo couverture */
.ref-cover {
  width: 100%;
  height: 340px;
  overflow: hidden;
  background: var(--ai-gris-tres-clair);
}
.ref-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Titre */
.ref-title-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  flex-wrap: wrap;
}
.ref-affaire {
  font-family: var(--sans);
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--ai-rouge);
  white-space: nowrap;
  flex-shrink: 0;
}
.ref-h1 {
  font-family: var(--serif);
  font-size: 28pt;
  font-weight: 500;
  color: var(--ai-noir);
  line-height: 1.05;
  flex: 1;
}
.ref-tag {
  font-family: var(--sans);
  font-size: 7.5pt;
  font-weight: 600;
  color: var(--ai-noir70);
  background: var(--ai-gris-tres-clair);
  padding: 3px 8px;
  border-radius: 2px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Sous-titre */
.ref-subtitle {
  font-family: var(--sans);
  font-size: 9pt;
  color: var(--ai-noir70);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.ref-subtitle-sep { color: var(--ai-gris); user-select: none; }

/* Pitch */
.ref-pitch {
  font-family: var(--serif);
  font-size: 13pt;
  font-style: italic;
  font-weight: 300;
  color: var(--ai-noir70);
  line-height: 1.4;
}

/* Grille données clés */
.ref-meta {
  display: grid;
  border-top: 1.5px solid var(--ai-noir);
  border-bottom: 1.5px solid var(--ai-noir);
  padding: 10px 0;
}
.ref-meta-item {
  padding: 0 12px;
  border-right: 1px solid var(--ai-gris);
}
.ref-meta-item:first-child { padding-left: 0; }
.ref-meta-item:last-child { padding-right: 0; border-right: none; }
.ref-meta-label {
  font-family: var(--sans);
  font-size: 6.5pt;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ai-rouge);
  margin-bottom: 3px;
  display: block;
}
.ref-meta-value {
  font-family: var(--serif);
  font-size: 11pt;
  font-weight: 500;
  color: var(--ai-noir);
  line-height: 1.2;
}

/* Description */
.ref-description {
  font-family: var(--sans);
  font-size: 9.5pt;
  line-height: 1.65;
  color: var(--ai-noir);
  column-count: 2;
  column-gap: 32px;
  column-rule: 1px solid var(--ai-gris);
}
.ref-description p { margin-bottom: 10px; break-inside: avoid; }

/* Photos projet */
.ref-photos-title {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ai-rouge);
  border-top: 1px solid var(--ai-gris);
  padding-top: 14px;
}
.ref-photos-grid {
  display: grid;
  gap: 8px;
}
.ref-photos-grid img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
  background: var(--ai-gris-tres-clair);
}

/* Intervenants */
.ref-section-title {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ai-rouge);
  border-top: 1px solid var(--ai-gris);
  padding-top: 14px;
  margin-bottom: 10px;
}
.ref-actors {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 0;
}
.ref-actor-item {}
.ref-actor-label {
  font-family: var(--sans);
  font-size: 6.5pt;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ai-noir70);
  display: block;
  margin-bottom: 2px;
}
.ref-actor-value {
  font-family: var(--sans);
  font-size: 9pt;
  color: var(--ai-noir);
}

/* Tags */
.ref-tags-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  border-top: 1px solid var(--ai-gris);
  padding-top: 14px;
}
.ref-badge {
  font-family: var(--sans);
  font-size: 7.5pt;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  background: var(--ai-gris-tres-clair);
  border: 1px solid var(--ai-gris);
  border-radius: 2px;
  color: var(--ai-noir70);
}
.ref-badge-cert {
  background: var(--ai-violet);
  border-color: var(--ai-violet);
  color: white;
}

/* Footer */
.ref-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--ai-gris);
  padding-top: 10px;
  font-family: var(--sans);
  font-size: 7.5pt;
  color: var(--ai-noir70);
}
.ref-footer-sigle {
  font-family: var(--serif);
  font-size: 18pt;
  font-weight: 700;
  color: var(--ai-rouge);
  line-height: 1;
}
`;

export function renderReference(projet: Projet): TemplateBundle {
  const photos = allPhotos(projet);
  const cover = photos[0];
  const extraPhotos = photos.slice(1);

  const subtitleParts = [projet.adresse, projet.programme, projet.missionAi].filter(Boolean);
  const subtitle = subtitleParts.length
    ? `<div class="ref-subtitle">
        ${subtitleParts.map((p, i) => `
          ${i > 0 ? '<span class="ref-subtitle-sep">·</span>' : ''}
          <span>${esc(p!)}</span>
        `).join('')}
       </div>`
    : '';

  const metaItems: { label: string; value: string }[] = [];
  if (projet.moa)            metaItems.push({ label: "Maître d'ouvrage", value: projet.moa });
  if (projet.surface)        metaItems.push({ label: 'Surface', value: `${projet.surface.toLocaleString('fr-FR')} m²` });
  if (projet.budgetHT)       metaItems.push({ label: 'Budget HT', value: projet.budgetHT });
  if (projet.anneeLivraison) metaItems.push({ label: 'Livraison', value: String(projet.anneeLivraison) });
  if (projet.rehabNeuf)      metaItems.push({ label: 'Nature', value: projet.rehabNeuf });
  if (projet.departement)    metaItems.push({ label: 'Département', value: projet.departement });

  const metaGrid = metaItems.length
    ? `<div class="ref-meta" style="grid-template-columns:repeat(${Math.min(metaItems.length, 6)},1fr);">
        ${metaItems.map(m => `
          <div class="ref-meta-item">
            <span class="ref-meta-label">${esc(m.label)}</span>
            <div class="ref-meta-value">${esc(m.value)}</div>
          </div>
        `).join('')}
       </div>`
    : '';

  const paragraphs = (projet.description ?? '').trim().split(/\n\n+/).filter(Boolean);
  const description = paragraphs.length
    ? `<div class="ref-description">
        ${paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}
       </div>`
    : '';

  // Grille photos : 1 col si 1 photo, 2 cols si 2, 3 cols si ≥ 3
  const photosBlock = extraPhotos.length
    ? `<div>
        <div class="ref-photos-title">Photos du projet</div>
        <div class="ref-photos-grid" style="margin-top:10px;grid-template-columns:repeat(${Math.min(extraPhotos.length, 3)},1fr);">
          ${extraPhotos.map(p => `<img src="${esc(p.url)}" alt="${esc(projet.nom)}" />`).join('')}
        </div>
       </div>`
    : '';

  const actors: { label: string; value: string }[] = [
    projet.mandataire  ? { label: 'Mandataire',   value: projet.mandataire }  : null,
    projet.architecte  ? { label: 'Architecte',   value: projet.architecte }  : null,
    projet.betAssocies ? { label: 'BET associés', value: projet.betAssocies } : null,
    projet.entreprise  ? { label: 'Entreprise',   value: projet.entreprise }  : null,
    projet.bailleur    ? { label: 'Bailleur',      value: projet.bailleur }    : null,
    projet.referentAi  ? { label: 'Référent AI',  value: projet.referentAi }  : null,
  ].filter((a): a is { label: string; value: string } => a !== null);

  const actorsBlock = actors.length
    ? `<div>
        <div class="ref-section-title">Intervenants</div>
        <div class="ref-actors">
          ${actors.map(a => `
            <div class="ref-actor-item">
              <span class="ref-actor-label">${esc(a.label)}</span>
              <span class="ref-actor-value">${esc(a.value)}</span>
            </div>
          `).join('')}
        </div>
       </div>`
    : '';

  const allTags = [
    ...projet.certifications.map(c => ({ text: c, cert: true })),
    ...projet.motsCles.map(k => ({ text: k, cert: false })),
  ];
  const tagsBlock = allTags.length
    ? `<div class="ref-tags-row">
        ${allTags.map(t => `
          <span class="ref-badge ${t.cert ? 'ref-badge-cert' : ''}">${esc(t.text)}</span>
        `).join('')}
       </div>`
    : '';

  const body = `<div class="ref-wrap">
    <header class="ref-header">
      <span class="ref-header-label">Assemblage ingénierie · Référence Projet</span>
      <span class="ref-header-statut">● ${esc(projet.statut)}</span>
    </header>

    ${cover ? `<div class="ref-cover">${photoImg(cover, projet.nom)}</div>` : ''}

    <div class="ref-title-row">
      ${projet.affaire ? `<span class="ref-affaire">${esc(projet.affaire)}</span>` : ''}
      <h1 class="ref-h1">${esc(projet.nom)}</h1>
      ${projet.pole ? `<span class="ref-tag">${esc(projet.pole)}</span>` : ''}
    </div>

    ${subtitle}

    ${metaGrid}

    ${projet.pitch ? `<p class="ref-pitch">${esc(projet.pitch)}</p>` : ''}

    ${description}

    ${photosBlock}

    ${actorsBlock}

    ${tagsBlock}

    <footer class="ref-footer">
      <span class="ref-footer-sigle">.A</span>
      <span>Assemblage ingénierie · Références projets</span>
      <span>${projet.affaire ?? ''}</span>
    </footer>
  </div>`;

  return { body, css: CSS };
}
