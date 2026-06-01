/**
 * Jetons de design (couleurs / polices / rayons / espacements) pour les
 * inline-styles des composants React de l'app.
 *
 * ── Source de vérité ──────────────────────────────────────────────────────
 * Les couleurs de MARQUE et les polices restent définies UNE seule fois dans
 * `styles/tokens.css` (variables CSS `--ai-*`). Ce module n'en redéfinit PAS
 * les valeurs hex : il expose des constantes typées qui référencent les
 * `var(--ai-*)`. Changer une couleur de charte = éditer `tokens.css`, rien
 * d'autre. L'intérêt de ce module : autocomplétion + import unique + zéro hex
 * en dur dispersé dans les composants.
 *
 * Les couleurs FONCTIONNELLES (états de sauvegarde, succès/erreur, neutres
 * d'interface) n'ont pas de variable CSS dédiée — ce module est leur source
 * de vérité unique (valeurs hex ci-dessous).
 *
 * ⚠ Ne PAS utiliser ces constantes dans les templates PDF (`lib/pdf/templates`)
 * ni les builders WordPress (`lib/wordpress`) : ces rendus sont volontairement
 * autonomes (leur propre `:root` / styles inline) pour fonctionner hors du DOM
 * de l'app (Puppeteer, post WordPress embarqué).
 */

/** Couleurs de marque — référencent les variables CSS de `styles/tokens.css`. */
export const color = {
  rouge: 'var(--ai-rouge)',
  violet: 'var(--ai-violet)',
  gris: 'var(--ai-gris)',
  rougeClair: 'var(--ai-rouge-clair)',
  grisTresClair: 'var(--ai-gris-tres-clair)',
  noir70: 'var(--ai-noir70)',
  noir: 'var(--ai-noir)',
  blanc: '#ffffff',
} as const;

/** Polices — référencent les variables CSS de `styles/tokens.css`. */
export const font = {
  serif: 'var(--serif)',
  sans: 'var(--sans)',
} as const;

/**
 * Couleurs fonctionnelles d'interface (hors charte de marque) qui n'ont PAS
 * de variable CSS dans `tokens.css`. Source de vérité unique.
 * NB : la bordure standard des inputs/cartes est `color.gris` (= --ai-gris,
 * #DFE4E8) — ne pas redéfinir ici pour éviter une 2e source de vérité.
 */
export const ui = {
  /** Fond de page neutre (zones grisées derrière les cartes). */
  fondPage: '#ECECEC',
  /** Séparateur très léger (listes internes). */
  separateur: '#F0F0F0',
  /** Texte / contrôle désactivé. */
  disabled: '#888888',
} as const;

/** États de feedback (sauvegarde, toasts, validations). */
export const feedback = {
  succes: '#2E7D32',
  succesClair: '#90EE90',
  erreur: '#E53935',
  erreurClair: '#FFAAAA',
  attente: '#F9A825',
  info: '#1976D2',
} as const;

/**
 * Rayons d'arrondi — hiérarchie unifiée de l'app :
 *  - `container` : panneaux, cartes/tuiles, conteneurs de liste
 *  - `action`    : boutons d'action principaux, champ de recherche
 *  - `pill`      : pills de filtre, badges de statut
 *  - `sharp`     : éléments denses où l'arrondi nuirait (rare)
 */
export const radius = {
  container: 12,
  action: 8,
  pill: 6,
  sharp: 2,
} as const;
