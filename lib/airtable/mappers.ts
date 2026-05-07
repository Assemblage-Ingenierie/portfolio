import type { Projet, TemplateChoice } from '@/types/projet';
import { normalizeStatut } from '@/lib/utils/normalize';
import { parseChiffresCles, parseTagsSiteWeb, formatBudget } from '@/lib/utils/parsers';
import { formulaValue, linkedValue, selectValue } from './client';
import { autoSelectTemplate, isTemplateChoice } from '@/lib/pdf/selectTemplate';
import { deserializeConfig } from '@/lib/pdf/manualConfig';

// Field IDs Airtable des nouveaux champs Programme principal / Programme
// secondaire (multi-select). Lus via une requête auxiliaire en
// `returnFieldsByFieldId: true` parce que leur nom de colonne Airtable
// n'est pas garanti stable côté code.
export const FIELD_PROGRAMME_PRINCIPAL = 'fldKNKtsZNpvmf695';
export const FIELD_PROGRAMME_SECONDAIRE = 'fldaTqKMNrIpeGBma';

/**
 * Valeurs récupérées via la requête auxiliaire en `cellFormat='string'`
 * (cf. queries.ts → fetchAux). Toutes optionnelles : la requête principale
 * reste fonctionnelle même si l'aux échoue.
 */
export interface AuxValues {
  architecte?: string;
  mandataire?: string;
  entreprise?: string;
  programmePrincipal?: string;
  programmeSecondaire?: string;
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

    moa: f["Maître d'ouvrage"] ?? undefined,
    // Architecte / Mandataire / Entreprise : champs synchronisés depuis la
    // base CRM (linked records). En cellFormat=json ils reviennent en
    // array de record IDs ; on prend la valeur affichée fournie par la
    // requête auxiliaire (cellFormat=string), avec fallback sur l'ancien
    // comportement linkedValue pour les bases qui n'auraient pas migré.
    architecte: aux?.architecte ?? linkedValue(f['Architecte']),
    mandataire: aux?.mandataire ?? linkedValue(f['Mandataire']),
    betAssocies: f['BET associés'] ?? undefined,
    entreprise: aux?.entreprise ?? linkedValue(f['Entreprise']),
    bailleur: f['Bailleur'] ?? undefined,
    referentAi: f['Référent AI'] ?? undefined,

    surface: f['Surface(m²)'] ?? undefined,
    budgetHT,
    anneeLivraison: f['Année livraison'] ?? undefined,
    missionAi: f['Mission AI'] ?? undefined,
    programme: f['Programme'] ?? undefined,
    programmePrincipal: aux?.programmePrincipal,
    programmeSecondaire: aux?.programmeSecondaire,
    pole: f['Pôle'] ?? undefined,
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
