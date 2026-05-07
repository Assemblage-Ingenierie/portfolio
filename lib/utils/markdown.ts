import { Marked } from 'marked';

// Parse markdown synchronously (Airtable rich text = GFM Markdown).
// On désactive `mangle` et `headerIds` qui ne servent pas pour notre usage
// (rendu inline simple) et qui produisent des warnings v18+.
const marked = new Marked({
  gfm: true,
  breaks: true,
});

/** Markdown → HTML, à utiliser dans les templates PDF / WP / vues web. */
export function renderMarkdown(md: string | undefined | null): string {
  if (!md) return '';
  return marked.parse(md, { async: false }) as string;
}

/**
 * Échappe une chaîne markdown pour réutilisation hors d'un contexte de
 * parsing (ex. champ titre). Ne fait rien d'autre que désactiver les
 * caractères de formatting markdown courants.
 */
export function escapeMarkdown(s: string): string {
  return s.replace(/([\\`*_{}\[\]()#+\-.!>])/g, '\\$1');
}
