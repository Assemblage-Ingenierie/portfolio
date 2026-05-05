import type { Projet } from '@/types/projet';
import {
  TemplateBundle,
  headerHtml, footerHtml, esc,
  photoImg, allPhotos,
} from './shared';

const CSS = `
.ref-page {
  padding: 10mm 16mm 10mm 16mm;
  display: flex;
  flex-direction: column;
  gap: 3.5mm;
}

.ref-page > * { flex: 0 0 auto; }

.ref-hero {
  width: 100%;
  height: 58mm;
  overflow: hidden;
  background: var(--ai-gris-tres-clair);
}
.ref-hero .photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ref-title-row {
  display: flex;
  align-items: baseline;
  gap: 6mm;
}
.ref-affaire {
  font-family: var(--sans);
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--ai-rouge);
  white-space: nowrap;
}
.ref-h1 {
  font-family: var(--serif);
  font-size: 20pt;
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
  padding: 1.5mm 3mm;
  border-radius: 1px;
  white-space: nowrap;
}

.ref-subtitle {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ai-noir70);
  display: flex;
  gap: 3mm;
  flex-wrap: wrap;
}
.ref-subtitle-sep { color: var(--ai-gris); }

.ref-meta {
  display: grid;
  border-top: 1.5px solid var(--ai-noir);
  border-bottom: 1.5px solid var(--ai-noir);
  padding: 2.5mm 0;
}
.ref-meta-item {
  padding: 0 2.5mm;
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
  margin-bottom: 1mm;
  display: block;
}
.ref-meta-value {
  font-family: var(--serif);
  font-size: 10pt;
  font-weight: 500;
  color: var(--ai-noir);
  line-height: 1.2;
}

.ref-pitch {
  font-family: var(--serif);
  font-size: 10.5pt;
  font-style: italic;
  font-weight: 300;
  color: var(--ai-noir70);
  line-height: 1.35;
}

.ref-description {
  font-family: var(--sans);
  font-size: 9pt;
  line-height: 1.5;
  color: var(--ai-noir);
  column-count: 2;
  column-gap: 6mm;
  column-rule: 1px solid var(--ai-gris);
}
.ref-description p { margin-bottom: 2mm; break-inside: avoid; }

.ref-actors {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--ai-gris);
  padding-top: 2.5mm;
}
.ref-actor-item { padding: 0 3mm 2mm 0; }
.ref-actor-label {
  font-family: var(--sans);
  font-size: 6.5pt;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ai-noir70);
  display: block;
  margin-bottom: 0.5mm;
}
.ref-actor-value {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ai-noir);
}

.ref-tags-row {
  display: flex;
  gap: 2mm;
  flex-wrap: wrap;
  align-items: center;
  border-top: 1px solid var(--ai-gris);
  padding-top: 2.5mm;
}
.ref-badge {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 1mm 2.5mm;
  background: var(--ai-gris-tres-clair);
  border: 1px solid var(--ai-gris);
  border-radius: 1px;
  color: var(--ai-noir70);
}
.ref-badge-cert {
  background: var(--ai-violet);
  border-color: var(--ai-violet);
  color: white;
}
`;

export function renderReference(projet: Projet): TemplateBundle {
  const photos = allPhotos(projet);
  const cover = photos[0];

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

  const actors: { label: string; value: string }[] = [
    projet.mandataire  ? { label: 'Mandataire',   value: projet.mandataire }  : null,
    projet.architecte  ? { label: 'Architecte',   value: projet.architecte }  : null,
    projet.betAssocies ? { label: 'BET associés', value: projet.betAssocies } : null,
    projet.entreprise  ? { label: 'Entreprise',   value: projet.entreprise }  : null,
    projet.bailleur    ? { label: 'Bailleur',      value: projet.bailleur }    : null,
    projet.referentAi  ? { label: 'Référent AI',  value: projet.referentAi }  : null,
  ].filter((a): a is { label: string; value: string } => a !== null);

  const actorsBlock = actors.length
    ? `<div class="ref-actors">
        ${actors.map(a => `
          <div class="ref-actor-item">
            <span class="ref-actor-label">${esc(a.label)}</span>
            <span class="ref-actor-value">${esc(a.value)}</span>
          </div>
        `).join('')}
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

  const body = `<article class="page ref-page">
    ${headerHtml(projet)}

    ${cover ? `<div class="ref-hero photo-frame">${photoImg(cover, projet.nom)}</div>` : ''}

    <div class="ref-title-row">
      ${projet.affaire ? `<span class="ref-affaire">${esc(projet.affaire)}</span>` : ''}
      <h1 class="ref-h1">${esc(projet.nom)}</h1>
      ${projet.pole ? `<span class="ref-tag">${esc(projet.pole)}</span>` : ''}
      <span class="ref-tag" style="color:var(--ai-rouge);">${esc(projet.statut)}</span>
    </div>

    ${subtitle}

    ${metaGrid}

    ${projet.pitch ? `<p class="ref-pitch">${esc(projet.pitch)}</p>` : ''}

    ${description}

    ${actorsBlock}

    ${tagsBlock}

    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
