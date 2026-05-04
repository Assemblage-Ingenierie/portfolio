import type { Projet } from '@/types/projet';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,300;1,6..72,400;1,6..72,500&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">`;

const CSS = `
@page { size: A4; margin: 0; }
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { background: white; }
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

/* ── Editorial ── */
.ed-page {
  width: 210mm;
  padding: 14mm 18mm 12mm 18mm;
  background: white;
  display: flex; flex-direction: column; gap: 5mm;
  position: relative;
}
.ed-header {
  display: flex; justify-content: space-between; align-items: baseline;
  border-bottom: 1px solid var(--ai-rouge); padding-bottom: 3mm;
}
.ed-header-meta {
  font-family: var(--sans); font-size: 8pt; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--ai-noir70);
}
.ed-header-statut {
  font-family: var(--sans); font-size: 8pt; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--ai-rouge);
}
.ed-surtitre {
  font-family: var(--sans); font-size: 9pt; font-weight: 600;
  color: var(--ai-noir70); letter-spacing: 0.05em; margin-bottom: 2.5mm;
}
.ed-h1 {
  font-family: var(--serif); font-size: 36pt; font-weight: 500;
  line-height: 1.05; color: var(--ai-noir); letter-spacing: -0.015em; margin-bottom: 2.5mm;
}
.ed-pitch {
  font-family: var(--serif); font-size: 12pt; font-weight: 300;
  line-height: 1.35; color: var(--ai-noir70); max-width: 80%; font-style: italic;
}
.ed-info-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--ai-noir); border-bottom: 1px solid var(--ai-noir);
  padding: 2.5mm 0;
}
.ed-info-item { padding: 0 4mm 0 0; border-right: 1px solid var(--ai-gris); }
.ed-info-item:last-child { border-right: none; }
.ed-info-label {
  font-family: var(--sans); font-size: 7pt; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase; color: var(--ai-rouge);
  margin-bottom: 1mm; display: block;
}
.ed-info-value { font-family: var(--serif); font-size: 11pt; font-weight: 500; line-height: 1.2; color: var(--ai-noir); }
.ed-info-value-sub { font-family: var(--sans); font-size: 8pt; font-weight: 400; color: var(--ai-noir70); margin-top: 0.5mm; }
.ed-info-sec {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(40mm, 1fr)); gap: 2.5mm 5mm;
}
.ed-info-sec-label {
  font-family: var(--sans); font-size: 6.5pt; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--ai-noir70);
  margin-bottom: 0.5mm; display: block;
}
.ed-info-sec-value { font-family: var(--sans); font-size: 9pt; font-weight: 600; line-height: 1.2; color: var(--ai-noir); }
.ed-contenu { display: grid; grid-template-columns: 1fr 1.4fr; gap: 6mm; flex: 1; }
.ed-contenu-no-photos { grid-template-columns: 1fr; }
.ed-texte { display: flex; flex-direction: column; gap: 3mm; }
.ed-texte-p { font-family: var(--sans); font-size: 9pt; font-weight: 400; line-height: 1.45; color: var(--ai-noir); }
.ed-lettrine::first-letter {
  font-family: var(--serif); font-size: 32pt; font-weight: 600; color: var(--ai-violet);
  float: left; line-height: 0.85; padding: 1mm 2mm 0 0;
}
.ed-photos { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 60mm 40mm 40mm; gap: 2mm; }
.ed-photo { background-size: cover; background-position: center; background-color: var(--ai-gris); overflow: hidden; }
.ed-photo-1 { grid-column: 1 / 3; grid-row: 1; }
.ed-photo-2 { grid-column: 1; grid-row: 2; }
.ed-photo-3 { grid-column: 2; grid-row: 2; }
.ed-photo-4 { grid-column: 1 / 3; grid-row: 3; }
.ed-footer {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid var(--ai-gris); padding-top: 2.5mm;
  font-family: var(--sans); font-size: 7pt; color: var(--ai-noir70);
}
.ed-footer-sigle { font-family: var(--serif); font-size: 14pt; font-weight: 700; color: var(--ai-rouge); line-height: 1; }
.ed-footer-legal { text-align: center; flex: 1; padding: 0 6mm; }
.ed-footer-ref { text-align: right; font-weight: 600; letter-spacing: 0.05em; }

/* ── Magazine ── */
.mag-page {
  width: 210mm; background: white;
  position: relative; display: grid; grid-template-rows: 80mm 1fr auto auto;
}
.mag-hero {
  position: relative; background-size: cover; background-position: center;
  overflow: hidden; background-color: var(--ai-violet);
}
.mag-hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 50%, rgba(48,50,62,0.7) 100%);
}
.mag-hero-marque {
  position: absolute; top: 8mm; right: 18mm;
  font-family: var(--sans); font-size: 8pt; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase; color: white; z-index: 2;
}
.mag-hero-marque-sigle { color: var(--ai-rouge); font-family: var(--serif); font-weight: 700; font-size: 12pt; }
.mag-hero-content {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 10mm 18mm; z-index: 2; color: white;
}
.mag-badge {
  display: inline-block; background: var(--ai-rouge); color: white;
  padding: 1.5mm 4mm; font-family: var(--sans); font-size: 8pt; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 3mm;
}
.mag-hero-h1 {
  font-family: var(--serif); font-size: 38pt; font-weight: 400;
  line-height: 0.95; letter-spacing: -0.02em; margin-bottom: 3mm;
}
.mag-hero-lieu { font-family: var(--sans); font-size: 9.5pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.85; }
.mag-corps { display: grid; grid-template-columns: 65mm 1fr; gap: 0; padding: 10mm 18mm 6mm 18mm; }
.mag-sidebar { padding-right: 8mm; border-right: 1px solid var(--ai-gris); }
.mag-sidebar-pitch {
  font-family: var(--serif); font-size: 13pt; font-style: italic; font-weight: 400;
  line-height: 1.3; color: var(--ai-violet);
  margin-bottom: 5mm; padding-bottom: 5mm; border-bottom: 2px solid var(--ai-rouge);
}
.mag-info-item { margin-bottom: 3mm; }
.mag-info-label {
  font-family: var(--sans); font-size: 6.5pt; font-weight: 700;
  letter-spacing: 0.15em; text-transform: uppercase; color: var(--ai-noir70);
  margin-bottom: 0.8mm; display: block;
}
.mag-info-value { font-family: var(--serif); font-size: 10.5pt; font-weight: 600; line-height: 1.2; color: var(--ai-noir); }
.mag-info-value-sub { font-family: var(--sans); font-size: 7.5pt; font-weight: 400; color: var(--ai-noir70); margin-top: 0.5mm; }
.mag-info-sec { margin-top: 5mm; padding-top: 5mm; border-top: 1px dotted var(--ai-gris); }
.mag-info-sec .mag-info-item { margin-bottom: 2mm; }
.mag-info-sec .mag-info-label { font-size: 6pt; margin-bottom: 0.3mm; }
.mag-info-sec .mag-info-value { font-family: var(--sans); font-size: 8.5pt; font-weight: 600; color: var(--ai-noir); line-height: 1.2; }
.mag-chiffres { margin-top: 5mm; padding-top: 5mm; border-top: 1px solid var(--ai-gris); }
.mag-gros-chiffre { margin-bottom: 3mm; }
.mag-nombre { font-family: var(--serif); font-size: 26pt; font-weight: 600; line-height: 1; color: var(--ai-violet); letter-spacing: -0.02em; }
.mag-legende { font-family: var(--sans); font-size: 7.5pt; font-weight: 600; color: var(--ai-noir70); letter-spacing: 0.05em; text-transform: uppercase; margin-top: 0.5mm; }
.mag-principal { padding-left: 8mm; }
.mag-principal-h2 {
  font-family: var(--serif); font-size: 22pt; font-weight: 500;
  line-height: 1.1; color: var(--ai-noir); letter-spacing: -0.01em; margin-bottom: 4mm;
}
.mag-article-text { column-count: 2; column-gap: 5mm; column-rule: 1px solid var(--ai-gris); }
.mag-article-p { font-family: var(--sans); font-size: 9pt; font-weight: 400; line-height: 1.5; color: var(--ai-noir); margin-bottom: 2mm; break-inside: avoid; }
.mag-intro::first-letter {
  font-family: var(--serif); font-size: 36pt; font-weight: 600; color: var(--ai-violet);
  float: left; line-height: 0.85; padding: 1mm 2mm 0 0; font-style: italic;
}
.mag-galerie { margin-top: 5mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; height: 32mm; }
.mag-galerie-photo { background-size: cover; background-position: center; overflow: hidden; background-color: var(--ai-gris); }
.mag-footer {
  background: var(--ai-violet); color: white; padding: 4mm 18mm;
  display: flex; justify-content: space-between; align-items: center;
  font-family: var(--sans); font-size: 7pt;
}
.mag-footer-sigle { font-family: var(--serif); font-size: 14pt; font-weight: 700; color: var(--ai-rouge); }
.mag-footer-legal { text-align: center; flex: 1; padding: 0 6mm; opacity: 0.8; }
.mag-footer-ref { text-align: right; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ai-rouge); }

/* ── Tags ── */
.tags-editorial {
  display: flex; flex-wrap: wrap; gap: 3mm 5mm; align-items: flex-start;
  padding: 3mm 0 0 0; border-top: 1px dotted var(--ai-gris);
}
.tags-magazine {
  padding: 4mm 18mm; background: var(--ai-gris-tres-clair);
  display: flex; flex-wrap: wrap; gap: 3mm 5mm; align-items: flex-start;
}
.tag-group { display: flex; flex-wrap: wrap; align-items: center; gap: 1.5mm; }
.tag-group-label {
  font-family: var(--sans); font-size: 6.5pt; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--ai-noir70); margin-right: 1mm;
}
.tag-cert { font-family: var(--sans); font-size: 7.5pt; font-weight: 600; padding: 0.8mm 2.5mm; background: var(--ai-violet); color: white; border-radius: 1mm; line-height: 1.3; white-space: nowrap; }
.tag-mat { font-family: var(--sans); font-size: 7.5pt; font-weight: 600; padding: 0.8mm 2.5mm; background: var(--ai-gris); color: var(--ai-noir); border-radius: 1mm; line-height: 1.3; white-space: nowrap; }
.tag-mat-mag { font-family: var(--sans); font-size: 7.5pt; font-weight: 600; padding: 0.8mm 2.5mm; background: white; color: var(--ai-noir); border-radius: 1mm; line-height: 1.3; white-space: nowrap; }
.tag-mc { font-family: var(--sans); font-size: 7.5pt; font-weight: 400; padding: 0.8mm 2.5mm; background: transparent; color: var(--ai-noir70); border: 1px solid var(--ai-gris); border-radius: 1mm; line-height: 1.3; white-space: nowrap; font-style: italic; }
`;

function tagsHtml(projet: Projet, variant: 'editorial' | 'magazine'): string {
  const { certifications, materiaux, motsCles, tagsSiteWeb } = projet;
  if (!certifications.length && !materiaux.length && !motsCles.length && !tagsSiteWeb.length) return '';

  const zoneClass = variant === 'magazine' ? 'tags-magazine' : 'tags-editorial';
  const matClass = variant === 'magazine' ? 'tag-mat-mag' : 'tag-mat';

  const groups: string[] = [];

  if (certifications.length)
    groups.push(`<div class="tag-group"><span class="tag-group-label">Certification</span>${certifications.map(c => `<span class="tag-cert">${esc(c)}</span>`).join('')}</div>`);

  if (materiaux.length)
    groups.push(`<div class="tag-group"><span class="tag-group-label">Matériaux</span>${materiaux.map(m => `<span class="${matClass}">${esc(m)}</span>`).join('')}</div>`);

  if (tagsSiteWeb.length)
    groups.push(`<div class="tag-group"><span class="tag-group-label">Mots-clés</span>${tagsSiteWeb.map(t => `<span class="tag-mc">${esc(t)}</span>`).join('')}</div>`);

  if (motsCles.length && motsCles !== tagsSiteWeb)
    groups.push(`<div class="tag-group">${tagsSiteWeb.length === 0 ? '<span class="tag-group-label">Mots-clés</span>' : ''}${motsCles.map(m => `<span class="tag-mc">${esc(m)}</span>`).join('')}</div>`);

  return `<div class="${zoneClass}">${groups.join('')}</div>`;
}

function editorialHtml(projet: Projet): string {
  const allPhotos = [projet.photoCouverture, ...(projet.photosProjet ?? [])].filter(Boolean) as { url: string }[];
  const hasPhotos = allPhotos.length > 0;

  const secItems = [
    ['Pôle', projet.pole], ['Département', projet.departement], ['Programme', projet.programme],
    ['Rehab / Neuf', projet.rehabNeuf], ['Mandataire', projet.mandataire],
    ['BET associés', projet.betAssocies], ['Entreprise', projet.entreprise], ['Bailleur', projet.bailleur],
  ].filter(([, v]) => v) as [string, string][];

  const infoItems = [
    { label: "Maître d'ouvrage", value: projet.moa },
    { label: 'Architecte', value: projet.architecte },
    { label: 'Budget · Surface', value: projet.budgetHT, sub: projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined },
    { label: 'Calendrier', value: projet.anneeLivraison, sub: projet.missionAi ?? undefined },
  ].filter(i => i.value || i.value === 0);

  const paragraphs = projet.description.split(/\n\n+/).filter(Boolean);

  return `
<article class="ed-page">
  <header class="ed-header">
    <div class="ed-header-meta">Assemblage ingénierie · Référence Projet</div>
    <div class="ed-header-statut">● ${esc(projet.statut)}</div>
  </header>

  <div>
    ${projet.adresse ? `<div class="ed-surtitre">${esc(projet.adresse)}</div>` : ''}
    <h1 class="ed-h1">${esc(projet.nom)}</h1>
    ${projet.pitch ? `<p class="ed-pitch">${esc(projet.pitch)}</p>` : ''}
  </div>

  ${infoItems.length ? `
  <div class="ed-info-grid">
    ${infoItems.map(i => `
    <div class="ed-info-item">
      <span class="ed-info-label">${esc(i.label)}</span>
      <div class="ed-info-value">${esc(i.value)}</div>
      ${i.sub ? `<div class="ed-info-value-sub">${esc(i.sub)}</div>` : ''}
    </div>`).join('')}
  </div>` : ''}

  ${secItems.length ? `
  <div class="ed-info-sec">
    ${secItems.map(([l, v]) => `
    <div>
      <span class="ed-info-sec-label">${esc(l)}</span>
      <div class="ed-info-sec-value">${esc(v)}</div>
    </div>`).join('')}
  </div>` : ''}

  <div class="ed-contenu${hasPhotos ? '' : ' ed-contenu-no-photos'}">
    <div class="ed-texte">
      ${paragraphs.map((p, i) => `<p class="ed-texte-p${i === 0 ? ' ed-lettrine' : ''}">${esc(p)}</p>`).join('')}
      ${projet.chiffresCles?.length ? `
      <div style="border-top:1px solid var(--ai-rouge);padding-top:2.5mm;margin-top:2mm">
        <h3 style="font-family:var(--sans);font-size:8pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--ai-rouge);margin-bottom:1.5mm">Chiffres clés</h3>
        <ul style="list-style:none">
          ${projet.chiffresCles.map(c => `<li style="font-family:var(--sans);font-size:8.5pt;line-height:1.4;padding:0.8mm 0;border-bottom:1px dotted var(--ai-gris);display:flex;justify-content:space-between">${esc(c.label)} <strong style="font-family:var(--serif);font-weight:600">${esc(c.valeur)}</strong></li>`).join('')}
        </ul>
      </div>` : ''}
    </div>
    ${hasPhotos ? `
    <div class="ed-photos">
      ${allPhotos[0] ? `<div class="ed-photo ed-photo-1" style="background-image:url('${allPhotos[0].url}')"></div>` : ''}
      ${allPhotos[1] ? `<div class="ed-photo ed-photo-2" style="background-image:url('${allPhotos[1].url}')"></div>` : ''}
      ${allPhotos[2] ? `<div class="ed-photo ed-photo-3" style="background-image:url('${allPhotos[2].url}')"></div>` : ''}
      ${allPhotos[3] ? `<div class="ed-photo ed-photo-4" style="background-image:url('${allPhotos[3].url}')"></div>` : ''}
    </div>` : ''}
  </div>

  ${tagsHtml(projet, 'editorial')}

  <footer class="ed-footer">
    <span class="ed-footer-sigle">.A</span>
    <div class="ed-footer-legal"><strong>Assemblage ingénierie</strong> S.A.S · 137 rue d'Aboukir, 75002 Paris · contact@assemblage.net · assemblage.net</div>
    <div class="ed-footer-ref">${esc(projet.affaire)}</div>
  </footer>
</article>`;
}

function magazineHtml(projet: Projet): string {
  const paragraphs = projet.description.split(/\n\n+/).filter(Boolean);
  const badge = [projet.programme, projet.pole].filter(Boolean).join(' · ');
  const heroStyle = projet.photoCouverture ? `background-image:url('${projet.photoCouverture.url}')` : '';
  const galleryPhotos = projet.photosProjet?.slice(0, 3) ?? [];
  const hasGallery = galleryPhotos.length > 0;

  const secItems = [
    ['Pôle', projet.pole], ['Département', projet.departement], ['Programme', projet.programme],
    ['Rehab / Neuf', projet.rehabNeuf], ['Mandataire', projet.mandataire],
    ['BET associés', projet.betAssocies], ['Entreprise', projet.entreprise], ['Bailleur', projet.bailleur],
  ].filter(([, v]) => v) as [string, string][];

  return `
<article class="mag-page">
  <header class="mag-hero"${heroStyle ? ` style="${heroStyle}"` : ''}>
    <div class="mag-hero-overlay"></div>
    <div class="mag-hero-marque">Assemblage ingénierie · <span class="mag-hero-marque-sigle">.A</span></div>
    <div class="mag-hero-content">
      ${badge ? `<span class="mag-badge">${esc(badge)}</span>` : ''}
      <h1 class="mag-hero-h1">${esc(projet.nom)}</h1>
      ${projet.adresse ? `<div class="mag-hero-lieu">${esc(projet.adresse)}</div>` : ''}
    </div>
  </header>

  <div class="mag-corps">
    <aside class="mag-sidebar">
      ${projet.pitch ? `<p class="mag-sidebar-pitch">${esc(projet.pitch)}</p>` : ''}
      ${projet.moa ? `<div class="mag-info-item"><span class="mag-info-label">Maître d'ouvrage</span><div class="mag-info-value">${esc(projet.moa)}</div></div>` : ''}
      ${projet.missionAi ? `<div class="mag-info-item"><span class="mag-info-label">Mission</span><div class="mag-info-value">${esc(projet.missionAi)}</div><div class="mag-info-value-sub">Assemblage ingénierie</div></div>` : ''}
      ${projet.budgetHT ? `<div class="mag-info-item"><span class="mag-info-label">Budget travaux</span><div class="mag-info-value">${esc(projet.budgetHT)}</div></div>` : ''}
      ${(projet.anneeLivraison || projet.surface) ? `<div class="mag-info-item"><span class="mag-info-label">Calendrier</span>${projet.anneeLivraison ? `<div class="mag-info-value">${esc(projet.anneeLivraison)}</div>` : ''}${projet.surface ? `<div class="mag-info-value-sub">${projet.surface.toLocaleString('fr-FR')} m²</div>` : ''}</div>` : ''}
      ${secItems.length ? `
      <div class="mag-info-sec">
        ${secItems.map(([l, v]) => `<div class="mag-info-item"><span class="mag-info-label">${esc(l)}</span><div class="mag-info-value">${esc(v)}</div></div>`).join('')}
      </div>` : ''}
      ${projet.chiffresCles?.length ? `
      <div class="mag-chiffres">
        ${projet.chiffresCles.map(c => `<div class="mag-gros-chiffre"><div class="mag-nombre">${esc(c.valeur)}</div><div class="mag-legende">${esc(c.label)}</div></div>`).join('')}
      </div>` : ''}
    </aside>

    <main class="mag-principal">
      <h2 class="mag-principal-h2">${esc(projet.nom)}</h2>
      <div class="mag-article-text">
        ${paragraphs.map((p, i) => `<p class="mag-article-p${i === 0 ? ' mag-intro' : ''}">${esc(p)}</p>`).join('')}
      </div>
      ${hasGallery ? `
      <div class="mag-galerie">
        ${galleryPhotos.map(ph => `<div class="mag-galerie-photo" style="background-image:url('${ph.url}')"></div>`).join('')}
      </div>` : ''}
    </main>
  </div>

  ${tagsHtml(projet, 'magazine')}

  <footer class="mag-footer">
    <span class="mag-footer-sigle">.A</span>
    <div class="mag-footer-legal"><strong>Assemblage ingénierie</strong> S.A.S · 137 rue d'Aboukir, 75002 Paris · contact@assemblage.net</div>
    <div class="mag-footer-ref">${esc(projet.affaire)}</div>
  </footer>
</article>`;
}

export function renderPdfHtml(projet: Projet): string {
  const body = projet.layout === 'Magazine' ? magazineHtml(projet) : editorialHtml(projet);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${esc(projet.nom)}</title>
  ${FONTS}
  <style>${CSS}</style>
</head>
<body>${body}</body>
</html>`;
}
