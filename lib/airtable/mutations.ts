import { base, TABLE } from './client';
import type { ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';
import type { CropData } from '@/lib/pdf/photoCrop';
import {
  PROJECT_CONFIG_FIELD,
  deserializeProjectConfig,
  serializeProjectConfig,
  type ProjectConfig,
  type FicheStatus,
} from '@/lib/pdf/projectConfig';

export interface ProjetEditableFields {
  nom?: string;
  adresse?: string;
  description?: string;
  moa?: string;
  mandataire?: string;
  betAssocies?: string;
  entreprise?: string;
  bailleur?: string;
  referentAi?: string;
  missionAi?: string;
  surface?: number;
  budgetRaw?: number;
  anneeLivraison?: number;
  programme?: string;
  pole?: string;
  departement?: string;
  rehabNeuf?: string;
  statut?: string;
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
  if (fields.moa !== undefined)            update["Maître d'ouvrage"]   = fields.moa;
  if (fields.mandataire !== undefined)     update['Mandataire']         = fields.mandataire;
  if (fields.betAssocies !== undefined)    update['BET associés']       = fields.betAssocies;
  if (fields.entreprise !== undefined)     update['Entreprise']         = fields.entreprise;
  if (fields.bailleur !== undefined)       update['Bailleur']           = fields.bailleur;
  if (fields.referentAi !== undefined)     update['Référent AI']        = fields.referentAi;
  if (fields.missionAi !== undefined)      update['Mission AI']         = fields.missionAi;
  if (fields.surface !== undefined)        update['Surface(m²)']        = fields.surface;
  if (fields.budgetRaw !== undefined)      update['Budget HT']          = fields.budgetRaw;
  if (fields.anneeLivraison !== undefined) update['Année livraison']    = fields.anneeLivraison;
  if (fields.programme !== undefined)      update['Programme']          = fields.programme;
  if (fields.pole !== undefined)           update['Pôle']               = fields.pole;
  if (fields.departement !== undefined)    update['Département']        = fields.departement;
  if (fields.rehabNeuf !== undefined)      update['Rehab / Neuf']       = fields.rehabNeuf ? [fields.rehabNeuf] : [];
  if (fields.statut !== undefined)         update['État avancement']    = fields.statut;
  if (fields.template !== undefined)       update['Template']           = fields.template;
  if (fields.certifications !== undefined) update['Certification']      = fields.certifications.join('\n');
  if (fields.motsCles !== undefined)       update['Mots-clés']          = fields.motsCles.join(', ');
  if (fields.prestationAssemblage !== undefined) update['Prestation Assemblage'] = fields.prestationAssemblage;
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

export async function updateProjetUrl(slug: string, url: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return;
  const records = await base(TABLE)
    .select({ filterByFormula: `{Slug} = "${slug}"`, maxRecords: 1 })
    .all();

  if (records.length === 0) return;
  await base(TABLE).update(records[0].id, { URL: url });
}
