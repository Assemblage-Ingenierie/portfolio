import { marked } from 'marked';

// Configuration globale partagée serveur + client (Airtable rich text = GFM Markdown).
marked.setOptions({ gfm: true, breaks: true });

/** Markdown → HTML, à utiliser dans les templates PDF / WP / vues web. */
export function renderMarkdown(md: string | undefined | null): string {
  if (!md) return '';
  const out = marked.parse(md);
  // marked.parse renvoie string par défaut (sans extensions async) ; le cast
  // est défensif au cas où le bundler exposerait la signature large.
  return typeof out === 'string' ? out : '';
}

/**
 * Échappe une chaîne markdown pour réutilisation hors d'un contexte de
 * parsing (ex. champ titre).
 */
export function escapeMarkdown(s: string): string {
  return s.replace(/([\\`*_{}\[\]()#+\-.!>])/g, '\\$1');
}
