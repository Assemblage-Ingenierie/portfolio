import type { Projet } from '@/types/projet';

function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ROUGE  = '#E30513';
const VIOLET = '#30323E';
const GRIS   = '#DFE4E8';
const NOIR70 = '#4D4D4D';
const SERIF  = 'Georgia, serif';
const SANS   = "'Open Sans', system-ui, sans-serif";

function infoItem(label: string, value?: string | number, sub?: string): string {
  if (!value && value !== 0) return '';
  return `
    <div style="margin-bottom:10px;">
      <span style="display:block;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${NOIR70};margin-bottom:2px;">${label}</span>
      <div style="font-family:${SERIF};font-size:13px;font-weight:600;line-height:1.2;color:#000;">${esc(value)}</div>
      ${sub ? `<div style="font-family:${SANS};font-size:10px;color:${NOIR70};margin-top:2px;">${esc(sub)}</div>` : ''}
    </div>`;
}

function buildWpMagazine(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  const pitch = esc(projet.pitch ?? '');
  const description = projet.description ?? '';
  const paragraphs = description.split(/\n\n+/).filter(Boolean);
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
      ${projet.adresse ? `<div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">${esc(projet.adresse)}</div>` : ''}
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
      <div style="columns:2;column-gap:16px;column-rule:1px solid ${GRIS};">
        ${paragraphs.map((p, i) => `<p style="font-family:${SANS};font-size:11px;line-height:1.5;color:#000;margin-bottom:8px;${i === 0 ? 'break-inside:avoid;' : ''}">${esc(p)}</p>`).join('')}
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

function imageHero(url: string, alt: string): string {
  // Hero pleine largeur, ratio 16:9 préservé.
  return `
    <figure style="margin:0 0 40px;aspect-ratio:16/9;overflow:hidden;background:${GRIS};">
      <img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" />
    </figure>`;
}

function imageGallery(urls: string[], alt: string): string {
  // Galerie pleine largeur, nombre de colonnes adaptatif (1, 2 ou 3).
  // <img> (lazy + alt) plutôt que background-image — meilleur SEO + responsive WP.
  if (urls.length === 0) return '';
  const cols = urls.length === 1 ? 1 : urls.length === 2 ? 2 : 3;
  return `
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;margin:40px 0;">
      ${urls.map((u, i) => `
        <figure style="margin:0;aspect-ratio:4/3;overflow:hidden;background:${GRIS};">
          <img src="${esc(u)}" alt="${esc(alt)} — photo ${i + 1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" />
        </figure>`).join('')}
    </div>`;
}

function webInfoItem(label: string, value?: string | number, sub?: string): string {
  if (!value && value !== 0) return '';
  return `
    <div>
      <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${NOIR70};margin-bottom:6px;">${label}</div>
      <div style="font-family:${SERIF};font-size:18px;font-weight:600;line-height:1.3;color:#000;">${esc(value)}</div>
      ${sub ? `<div style="font-family:${SANS};font-size:14px;color:${NOIR70};margin-top:4px;">${esc(sub)}</div>` : ''}
    </div>`;
}

function buildWpEditorial(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  const pitch = esc(projet.pitch ?? '');
  const description = projet.description ?? '';
  const paragraphs = description.split(/\n\n+/).filter(Boolean);
  const chiffresCles = projet.chiffresCles ?? [];

  const hasSecondaire = !!(
    projet.pole || projet.departement || projet.programme || projet.rehabNeuf ||
    projet.mandataire || projet.betAssocies || projet.entreprise || projet.bailleur
  );

  return `
<article style="font-family:${SANS};color:#000;line-height:1.6;">

  <!-- Titre -->
  <header style="margin:0 0 32px;">
    ${projet.adresse ? `<div style="font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${ROUGE};margin-bottom:14px;">${esc(projet.adresse)}</div>` : ''}
    <h1 style="font-family:${SERIF};font-size:52px;font-weight:400;line-height:1.05;letter-spacing:-0.02em;color:#000;margin:0 0 20px;">${esc(projet.nom)}</h1>
    ${pitch ? `<p style="font-family:${SERIF};font-size:22px;font-style:italic;line-height:1.4;color:${VIOLET};margin:0;max-width:780px;">${pitch}</p>` : ''}
  </header>

  ${coverUrl ? imageHero(coverUrl, projet.nom) : ''}

  <!-- Infos principales -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px;padding:32px 0;border-top:1px solid ${GRIS};border-bottom:1px solid ${GRIS};margin-bottom:48px;">
    ${webInfoItem("Maître d'ouvrage", projet.moa)}
    ${webInfoItem('Architecte', projet.architecte)}
    ${webInfoItem('Budget · Surface', projet.budgetHT, projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined)}
    ${webInfoItem('Calendrier', projet.anneeLivraison, projet.missionAi ?? undefined)}
  </div>

  <!-- Description : colonne lisible (max 720px) -->
  <div style="max-width:720px;margin:0 auto 48px;">
    ${paragraphs.map((p, i) => `<p style="font-family:${SANS};font-size:17px;line-height:1.7;color:#1a1a1a;margin:0 0 20px;${i === 0 ? `font-size:19px;font-weight:500;color:#000;` : ''}">${esc(p)}</p>`).join('')}
  </div>

  ${chiffresCles.length > 0 ? `
    <div style="border-top:2px solid ${ROUGE};padding-top:24px;margin-bottom:48px;">
      <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${ROUGE};margin-bottom:20px;">Chiffres clés</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:24px;">
        ${chiffresCles.map(c => `
          <div>
            <div style="font-family:${SERIF};font-size:36px;font-weight:600;line-height:1;color:${VIOLET};letter-spacing:-0.02em;">${esc(c.valeur)}</div>
            <div style="font-family:${SANS};font-size:12px;font-weight:600;color:${NOIR70};letter-spacing:0.05em;text-transform:uppercase;margin-top:8px;">${esc(c.label)}</div>
          </div>`).join('')}
      </div>
    </div>` : ''}

  <!-- Galerie photos pleine largeur -->
  ${imageGallery(photoUrls, projet.nom)}

  ${hasSecondaire ? `
  <!-- Infos secondaires -->
  <aside style="margin-top:48px;padding:32px 0;border-top:1px solid ${GRIS};">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:24px;">
      ${[
        { label: 'Pôle', value: projet.pole },
        { label: 'Département', value: projet.departement },
        { label: 'Programme', value: projet.programme },
        { label: 'Rehab / Neuf', value: projet.rehabNeuf },
        { label: 'Mandataire', value: projet.mandataire },
        { label: 'BET associés', value: projet.betAssocies },
        { label: 'Entreprise', value: projet.entreprise },
        { label: 'Bailleur', value: projet.bailleur },
      ].filter(f => !!f.value).map(f => webInfoItem(f.label, f.value)).join('')}
    </div>
  </aside>` : ''}

</article>`;
}

export function buildWpContent(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  // Tous les templates restants (Solo, Diptyque, Triptyque, Manuel) routent
  // vers le builder Editorial pour la publication WordPress. buildWpMagazine
  // est conservé en parallèle pour archivage mais n'est plus appelé.
  return buildWpEditorial(projet, coverUrl, photoUrls);
}
