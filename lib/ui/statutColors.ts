import type { Statut } from '@/types/projet';
import { color } from '@/lib/ui/tokens';

/**
 * Palette des badges de Statut (« État avancement » Airtable), partagée par
 * les 4 pages de portfolio : home (`PortfolioGrid`), builder
 * (`PortfolioBuilder`), tableau (`TableauBuilder`) et public
 * (`PublicPortfolioTable`). Ces quatre fichiers en portaient chacun une copie
 * littérale — toute nouvelle option devait être ajoutée 4 fois, et rien ne
 * signalait un oubli.
 *
 * Le typage `Record<Statut, string>` est délibéré : ajouter une option à
 * l'union `Statut` casse la compilation ici tant que sa couleur n'est pas
 * définie. Ne pas relâcher en `Record<string, string>`.
 *
 * Les quasi-synonymes partagent leur couleur, pour qu'une fiche « Terminé » et
 * une fiche « Livré » se lisent comme le même état d'avancement (idem
 * « En cours » / « En chantier »).
 *
 * ⚠ Distinct de `FICHE_STATUS_COLOR` (`lib/pdf/projectConfig.ts`), qui colore
 * l'avancement de **rédaction de la fiche** (Pas faite / Publié / …), pas
 * l'avancement du **projet**.
 */
export const STATUT_BG: Record<Statut, string> = {
  'En étude': color.gris,
  'Concours': '#F0E8F5',
  'En chantier': color.rougeClair,
  'En cours': color.rougeClair,
  'Livré': '#d4edda',
  'Terminé': '#d4edda',
  'Abandonné': '#e2e3e5',
  'En pause': '#fff3cd',
  'En consultation': '#d1ecf1',
};

export const STATUT_COLOR: Record<Statut, string> = {
  'En étude': color.violet,
  'Concours': '#6B4F94',
  'En chantier': color.rouge,
  'En cours': color.rouge,
  'Livré': '#155724',
  'Terminé': '#155724',
  'Abandonné': '#6c757d',
  'En pause': '#856404',
  'En consultation': '#0c5460',
};
