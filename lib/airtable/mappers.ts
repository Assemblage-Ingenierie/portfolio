import type { Projet, TemplateChoice } from '@/types/projet';
import { normalizeStatut } from '@/lib/utils/normalize';
import { parseChiffresCles, parseTagsSiteWeb, formatBudget } from '@/lib/utils/parsers';
import { formulaValue, linkedValue, selectValue } from './client';
import { autoSelectTemplate, isTemplateChoice } from '@/lib/pdf/selectTemplate';
import { deserializeConfig } from '@/lib/pdf/manualConfig';

// Field IDs Airtable pour les nouveaux champs Programme principal / secondaire
// (lookup ou linked records depuis la base CRM). On les lit par ID via une
// requête auxiliaire `returnFieldsByFieldId: true` car leur nom de colonne
// n'est pas garanti stable côté Airtable.
export const FIELD_PROGRAMME_PRINCIPAL = 'fldKNKtsZNpvmf695';
export const FIELD_PROGRAMME_SECONDAIRE = 'fldaTqKMNrIpeGBma';

export interface ProgrammeAux {
  principal?: string;
  secondaire?: string;
}

// Avec cellFormat='string', tous les nombres reviennent en string formaté
// (ex. "1 767" — espaces fines insécables). Cette fonction inverse la
// conversion proprement, ou laisse passer les vrais nombres.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNumber(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[\s  ]/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBool(v: any): boolean {
  if (v === true) return true;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    return s === 'true' || s === 'checked' || s === '1' || s === 'oui';
  }
  return false;
}

// Linked records sous cellFormat='string' renvoient la liste des primary
// fields séparés par virgule. Les anciens champs texte simple restent string.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textOrJoined(v: any): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string') return v.trim() || undefined;
  if (Array.isArray(v)) {
    const joined = v.filter((x) => typeof x === 'string' && x.trim()).join(', ');
    return joined || undefined;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function recordToProjet(record: any, programmes?: ProgrammeAux): Projet {
  const f = record.fields;

  // Airtable expose les dimensions via attachment.thumbnails.full / large.
  // (Les attachments restent en JSON natif même avec cellFormat='string'.)
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

  const budgetRaw = toNumber(f['Budget HT']);
  const budgetHT = budgetRaw !== undefined ? formatBudget(budgetRaw) : undefined;

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
    // Architecte / Mandataire / Entreprise : désormais synchronisés depuis
    // la base CRM (linked records). Avec cellFormat='string', Airtable renvoie
    // déjà la valeur affichée — on garde linkedValue en fallback pour les
    // anciens enregistrements encore en array.
    architecte: textOrJoined(f['Architecte']) ?? linkedValue(f['Architecte']),
    mandataire: textOrJoined(f['Mandataire']) ?? linkedValue(f['Mandataire']),
    betAssocies: f['BET associés'] ?? undefined,
    entreprise: textOrJoined(f['Entreprise']) ?? linkedValue(f['Entreprise']),
    bailleur: f['Bailleur'] ?? undefined,
    referentAi: f['Référent AI'] ?? undefined,

    surface: toNumber(f['Surface(m²)']),
    budgetHT,
    anneeLivraison: toNumber(f['Année livraison']),
    missionAi: f['Mission AI'] ?? undefined,
    programme: f['Programme'] ?? undefined,
    programmePrincipal: programmes?.principal,
    programmeSecondaire: programmes?.secondaire,
    pole: f['Pôle'] ?? undefined,
    departement: f['Département'] ?? undefined,
    rehabNeuf: selectValue(f['Rehab / Neuf']),

    statut: normalizeStatut(f['État avancement']),
    template,
    visiblePortfolio: toBool(f['Visible portfolio']),

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
