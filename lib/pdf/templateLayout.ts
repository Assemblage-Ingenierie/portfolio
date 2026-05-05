import type { TemplateChoice } from '@/types/projet';

/**
 * Mapping legacy template → ancien layout WordPress.
 * Depuis la suppression de Mosaïque/Galerie, tous les templates restants
 * (Solo, Diptyque, Triptyque, Manuel) routent vers la version Editorial.
 */
export type LegacyLayout = 'Editorial' | 'Magazine';

export function templateToLegacyLayout(_template: TemplateChoice): LegacyLayout {
  return 'Editorial';
}
