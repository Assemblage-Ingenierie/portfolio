import type { Projet, TemplateChoice } from '@/types/projet';
import { normalizeStatut } from '@/lib/utils/normalize';
import { parseChiffresCles, parseTagsSiteWeb, formatBudget } from '@/lib/utils/parsers';
import { formulaValue, selectValue } from './client';
import { autoSelectTemplate, isTemplateChoice } from '@/lib/pdf/selectTemplate';
import { deserializeConfig } from '@/lib/pdf/manualConfig';

// Field IDs Airtable des nouveaux champs Programme principal / Programme
// secondaire (multi-select). Lus via une requête auxiliaire en
// `returnFieldsByFieldId: true` parce que leur nom de colonne Airtable
// n'est pas garanti stable côté code.
export const FIELD_PROGRAMME_PRINCIPAL = 'fldKNKtsZNpvmf695';
export const FIELD_PROGRAMME_SECONDAIRE = 'fldaTqKMNrIpeGBma';
// Pôle (single-select : STR / ENV / DEV / Autre) — lu par field ID pour
// éviter toute dérive si la colonne "Pôle" est renommée côté Airtable.
export const FIELD_POLE = 'fldJyT3Lu0ZEH7EYE';

/**
 * Valeurs auxiliaires injectées dans le mapper.
 * Toutes optionnelles : la requête principale reste fonctionnelle si l'aux échoue.
 * - programmePrincipal/Secondaire : lus par field ID depuis la table portfolio
 * - crmNames : Map<recordId → nom> récupérée depuis la base "CRM AI"
 *   pour résoudre Architecte / Mandataire / Entreprise
 */
export interface AuxValues {
  programmePrincipal?: string;
  programmeSecondaire?: string;
  pole?: string;
  crmNames?: Map<string, string>;
}

/**
 * Résout un champ linked records (retourné en JSON = array de record IDs)
 * vers les noms CRM correspondants.
 * Si un ID n'est pas trouvé dans la map, il est omis (pas d'ID brut affiché).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveCrm(field: any, crmNames?: Map<string, string>): string | undefined {
  if (!field) return undefined;
  const ids: string[] = Array.isArray(field)
    ? field.filter((x) => typeof x === 'string')
    : typeof field === 'string' ? [field] : [];
  if (ids.length === 0) return undefined;

  if (crmNames) {
    const resolved = ids.map((id) => crmNames.get(id)).filter(Boolean) as string[];
    if (resolved.length > 0) return resolved.join(', ');
    // Tous les IDs sont inconnus de la map CRM (base non configurée ou PAT sans accès)
    // → on retourne undefined plutôt que d'afficher les IDs bruts
    return undefined;
  }
  // Pas de map CRM du tout : comportement legacy (affiche le 1er ID si présent)
  return ids[0] ?? undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function recordToProjet(record: any, aux?: AuxValues): Projet {
  const f = record.fields;

  // Airtable expose les dimensions via attachment.thumbnails.full / large.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function dimsFrom(a: any): { width?: number; height?: number } {
    const t = a?.thumbnails?.full ?? a?.thumbnails?.large;
    return t ? { width: t.width, height: t.height } : {};
  }

  const photoCouvertureRaw = f['Photo Couverture']?.[0];
  const photoCouverture = photoCouvertureRaw
    ? {
        url: photoCouvertureRaw.url,
        filename: photoCouvertureRaw.filename ?? 'cover.jpg',
        ...dimsFrom(photoCouvertureRaw),
      }
    : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photosProjet = (f['Photos projet'] ?? []).map((a: any) => ({
    url: a.url,
    filename: a.filename ?? 'photo.jpg',
    ...dimsFrom(a),
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

  // Champ renommé Sélectionner → Template ; on lit les deux pendant la transition
  // et on accepte les valeurs legacy Editorial/Magazine en fallback auto.
  const rawTemplate = f['Template'] ?? f['Sélectionner'];
  const description: string = f['Description projet'] ?? '';
  const tmpProjet = { photoCouverture, photosProjet, description };
  const template: TemplateChoice = isTemplateChoice(rawTemplate)
    ? rawTemplate
    : autoSelectTemplate(tmpProjet);

  return {
    affaire: f['Affaire'] ?? '',
    slug: f['Slug'] ?? '',
    nom: f['Nom du projet'] ?? '',
    adresse: f['Adresse'] ?? undefined,
    lieu: f['Lieu'] ?? undefined,
    pitch: formulaValue(f['Pitch']),
    description,

    // MOA aussi linked record (sync CRM) → résolution via crmNames
    moa: resolveCrm(f["Maître d'ouvrage"], aux?.crmNames) ?? (typeof f["Maître d'ouvrage"] === 'string' ? f["Maître d'ouvrage"] : undefined),
    // Architecte / Mandataire / Entreprise : champs linked records pointant
    // vers la base CRM AI. En cellFormat=json ils reviennent en array de
    // record IDs (recXXX…). On résout les noms via la map crmNames
    // construite dans queries.ts → fetchCrmNames().
    architecte: resolveCrm(f['Architecte'], aux?.crmNames),
    mandataire: resolveCrm(f['Mandataire'], aux?.crmNames),
    betAssocies: f['BET associés'] ?? undefined,
    entreprise: resolveCrm(f['Entreprise'], aux?.crmNames),
    bailleur: f['Bailleur'] ?? undefined,
    referentAi: f['Référent AI'] ?? undefined,

    surface: f['Surface(m²)'] ?? undefined,
    budgetHT,
    anneeLivraison: f['Année livraison'] ?? undefined,
    missionAi: f['Mission AI'] ?? undefined,
    programme: f['Programme'] ?? undefined,
    programmePrincipal: aux?.programmePrincipal,
    programmeSecondaire: aux?.programmeSecondaire,
    // Pôle : prioritairement lu via aux par field ID (cf. FIELD_POLE), fallback
    // sur le nom de colonne 'Pôle' pour rester rétro-compatible.
    pole: aux?.pole ?? f['Pôle'] ?? undefined,
    departement: f['Département'] ?? undefined,
    rehabNeuf: selectValue(f['Rehab / Neuf']),

    statut: normalizeStatut(f['État avancement']),
    template,
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
    savedManualConfig: deserializeConfig(f['Config template manuel']) ?? undefined,
  };
}
