import type { TemplateChoice } from '@/types/projet';

/**
 * Mapping legacy template → ancien layout 'Editorial' | 'Magazine'
 * utilisé pour le rendu on-screen et la publication WordPress en attendant
 * que ces deux flux soient migrés vers le système de templates.
 */
export type LegacyLayout = 'Editorial' | 'Magazine';

export function templateToLegacyLayout(template: TemplateChoice): LegacyLayout {
  switch (template) {
    case 'Mosaïque':
    case 'Galerie':
      return 'Magazine';
    case 'Solo':
    case 'Diptyque':
    case 'Triptyque':
    default:
      return 'Editorial';
  }
}
