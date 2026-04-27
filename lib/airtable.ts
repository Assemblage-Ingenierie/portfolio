import Airtable from 'airtable';
import type { Projet, LayoutChoice } from '@/types/projet';
import { normalizeStatut } from './normalize';
import { parseChiffresCles, parseTagsSiteWeb, formatBudget } from './parsers';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID!
);

const TABLE = process.env.AIRTABLE_TABLE_NAME!;

// Formula fields return {state, value} — extract the string value if available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formulaValue(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw || undefined;
  if (typeof raw === 'object' && raw.state === 'generated' && raw.value) {
    return String(raw.value);
  }
  return undefined;
}

// Linked record fields can return arrays of strings or record IDs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function linkedValue(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw || undefined;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((x) => typeof x === 'string').join(', ') || undefined;
  }
  return undefined;
}

// Single-select or multi-select stored as array — take first value
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selectValue(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw || undefined;
  if (Array.isArray(raw)) return raw[0] ?? undefined;
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recordToProjet(record: any): Projet {
  const f = record.fields;

  const photoCouverture = f['Photo Couverture']?.[0]
    ? { url: f['Photo Couverture'][0].url, filename: f['Photo Couverture'][0].filename ?? 'cover.jpg' }
    : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photosProjet = (f['Photos projet'] ?? []).map((a: any) => ({
    url: a.url,
    filename: a.filename ?? 'photo.jpg',
  }));

  const rawCertification = f['Certification'] ?? '';
  const certifications = typeof rawCertification === 'string' && rawCertification
    ? rawCertification.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean)
    : [];

  const rawMotsCles = f['Mots-clés'] ?? '';
  const motsCles = typeof rawMotsCles === 'string' && rawMotsCles
    ? rawMotsCles.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
    : [];

  const tagsSiteWeb = parseTagsSiteWeb(f['Tags site web']);

  const rawBudget = f['Budget HT'];
  const budgetHT = rawBudget !== undefined && rawBudget !== null
    ? formatBudget(rawBudget)
    : undefined;
  const budgetRaw = rawBudget !== undefined && rawBudget !== null
    ? Number(rawBudget)
    : undefined;

  // Layout: stored in field "Sélectionner"
  const rawLayout = f['Sélectionner'];
  const layout: LayoutChoice =
    rawLayout === 'Magazine' ? 'Magazine' : 'Éditorial';

  return {
    affaire: f['Affaire'] ?? '',
    slug: f['Slug'] ?? '',
    nom: f['Nom du projet'] ?? '',
    adresse: f['Adresse'] ?? undefined,
    pitch: formulaValue(f['Pitch']),
    description: f['Description projet'] ?? '',

    moa: f['Maître d\'ouvrage'] ?? undefined,
    architecte: linkedValue(f['Architecte']),
    mandataire: f['Mandataire'] ?? undefined,
    betAssocies: f['BET associés'] ?? undefined,
    entreprise: f['Entreprise'] ?? undefined,
    bailleur: f['Bailleur'] ?? undefined,
    referentAi: f['Référent AI'] ?? undefined,

    surface: f['Surface(m²)'] ?? undefined,
    budgetHT,
    anneeLivraison: f['Année livraison'] ?? undefined,
    missionAi: f['Mission AI'] ?? undefined,
    programme: f['Programme'] ?? undefined,
    pole: f['Pôle'] ?? undefined,
    departement: f['Département'] ?? undefined,
    rehabNeuf: selectValue(f['Rehab / Neuf']),

    statut: normalizeStatut(f['État avancement']),
    layout,
    visiblePortfolio: f['Visible portfolio'] ?? false,

    photoCouverture,
    photosProjet,

    certifications,
    materiaux: [],
    motsCles,
    tagsSiteWeb,

    budgetRaw,
    urlWordpress: f['URL'] ?? undefined,
    chiffresCles: parseChiffresCles(formulaValue(f['Chiffres clefs'])),
  };
}

export async function getProjets(): Promise<Projet[]> {
  'use cache';
  const records = await base(TABLE)
    .select({
      filterByFormula: '{Visible portfolio} = TRUE()',
      sort: [
        { field: 'Année livraison', direction: 'desc' },
        { field: 'Affaire', direction: 'asc' },
      ],
    })
    .all();

  return records.map(recordToProjet);
}

export async function getProjet(slug: string): Promise<Projet | null> {
  'use cache';
  const records = await base(TABLE)
    .select({
      filterByFormula: `{Slug} = "${slug}"`,
      maxRecords: 1,
    })
    .all();

  if (records.length === 0) return null;
  return recordToProjet(records[0]);
}

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
  const records = await base(TABLE)
    .select({ filterByFormula: `{Slug} = "${slug}"`, maxRecords: 1 })
    .all();

  if (records.length === 0) throw new Error(`Projet introuvable: ${slug}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  if (fields.nom !== undefined)          update['Nom du projet']       = fields.nom;
  if (fields.adresse !== undefined)      update['Adresse']             = fields.adresse;
  if (fields.pitch !== undefined)        update['Pitch']               = fields.pitch;
  if (fields.description !== undefined)  update['Description projet']  = fields.description;
  if (fields.moa !== undefined)          update["Maître d'ouvrage"]    = fields.moa;
  if (fields.mandataire !== undefined)   update['Mandataire']          = fields.mandataire;
  if (fields.betAssocies !== undefined)  update['BET associés']        = fields.betAssocies;
  if (fields.entreprise !== undefined)   update['Entreprise']          = fields.entreprise;
  if (fields.bailleur !== undefined)     update['Bailleur']            = fields.bailleur;
  if (fields.referentAi !== undefined)   update['Référent AI']         = fields.referentAi;
  if (fields.missionAi !== undefined)    update['Mission AI']          = fields.missionAi;
  if (fields.surface !== undefined)      update['Surface(m²)']         = fields.surface;
  if (fields.budgetRaw !== undefined)    update['Budget HT']           = fields.budgetRaw;
  if (fields.anneeLivraison !== undefined) update['Année livraison']   = fields.anneeLivraison;
  if (fields.programme !== undefined)    update['Programme']           = fields.programme;
  if (fields.pole !== undefined)         update['Pôle']                = fields.pole;
  if (fields.departement !== undefined)  update['Département']         = fields.departement;
  if (fields.rehabNeuf !== undefined)    update['Rehab / Neuf']        = fields.rehabNeuf;
  if (fields.statut !== undefined)       update['État avancement']     = fields.statut;
  if (fields.layout !== undefined)       update['Sélectionner']        = fields.layout;
  if (fields.certifications !== undefined) update['Certification']     = fields.certifications.join('\n');
  if (fields.motsCles !== undefined)     update['Mots-clés']           = fields.motsCles.join(', ');

  await base(TABLE).update(records[0].id, update);
}

export async function updateProjetUrl(slug: string, url: string): Promise<void> {
  const records = await base(TABLE)
    .select({
      filterByFormula: `{Slug} = "${slug}"`,
      maxRecords: 1,
    })
    .all();

  if (records.length === 0) return;
  await base(TABLE).update(records[0].id, { URL: url });
}
