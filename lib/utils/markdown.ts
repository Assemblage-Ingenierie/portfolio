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

/**
 * Insère des soft hyphens (U+00AD) dans un HTML pour autoriser la césure
 * UNIQUEMENT à 2 caractères avant la fin de chaque mot ≥ 6 lettres.
 *
 * Combiné avec `hyphens: manual` côté CSS, ça donne un comportement simple :
 * la césure n'est appliquée par le navigateur que si nécessaire pour le wrap,
 * et toujours au même endroit — laissant un orphelin de 2 caractères au
 * début de la ligne suivante (ex. "exception" → "excepti-on").
 *
 * Mots ≤ 5 chars : pas de soft hyphen (ne vaut pas le coup).
 * Mots déjà cassés (espace, ponctuation, balise HTML) : ignorés.
 * Texte à l'intérieur de balises (attribut, code, etc.) : skip les < … >
 * pour ne pas polluer les balises ou les valeurs d'attributs.
 */
const SHY = '­';
export function injectSoftHyphensFr(html: string): string {
  // Stratégie : on segmente sur les balises HTML (<...>) ; le contenu entre
  // balises (text-only) est traité, le reste passe inchangé. Approximation
  // suffisante pour notre rendu Markdown (pas d'attributs contenant des
  // mots français longs en pratique).
  return html.replace(/(<[^>]+>)|([A-Za-zÀ-ÿ]{6,})/g, (match, tag, word) => {
    if (tag) return tag;
    if (!word) return match;
    return word.slice(0, -2) + SHY + word.slice(-2);
  });
}
