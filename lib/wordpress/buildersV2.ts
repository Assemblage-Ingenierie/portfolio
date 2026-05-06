import type { Projet } from '@/types/projet';
import { esc, lightboxHtml, ROUGE, VIOLET, GRIS, NOIR70, SERIF, SANS } from './builders';

/**
 * Variante V2 — layout magazine inspiré de la mise en page « Brunoy ».
 * - Titre rendu par le thème WP (post.title)
 * - Photo principale pleine largeur (cliquable pour lightbox)
 * - Description en 2 colonnes
 * - Photos additionnelles en 2 colonnes sous le texte
 * - Champs clés en grille compacte sous les photos
 */
function buildWpEditorialV2(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  const pitch = esc(projet.pitch ?? '');
  const description = projet.description ?? '';
  const paragraphs = description.split(/\n\n+/).filter(Boolean);
  const chiffresCles = projet.chiffresCles ?? [];
  const allPhotos = [coverUrl, ...photoUrls].filter((u): u is string => !!u);

  const etat = projet.statut && projet.anneeLivraison
    ? `${projet.statut} en ${projet.anneeLivraison}`
    : projet.statut || (projet.anneeLivraison ? String(projet.anneeLivraison) : undefined);

  const champsCles: { label: string; value?: string; highlight?: boolean }[] = [
    { label: 'Lieu',              value: projet.lieu },
    { label: "Maître d'ouvrage",  value: projet.moa },
    { label: 'Architecte',        value: projet.architecte },
    { label: 'Mission AI',        value: projet.missionAi, highlight: true },
    { label: 'Mandataire',        value: projet.mandataire },
    { label: 'BET associés',      value: projet.betAssocies },
    { label: 'Entreprise',        value: projet.entreprise },
    { label: 'Bailleur',          value: projet.bailleur },
    { label: 'Surface',           value: projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined },
    { label: 'Budget',            value: projet.budgetHT },
    { label: 'État',              value: etat },
  ].filter(f => !!f.value);

  // Photos restantes (sans la couverture). On reprend les data-ai-idx
  // depuis 1 pour être compatible avec lightboxHtml (idx 0 = cover).
  const galeriePhotos = photoUrls.map((u, i) => ({ url: u, idx: i + 1 }));

  // Description en 2 colonnes via CSS columns. Les photos additionnelles
  // sont insérées dans le même conteneur de colonnes pour s'écouler
  // naturellement après le texte (style magazine).
  const colonnesContent = `
    ${paragraphs.map(p => `<p style="font-family:${SANS};font-size:15px;line-height:1.7;color:#1a1a1a;margin:0 0 16px;break-inside:avoid;">${esc(p)}</p>`).join('')}
    ${galeriePhotos.map(({ url, idx }) => `
      <figure data-ai-idx="${idx}" style="margin:16px 0;break-inside:avoid;cursor:pointer;background:${GRIS};">
        <img src="${esc(url)}" alt="${esc(projet.nom)} — photo ${idx}" loading="lazy" style="width:100%;height:auto;display:block;pointer-events:none;" />
      </figure>`).join('')}
  `;

  return `
<article style="font-family:${SANS};color:#000;line-height:1.6;max-width:1100px;margin:0 auto;">

  ${pitch ? `
  <header style="margin:0 0 32px;text-align:center;">
    <p style="font-family:${SERIF};font-size:22px;font-style:italic;line-height:1.4;color:${VIOLET};margin:0 auto;max-width:780px;">${pitch}</p>
  </header>` : ''}

  <!-- Photo principale pleine largeur (cliquable, idx 0 du carrousel) -->
  ${coverUrl ? `
    <figure data-ai-idx="0" style="margin:0 0 40px;cursor:pointer;background:${GRIS};">
      <img src="${esc(coverUrl)}" alt="${esc(projet.nom)}" loading="lazy" style="width:100%;height:auto;display:block;pointer-events:none;" />
    </figure>` : ''}

  <!-- Description + photos additionnelles en flux 2 colonnes -->
  <div style="column-count:2;column-gap:40px;column-rule:1px solid ${GRIS};margin-bottom:48px;">
    ${colonnesContent}
  </div>

  ${champsCles.length > 0 ? `
  <!-- Champs clés en grille compacte -->
  <div style="border-top:2px solid ${ROUGE};padding-top:24px;margin-bottom:40px;">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px 32px;">
      ${champsCles.map(f => `
        <div style="${f.highlight ? `color:${ROUGE};` : ''}">
          <div style="font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${f.highlight ? ROUGE : NOIR70};margin-bottom:4px;">${esc(f.label)}</div>
          <div style="font-family:${SERIF};font-size:15px;font-weight:500;line-height:1.3;">${esc(f.value!)}</div>
        </div>`).join('')}
    </div>
  </div>` : ''}

  ${chiffresCles.length > 0 ? `
  <!-- Chiffres clés -->
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

  ${lightboxHtml(allPhotos, projet.nom)}

</article>`;
}

export function buildWpContentV2(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  return buildWpEditorialV2(projet, coverUrl, photoUrls);
}
