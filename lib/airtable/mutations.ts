import { base, TABLE } from './client';
import type { ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';
import type { CropData } from '@/lib/pdf/photoCrop';
import {
  PROJECT_CONFIG_FIELD,
  deserializeProjectConfig,
  serializeProjectConfig,
  DEFAULT_FICHE_STATUS,
  type ProjectConfig,
  type FicheStatus,
} from '@/lib/pdf/projectConfig';
import {
  ASSEMBLAGE_DEFAULT_BANDEAU,
  ASSEMBLAGE_DEFAULT_MANUAL,
} from '@/lib/pdf/assemblageDefaults';
import {
  FIELD_PROGRAMME_PRINCIPAL,
  FIELD_PROGRAMME_SECONDAIRE,
  FIELD_REHAB_NEUF,
  FIELD_MATERIAUX,
  FIELD_STATUT,
  FIELD_MISSION_AI,
  FIELD_CERTIFICATION,
  FIELD_PRESTATION_ASSEMBLAGE,
  FIELD_POLE,
} from './mappers';

export interface ProjetEditableFields {
  nom?: string;
  adresse?: string;
  description?: string;
  // CRM-linked records (MOA / Architecte / Mandataire / Entreprise /
  // BET associés / Bailleur) : NON éditables depuis le portfolio.
  // Toute écriture corromprait la relation linked record côté Airtable —
  // les valeurs doivent être modifiées directement dans la base CRM.
  referentAi?: string;
  /** Multi-select "Mission AI" (fldgkpweXw9BypQfX) — array de valeurs. */
  missionAiValues?: string[];
  /** Multi-select "Programme principal" (fldKNKtsZNpvmf695). */
  programmesPrincipaux?: string[];
  /** Multi-select "Programme secondaire" (fldaTqKMNrIpeGBma). */
  programmesSecondaires?: string[];
  surface?: number;
  budgetRaw?: number;
  anneeLivraison?: number;
  pole?: string;
  departement?: string;
  /** Multi-select "Rehab / Neuf" (fldyD7L9E7cGL26vH). */
  rehabNeufValues?: string[];
  /** Multi-select "État avancement / Statut" (fldxXNdE0uNaomeby). */
  statutValues?: string[];
  /** Multi-select "Matériaux" (fldC4SW9n1H2PZ3MH). */
  materiaux?: string[];
  template?: string;
  certifications?: string[];
  motsCles?: string[];
  /** Champ rich text long "Prestation Assemblage" (field id flddrMLBDxOc8r4lJ). */
  prestationAssemblage?: string;
  savedManualConfig?: ManualConfig;
  bandeauConfig?: BandeauConfig;
  photoCrops?: Record<string, CropData>;
  /** Statut interne de production. Mergé dans `ProjectConfig.ficheStatus`. */
  ficheStatus?: FicheStatus;
}

export async function updateProjetFields(slug: string, fields: ProjetEditableFields): Promise<{ slug: string }> {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) throw new Error(`Slug invalide: ${slug}`);
  const records = await base(TABLE)
    .select({ filterByFormula: `{Slug} = "${slug}"`, maxRecords: 1 })
    .all();

  if (records.length === 0) throw new Error(`Projet introuvable: ${slug}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  if (fields.nom !== undefined)            update['Nom du projet']      = fields.nom;
  if (fields.adresse !== undefined)        update['Adresse']            = fields.adresse;
  if (fields.description !== undefined)    update['Description projet'] = fields.description;
  // Pas d'écriture sur les champs CRM (MOA / Mandataire / BET associés /
  // Entreprise / Bailleur / Architecte) : ils sont gérés depuis la base CRM.
  if (fields.referentAi !== undefined)     update['Référent AI']        = fields.referentAi;
  // Multi-selects : on écrit des arrays. Airtable typecast:true convertit
  // gracieusement les nouvelles valeurs en options (création automatique).
  // Multi-selects et champs renommables : écrits par FIELD ID (les noms de
  // colonnes Airtable ne sont pas garantis stables — cf. FIELD_PROGRAMME_*).
  if (fields.missionAiValues !== undefined)       update[FIELD_MISSION_AI]          = fields.missionAiValues;
  if (fields.programmesPrincipaux !== undefined)  update[FIELD_PROGRAMME_PRINCIPAL] = fields.programmesPrincipaux;
  if (fields.programmesSecondaires !== undefined) update[FIELD_PROGRAMME_SECONDAIRE] = fields.programmesSecondaires;
  if (fields.surface !== undefined)        update['Surface(m²)']        = fields.surface;
  if (fields.budgetRaw !== undefined)      update['Budget HT']          = fields.budgetRaw;
  if (fields.anneeLivraison !== undefined) update['Année livraison']    = fields.anneeLivraison;
  // Le champ "Programme" texte libre est deprecated depuis 2026 : remplace
  // par "Programmes principaux" + "Programmes secondaires" (multi-selects).
  if (fields.pole !== undefined)           update[FIELD_POLE]           = fields.pole;
  if (fields.departement !== undefined)    update['Département']        = fields.departement;
  if (fields.rehabNeufValues !== undefined) update[FIELD_REHAB_NEUF]    = fields.rehabNeufValues;
  // `fldxXNdE0uNaomeby` (FIELD_STATUT) est en réalité un **single-select**
  // ("État avancement") côté Airtable, malgré son usage multi-valeur côté
  // lecture (cf. `allValues()` dans queries.ts qui accepte string OU array).
  // On envoie donc la première valeur comme string ; envoyer un array
  // déclenche `INVALID_VALUE_FOR_COLUMN: Cannot parse value`.
  if (fields.statutValues !== undefined)    update[FIELD_STATUT]        = fields.statutValues[0] ?? null;
  if (fields.materiaux !== undefined)       update[FIELD_MATERIAUX]     = fields.materiaux;
  if (fields.template !== undefined)       update['Template']           = fields.template;
  if (fields.certifications !== undefined) update[FIELD_CERTIFICATION]  = fields.certifications.join('\n');
  if (fields.motsCles !== undefined)       update['Mots-clés']          = fields.motsCles.join(', ');
  if (fields.prestationAssemblage !== undefined) update[FIELD_PRESTATION_ASSEMBLAGE] = fields.prestationAssemblage;
  // Config unifiée (bandeau + manuel) dans le même champ Airtable. On lit
  // l'existant pour merger correctement quand l'API ne reçoit qu'une des
  // deux sous-configs (ex. update bandeau seul ne doit pas effacer manuel).
  if (
    fields.savedManualConfig !== undefined ||
    fields.bandeauConfig !== undefined ||
    fields.photoCrops !== undefined ||
    fields.ficheStatus !== undefined
  ) {
    const existing = deserializeProjectConfig(records[0].fields[PROJECT_CONFIG_FIELD]) ?? {};
    const merged: ProjectConfig = {
      ...existing,
      ...(fields.bandeauConfig !== undefined ? { bandeau: fields.bandeauConfig } : {}),
      ...(fields.savedManualConfig !== undefined ? { manuel: fields.savedManualConfig } : {}),
      ...(fields.photoCrops !== undefined ? { photoCrops: fields.photoCrops } : {}),
      ...(fields.ficheStatus !== undefined ? { ficheStatus: fields.ficheStatus } : {}),
    };
    update[PROJECT_CONFIG_FIELD] = serializeProjectConfig(merged);
  }

  await base(TABLE).update(records[0].id, update, { typecast: true });

  // Re-fetch to get the (possibly recomputed) slug — the Slug field is a formula
  // derived from "Nom du projet", so renaming the project changes its slug.
  const updated = await base(TABLE).find(records[0].id);
  const newSlug = String(updated.fields['Slug'] ?? slug);
  return { slug: newSlug };
}

/**
 * Applique les préréglages Assemblage (`ASSEMBLAGE_DEFAULT_BANDEAU` +
 * `ASSEMBLAGE_DEFAULT_MANUAL`) à TOUTES les fiches dont le statut interne
 * (`ProjectConfig.ficheStatus`) vaut « Pas faite » (ou est absent → défaut
 * 'Pas faite'). Écrit le JSON unifié dans le champ Airtable « Config template
 * manuel » de chaque fiche concernée.
 *
 * Sémantique d'écrasement : les sous-configs `bandeau` et `manuel` sont
 * remplacées par les défauts dans TOUS les cas (même si la fiche avait déjà
 * une config). Les autres clés du `ProjectConfig` (photoCrops, portfolio,
 * ficheStatus) sont préservées.
 *
 * Renvoie la liste des slugs mis à jour (pour invalidation de cache côté API).
 */
export async function applyAssemblageDefaultsToUnfinished(): Promise<{ slugs: string[] }> {
  const records = await base(TABLE).select().all();

  const updates: { id: string; fields: Record<string, string> }[] = [];
  const slugs: string[] = [];

  for (const rec of records) {
    const existing = deserializeProjectConfig(rec.fields[PROJECT_CONFIG_FIELD]) ?? {};
    const status = existing.ficheStatus ?? DEFAULT_FICHE_STATUS;
    if (status !== 'Pas faite') continue;

    const merged: ProjectConfig = {
      ...existing,
      bandeau: ASSEMBLAGE_DEFAULT_BANDEAU,
      manuel: ASSEMBLAGE_DEFAULT_MANUAL,
    };
    updates.push({ id: rec.id, fields: { [PROJECT_CONFIG_FIELD]: serializeProjectConfig(merged) } });
    const slug = rec.fields['Slug'];
    if (typeof slug === 'string' && slug) slugs.push(slug);
  }

  // Airtable limite chaque appel update() à 10 records.
  for (let i = 0; i < updates.length; i += 10) {
    await base(TABLE).update(updates.slice(i, i + 10), { typecast: true });
  }

  return { slugs };
}

export async function updateProjetUrl(slug: string, url: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return;
  const records = await base(TABLE)
    .select({ filterByFormula: `{Slug} = "${slug}"`, maxRecords: 1 })
    .all();

  if (records.length === 0) return;
  await base(TABLE).update(records[0].id, { URL: url });
}
