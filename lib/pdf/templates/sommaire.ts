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
.toc-nom {
  font-family: var(--sans);
  font-size: 11.5pt;
  font-weight: 500;
  color: var(--ai-noir);
  line-height: 1.2;
}
.toc-sub {
  font-size: 8pt;
  color: var(--ai-noir70);
}
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

export function renderSommaire(projet: Pick<Projet, 'statut' | 'affaire'> | null, entries: TocEntry[]): TemplateBundle {
  // Le header/footer commun s'attend à un Projet — on construit un projet fictif
  // si nécessaire ou on utilise celui passé. Pour le sommaire, header/footer sont génériques.
  const fakeProjet = projet ?? {
    affaire: 'Sommaire',
    statut: 'Livré' as const,
  };

  const body = `<article class="page toc-page">
    <div class="toc-title-block">
      <h1 class="toc-title">Sommaire</h1>
      <div class="toc-subtitle">${entries.length} référence${entries.length > 1 ? 's' : ''}</div>
    </div>

    <div class="toc-list">
      ${entries.map(e => `
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
  </article>`;

  return { body, css: CSS };
}
