/**
 * Préréglages canoniques Assemblage pour les templates Str-Env et Dev.
 *
 * Appliqués via le bouton "Réinitialiser" du panneau de mise en page —
 * remettent simultanément le `BandeauConfig` (typo / bandeau / cellules)
 * et le `ManualConfig` (photo principale / texte / mots-clés / certifs)
 * dans l'état recommandé par la charte.
 *
 * Convention : on définit ici la cible souhaitée par l'utilisateur. Le
 * code consommateur (LayoutSidebar) doit appliquer ces presets aux deux
 * config setters (`onBandeauChange` et `onChange` pour le ManualConfig).
 *
 * Les défauts sont identiques pour Str-Env et Dev : la même typographie,
 * la même distribution de cellules. La cellule "Prestation Assemblage"
 * est exclusive à Dev mais sa configuration `style` (taille 9) est
 * inoffensive en Str-Env (pas de rendu de bloc associé).
 */

import type { BandeauConfig } from './bandeauConfig';
import type { ManualConfig } from './manualConfig';

/** Police par défaut sur toutes les sections : Open Sans (alias 'sans'). */
const FONT_SANS = 'sans' as const;

/**
 * Préréglages du BandeauConfig (typo + cellules + lignes + espacements).
 *
 * Tailles (pt) — issues du brief utilisateur (révisé 2026) :
 *   Titre 15 · Statut 10 · Libellés 10 · Valeurs 10
 *   Sous-titre Programme (metaSub) 9 · Description 9 · Prestation Assemblage 9
 *   Mission AI : 12, gras, small-caps (Open Sans)
 *
 * Cellules : distribution adaptée au contenu (`layout: 'content'`).
 *
 * Cellule Programme : Programme secondaire visible → on n'ajoute PAS de clé
 * `programme` (l'absence de `hideSecondaire: true` = secondaire affiché).
 *
 * Lignes horizontales : masquées (`lines.show = false`).
 *
 * Espacements (0..100, 50 = neutre) :
 *   titleMetaGap    = 30 (titre ↔ bandeau)
 *   photoTextGap    = 45 (photo ↔ description)
 *   bandeauPhotoGap = 30 (photo ↔ bandeau)
 */
export const ASSEMBLAGE_DEFAULT_BANDEAU: BandeauConfig = {
  titre:                { fontFamily: FONT_SANS, fontSize: 15 },
  status:               { fontFamily: FONT_SANS, fontSize: 10 },
  missionAi:            { fontFamily: FONT_SANS, fontSize: 12, bold: true, smallCaps: true },
  labels:               { fontFamily: FONT_SANS, fontSize: 10 },
  values:               { fontFamily: FONT_SANS, fontSize: 10 },
  metaSub:              { fontFamily: FONT_SANS, fontSize: 9 },
  description:          { fontFamily: FONT_SANS, fontSize: 9 },
  prestationAssemblage: { fontFamily: FONT_SANS, fontSize: 9 },
  cells: { layout: 'content' },
  lines: { show: false },
  titleMetaGap: 30,
  photoTextGap: 45,
  bandeauPhotoGap: 30,
};

/**
 * Préréglages du ManualConfig (template Str-Env et Dev).
 *
 *   Photo principale : format paysage, taille = 50% (sizePercent)
 *   Texte description : 2 colonnes, 50% / 50%
 *   Photos additionnelles : aucune (extraPhotos: [])
 *   Mots-clés : liste verticale activée (show: true, inline: false)
 *   Certifications : activées (show: true, inline: false)
 *
 * Note : `mainPhoto.index = 0` réinitialise sur la 1ʳᵉ photo du projet.
 * Si l'utilisateur avait sélectionné une autre photo en photo principale,
 * la réinitialisation l'écrase. C'est conforme à la demande "appliquer
 * les paramètres par défaut".
 */
export const ASSEMBLAGE_DEFAULT_MANUAL: ManualConfig = {
  mainPhotoFormat: 'paysage',
  mainPhoto: { index: 0, sizePercent: 50 },
  textColumns: 2,
  textCol1Percent: 50,
  textCol2Percent: 50,
  extraPhotos: [],
  keywords:       { show: true, inline: false },
  certifications: { show: true, inline: false },
};
