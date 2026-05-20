import type { Projet, TemplateChoice } from '@/types/projet';
import { normalizeStatut } from '@/lib/utils/normalize';
import { parseChiffresCles, parseTagsSiteWeb, formatBudget } from '@/lib/utils/parsers';
import { formulaValue } from './client';
import { autoSelectTemplate, isTemplateChoice } from '@/lib/pdf/selectTemplate';
import { deserializeProjectConfig, PROJECT_CONFIG_FIELD } from '@/lib/pdf/projectConfig';

// Field IDs Airtable des nouveaux champs Programme principal / Programme
// secondaire (multi-select). Lus via une requête auxiliaire en
// `returnFieldsByFieldId: true` parce que leur nom de colonne Airtable
// n'est pas garanti stable côté code.
export const FIELD_PROGRAMME_PRINCIPAL = 'fldKNKtsZNpvmf695';
export const FIELD_PROGRAMME_SECONDAIRE = 'fldaTqKMNrIpeGBma';
// Pôle (single-select : STR / ENV / DEV / Autre) — lu par field ID pour
// éviter toute dérive si la colonne "Pôle" est renommée côté Airtable.
export const FIELD_POLE = 'fldJyT3Lu0ZEH7EYE';
// Vignette pôle (multi-select STR / ENV / DEV) — pilote l'affichage des
// 3 vignettes en en-tête. Lu par field ID parce que le nom de colonne
// "Vignette pôle" contient un accent (instable côté code).
export const FIELD_VIGNETTE_POLE = 'fld1PZuYO8mz0sULA';
// Prestation Assemblage (long text, rich text Markdown) — lu par field ID.
// Affiché en bloc dédié dans le template "Dev" (titre + valeur rich text).
export const FIELD_PRESTATION_ASSEMBLAGE = 'flddrMLBDxOc8r4lJ';
// Rehab / Neuf (multi-select : "Neuf" | "Réhab") — lu par field ID pour
// éviter toute dérive si la colonne est renommée côté Airtable.
export const FIELD_REHAB_NEUF = 'fldyD7L9E7cGL26vH';
// Matériaux (multi-select) — lu par field ID.
export const FIELD_MATERIAUX = 'fldC4SW9n1H2PZ3MH';
// Statut (multi-select : En étude / En chantier / Livré / Abandonné / En pause /
// En consultation) — lu par field ID pour permettre le filtrage AND sur
// plusieurs valeurs. Le champ historique 'État avancement' reste utilisé en
// fallback pour le statut canonique (single value).
export const FIELD_STATUT = 'fldxXNdE0uNaomeby';

/**
 * Valeurs auxiliaires injectées dans le mapper.
 * Toutes optionnelles : la requête principale reste fonctionnelle si l'aux échoue.
 * - programmePrincipal/Secondaire : lus par field ID depuis la table portfolio
 * - crmNames : Map<recordId → nom> récupérée depuis la base "CRM AI"
 *   pour résoudre Architecte / Mandataire / Entreprise
 */
export interface AuxValues {
  programmePrincipal?: string;
  programmesPrincipaux?: string[];
  programmeSecondaire?: string;
  pole?: string;
  vignettePoles?: string[];
  prestationAssemblage?: string;
  /** Valeurs brutes du multi-select "Rehab / Neuf" (field fldyD7L9E7cGL26vH). */
  rehabNeufValues?: string[];
  /** Valeurs brutes du multi-select "Matériaux" (field fldC4SW9n1H2PZ3MH). */
  materiauxValues?: string[];
  /** Valeurs brutes du multi-select "Statut" (field fldxXNdE0uNaomeby). */
  statutValues?: string[];
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

  // Champ "Certification" (field id fldnb9rfM4C3m9Pcu) — depuis 2026 c'est
  // un champ rich text (Markdown GFM). Airtable retourne une string contenant
  // possiblement des listes (`- item`, `* item`, `1. item`) ou du texte
  // formaté. Le rendu downstream attend un `string[]` (une entrée par certif).
  //
  // Stratégie de parsing :
  //   1. Split sur newlines (pas sur virgules — risque de couper des labels
  //      "ISO 14001, version 2015" en deux fragments).
  //   2. Strip des marqueurs de liste Markdown au début de chaque ligne :
  //      `- `, `* `, `+ `, `1. `, `2) `, etc.
  //   3. Ignore les lignes vides (séparateurs de paragraphes).
  // Conservation : si Airtable renvoie array (rétro-compat ancien format
  // multi-select), on ne fait que trim ; si rien, array vide.
  const rawCertification = f['Certification'];
  const stripBullet = (line: string): string =>
    line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim();
  const certifications: string[] = Array.isArray(rawCertification)
    ? rawCertification.map((s) => String(s).trim()).filter(Boolean)
    : typeof rawCertification === 'string' && rawCertification
      ? rawCertification.split('\n').map(stripBullet).filter(Boolean)
      : [];

  // Champ "Mots-clés" : la virgule est le SEUL séparateur de ligne. Tout
  // ce qui est entre deux virgules reste sur la même ligne (les espaces
  // sont préservés pour permettre des mots-clés composés du type
  // "patrimoine industriel électrique").
  const rawMotsCles = f['Mots-clés'] ?? '';
  const motsCles = typeof rawMotsCles === 'string' && rawMotsCles
    ? rawMotsCles.split(',').map((s: string) => s.trim()).filter(Boolean)
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
  // Calcule les pôles ici (dupliqué avec le mapping final plus bas mais
  // nécessaire pour `autoSelectTemplate` qui en dépend).
  const vignettePolesForTemplate: string[] | undefined = aux?.vignettePoles ?? (() => {
    const raw = f['Vignette pôle'];
    if (Array.isArray(raw)) {
      const arr = raw.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      return arr.length ? arr : undefined;
    }
    if (typeof raw === 'string' && raw.trim()) {
      const arr = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      return arr.length ? arr : undefined;
    }
    return undefined;
  })();
  const poleForTemplate = aux?.pole ?? f['Pôle'];
  const tmpProjet = {
    photoCouverture,
    photosProjet,
    description,
    vignettePoles: vignettePolesForTemplate,
    pole: poleForTemplate,
  };
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
    // BET associés : linked record vers Sync CRM (comme Architecte / MOA /
    // Entreprise). En cellFormat=json on reçoit un array de record IDs,
    // résolution des noms via crmNames.
    betAssocies: resolveCrm(f['BET associés'], aux?.crmNames),
    // Entreprise (fldWsiJtKrOWyzRDr) et Bailleur (fldUYSS8DyqtT2gDJ) : depuis
    // 2026, ces deux champs sont aussi des linked records vers la base CRM AI.
    // Fallback string si Airtable retourne directement une string (rétro-compat
    // sur les anciennes fiches non migrées).
    entreprise: resolveCrm(f['Entreprise'], aux?.crmNames) ?? (typeof f['Entreprise'] === 'string' ? f['Entreprise'] : undefined),
    bailleur: resolveCrm(f['Bailleur'], aux?.crmNames) ?? (typeof f['Bailleur'] === 'string' ? f['Bailleur'] : undefined),
    referentAi: f['Référent AI'] ?? undefined,

    surface: f['Surface(m²)'] ?? undefined,
    budgetHT,
    anneeLivraison: f['Année livraison'] ?? undefined,
    missionAi: f['Mission AI'] ?? undefined,
    programme: f['Programme'] ?? undefined,
    programmePrincipal: aux?.programmePrincipal,
    programmesPrincipaux: aux?.programmesPrincipaux,
    programmeSecondaire: aux?.programmeSecondaire,
    // Pôle : prioritairement lu via aux par field ID (cf. FIELD_POLE), fallback
    // sur le nom de colonne 'Pôle' pour rester rétro-compatible.
    pole: aux?.pole ?? f['Pôle'] ?? undefined,
    vignettePoles: aux?.vignettePoles ?? (() => {
      const raw = f['Vignette pôle'];
      if (Array.isArray(raw)) {
        const arr = raw.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
        return arr.length ? arr : undefined;
      }
      // cellFormat 'string' → CSV "ENV, STR" ; split obligatoire.
      if (typeof raw === 'string' && raw.trim()) {
        const arr = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        return arr.length ? arr : undefined;
      }
      return undefined;
    })(),
    departement: f['Département'] ?? undefined,
    prestationAssemblage: aux?.prestationAssemblage,
    // Rehab / Neuf : prioritairement lu via aux (field ID), fallback nom de colonne.
    rehabNeuf: (() => {
      const vals = aux?.rehabNeufValues;
      if (vals) return vals.length > 0 ? vals.join(', ') : undefined;
      const raw = f['Rehab / Neuf'];
      if (Array.isArray(raw)) return raw.length > 0 ? raw.join(', ') : undefined;
      if (typeof raw === 'string' && raw.trim()) return raw;
      return undefined;
    })(),
    rehabNeufValues: (() => {
      const vals = aux?.rehabNeufValues;
      if (vals) return vals;
      const raw = f['Rehab / Neuf'];
      if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
      if (typeof raw === 'string' && raw.trim()) return raw.split(/\s*,\s*/).filter(Boolean);
      return [];
    })(),

    statut: normalizeStatut(f['État avancement']),
    // Statut multi-select (field ID FIELD_STATUT) : array de toutes les valeurs
    // pour le filtre AND. Fallback sur `statut` canonique si l'aux n'est pas
    // disponible (rétro-compat avec l'ancienne colonne single-select).
    statutValues: (() => {
      const vals = aux?.statutValues;
      if (vals && vals.length > 0) {
        // Dédoublonnage : plusieurs raw values peuvent normaliser vers le même Statut.
        return [...new Set(vals.map((v) => normalizeStatut(v)))];
      }
      return [normalizeStatut(f['État avancement'])];
    })(),
    template,
    visiblePortfolio: f['Visible portfolio'] ?? false,

    photoCouverture,
    photosProjet,

    certifications,
    materiaux: aux?.materiauxValues ?? [],
    motsCles,
    tagsSiteWeb,

    budgetRaw,
    urlWordpress: f['URL'] ?? undefined,
    chiffresCles: parseChiffresCles(formulaValue(f['Chiffres clefs'])),
    // Configuration unifiée : un seul champ Airtable contient à la fois la
    // config du bandeau (générale) et celle du template Manuel (conditionnelle).
    ...(() => {
      const cfg = deserializeProjectConfig(f[PROJECT_CONFIG_FIELD]);
      const portfolio = cfg?.portfolio;
      const hasDate = Boolean(portfolio?.date_demarrage || portfolio?.date_fin_estimee);
      return {
        savedManualConfig: cfg?.manuel ?? undefined,
        bandeauConfig: cfg?.bandeau ?? undefined,
        photoCrops: cfg?.photoCrops ?? undefined,
        portfolioPeriod: hasDate
          ? {
              dateDemarrage: portfolio?.date_demarrage,
              dateFinEstimee: portfolio?.date_fin_estimee,
            }
          : undefined,
      };
    })(),
  };
}
