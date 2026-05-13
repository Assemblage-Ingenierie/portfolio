import type { TemplateBundle } from './shared';

const CSS = `
.cover-page {
  padding: 40mm 30mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  text-align: center;
}
.cover-top {
  font-family: var(--sans);
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ai-noir70);
}
.cover-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8mm;
}
.cover-sigle {
  width: 60mm;
  height: auto;
  display: block;
}
.cover-title {
  font-family: var(--sans);
  font-size: 24pt;
  font-weight: 500;
  color: var(--ai-noir);
  letter-spacing: -0.01em;
  line-height: 1.1;
  max-width: 140mm;
}
.cover-subtitle {
  font-family: var(--sans);
  font-size: 11pt;
  font-weight: 600;
  color: var(--ai-noir70);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.cover-rule {
  width: 30mm;
  height: 1px;
  background: var(--ai-rouge);
  margin: 6mm auto;
}
.cover-bottom {
  font-family: var(--sans);
  font-size: 9pt;
  color: var(--ai-noir70);
}
.cover-bottom strong { color: var(--ai-noir); font-weight: 700; }
`;

export interface CoverParams {
  title?: string;
  date?: Date;
  count?: number;
}

export function renderCover(params: CoverParams = {}): TemplateBundle {
  const date = params.date ?? new Date();
  const dateStr = date.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const title = params.title ?? 'Portfolio';
  const countLine = params.count
    ? `${params.count} référence${params.count > 1 ? 's' : ''}`
    : '';

  const body = `<article class="page cover-page">
    <div class="cover-top">Assemblage ingénierie · Bureau d'études techniques</div>

    <div class="cover-center">
      <img class="cover-sigle" src="https://hhkofvbptnrtwbazftlm.supabase.co/storage/v1/object/public/Branding/logo/sigle_Ai_rouge.svg" alt=".A" />
      <div class="cover-rule"></div>
      <h1 class="cover-title">${escape(title)}</h1>
      ${countLine ? `<div class="cover-subtitle">${countLine}</div>` : ''}
    </div>

    <div class="cover-bottom">
      <strong>${dateStr}</strong><br/>
      137 rue d'Aboukir, 75002 Paris · contact@assemblage.net · assemblage.net
    </div>
  </article>`;

  return { body, css: CSS };
}

function escape(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
