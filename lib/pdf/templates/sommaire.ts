import type { Projet } from '@/types/projet';
import { TemplateBundle, esc, footerHtml } from './shared';

const CSS = `
.toc-page {
  padding: 14mm 18mm 12mm 18mm;
  display: flex;
  flex-direction: column;
  gap: 6mm;
}
.toc-title-block {
  border-bottom: 2px solid var(--ai-rouge);
  padding-bottom: 4mm;
}
.toc-title {
  font-family: var(--sans);
  font-size: 24pt;
  font-weight: 500;
  color: var(--ai-noir);
  letter-spacing: -0.01em;
  margin-bottom: 2mm;
}
.toc-subtitle {
  font-family: var(--sans);
  font-size: 9pt;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ai-noir70);
}

.toc-list {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}
.toc-item {
  display: grid;
  grid-template-columns: 1fr 14mm;
  align-items: baseline;
  gap: 4mm;
  padding: 3mm 0;
  border-bottom: 1px dotted var(--ai-gris);
  font-family: var(--sans);
}
.toc-meta {
  display: flex;
  flex-direction: column;
  gap: 1mm;
}
/* Une seule ligne par champ : hauteur de ligne fixe, condition pour que
   TOC_ITEMS_PER_PAGE reste fiable (un nom qui wrappe décalerait la page). */
.toc-nom {
  font-family: var(--sans);
  font-size: 11.5pt;
  font-weight: 500;
  color: var(--ai-noir);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toc-sub {
  font-size: 8pt;
  color: var(--ai-noir70);
  line-height: 1.3;
  min-height: 1.3em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toc-meta { min-width: 0; }
.toc-page-num {
  font-family: var(--serif);
  font-size: 12pt;
  font-weight: 600;
  color: var(--ai-violet);
  text-align: right;
}
`;

interface TocEntry {
  affaire: string;
  nom: string;
  pole?: string;
  programme?: string;
  pageNumber: number;
}

/**
 * Nombre de lignes par page de sommaire. Une ligne ≈ 16 mm (padding 2×3 mm +
 * nom 11.5pt + sous-titre 8pt) ; la liste dispose d'≈ 243 mm sous le titre
 * → 15 lignes au maximum. On garde 14 pour absorber les écarts de métrique
 * de police entre l'aperçu et Chromium (Puppeteer).
 */
export const TOC_ITEMS_PER_PAGE = 14;

/** Nombre de pages occupées par le sommaire pour `count` références (≥ 1). */
export function sommairePageCount(count: number): number {
  return Math.max(1, Math.ceil(count / TOC_ITEMS_PER_PAGE));
}

export function renderSommaire(projet: Pick<Projet, 'statut' | 'affaire'> | null, entries: TocEntry[]): TemplateBundle {
  // Le header/footer commun s'attend à un Projet — on construit un projet fictif
  // si nécessaire ou on utilise celui passé. Pour le sommaire, header/footer sont génériques.
  const fakeProjet = projet ?? {
    affaire: 'Sommaire',
    statut: 'Livré' as const,
  };

  const pageCount = sommairePageCount(entries.length);
  const countLabel = `${entries.length} référence${entries.length > 1 ? 's' : ''}`;

  const pages: string[] = [];
  for (let p = 0; p < pageCount; p++) {
    const chunk = entries.slice(p * TOC_ITEMS_PER_PAGE, (p + 1) * TOC_ITEMS_PER_PAGE);
    const subtitle = pageCount > 1 ? `${countLabel} · ${p + 1}/${pageCount}` : countLabel;
    pages.push(`<article class="page toc-page">
    <div class="toc-title-block">
      <h1 class="toc-title">Sommaire${p > 0 ? ' (suite)' : ''}</h1>
      <div class="toc-subtitle">${subtitle}</div>
    </div>

    <div class="toc-list">
      ${chunk.map(e => `
        <div class="toc-item">
          <div class="toc-meta">
            <div class="toc-nom">${esc(e.nom)}</div>
            <div class="toc-sub">${esc([e.pole, e.programme].filter(Boolean).join(' · '))}</div>
          </div>
          <div class="toc-page-num">${e.pageNumber}</div>
        </div>
      `).join('')}
    </div>

    ${footerHtml(fakeProjet as never)}
  </article>`);
  }

  return { body: pages.join('\n'), css: CSS };
}
