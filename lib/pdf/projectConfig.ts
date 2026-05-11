import type { BandeauConfig } from './bandeauConfig';
import type { ManualConfig } from './manualConfig';

/**
 * Configuration unifiée d'une fiche projet, stockée en JSON dans le champ
 * Airtable « Config template manuel » (Long text — nom historique conservé).
 *
 * - `bandeau` : mise en forme du bandeau d'en-tête + grille métadonnées.
 *   Valable pour les 4 templates PDF (générale).
 * - `manuel`  : configuration du template `Manuel` (format photo, sliders,
 *   photos additionnelles). Présente uniquement si le projet utilise ce
 *   template.
 *
 * Schéma volontairement plat (1 niveau d'imbrication) pour rester
 * compatible avec un éventuel élargissement futur (config Triptyque, etc.).
 *
 * **Compat ascendante** : si le champ Airtable contient encore un
 * ManualConfig "à plat" (legacy), le deserializer l'enveloppe automatiquement
 * dans `{ manuel: … }` à la lecture.
 */
export interface ProjectConfig {
  bandeau?: BandeauConfig;
  manuel?: ManualConfig;
}

export const PROJECT_CONFIG_FIELD = 'Config template manuel';

export function serializeProjectConfig(c: ProjectConfig): string {
  return JSON.stringify(c);
}

export function deserializeProjectConfig(raw: unknown): ProjectConfig | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Détection format legacy : un ManualConfig "à plat" a des clés
    // racine comme mainPhotoFormat / mainPhoto / textColumns.
    if (
      'mainPhotoFormat' in parsed ||
      'mainPhoto' in parsed ||
      'textColumns' in parsed
    ) {
      return { manuel: parsed as ManualConfig };
    }
    return parsed as ProjectConfig;
  } catch {
    return null;
  }
}
