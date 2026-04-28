import { base, TABLE } from './client';

export interface ProjetEditableFields {
  nom?: string;
  adresse?: string;
  pitch?: string;
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
  layout?: string;
  certifications?: string[];
  motsCles?: string[];
}

export async function updateProjetFields(slug: string, fields: ProjetEditableFields): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) throw new Error(`Slug invalide: ${slug}`);
  const records = await base(TABLE)
    .select({ filterByFormula: `{Slug} = "${slug}"`, maxRecords: 1 })
    .all();

  if (records.length === 0) throw new Error(`Projet introuvable: ${slug}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  if (fields.nom !== undefined)            update['Nom du projet']      = fields.nom;
  if (fields.adresse !== undefined)        update['Adresse']            = fields.adresse;
  if (fields.pitch !== undefined)          update['Pitch']              = fields.pitch;
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
  if (fields.rehabNeuf !== undefined)      update['Rehab / Neuf']       = fields.rehabNeuf;
  if (fields.statut !== undefined)         update['État avancement']    = fields.statut;
  if (fields.layout !== undefined)         update['Sélectionner']       = fields.layout;
  if (fields.certifications !== undefined) update['Certification']      = fields.certifications.join('\n');
  if (fields.motsCles !== undefined)       update['Mots-clés']          = fields.motsCles.join(', ');

  await base(TABLE).update(records[0].id, update);
}

export async function updateProjetUrl(slug: string, url: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return;
  const records = await base(TABLE)
    .select({ filterByFormula: `{Slug} = "${slug}"`, maxRecords: 1 })
    .all();

  if (records.length === 0) return;
  await base(TABLE).update(records[0].id, { URL: url });
}
