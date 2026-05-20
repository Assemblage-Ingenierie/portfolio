import type { Projet } from '@/types/projet';
import { cacheTag } from 'next/cache';
import { base, TABLE } from './client';
import { recordToProjet, type AuxValues, FIELD_PROGRAMME_PRINCIPAL, FIELD_PROGRAMME_SECONDAIRE, FIELD_POLE, FIELD_VIGNETTE_POLE, FIELD_PRESTATION_ASSEMBLAGE, FIELD_REHAB_NEUF, FIELD_MATERIAUX, FIELD_STATUT } from './mappers';
import { fetchCrmNames } from './crm';

export const PROJETS_TAG = 'projets';

const STRING_FORMAT = {
  cellFormat: 'string' as const,
  timeZone: 'Europe/Paris',
  userLocale: 'fr-fr',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstValue(v: any): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string') {
    const first = v.split(/\s*,\s*/)[0]?.trim();
    return first || undefined;
  }
  if (Array.isArray(v)) {
    const first = v[0];
    return typeof first === 'string' && first ? first : undefined;
  }
  return undefined;
}

/**
 * Extrait les record IDs Airtable (format recXXX…) présents dans un champ
 * linked records (retourné en JSON natif = array de strings).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractIds(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.startsWith('rec'));
  if (typeof v === 'string' && v.startsWith('rec')) return [v];
  return [];
}

/**
 * Requête auxiliaire pour les champs lus par field ID :
 * - Programme principal / secondaire (multi-selects)
 * - Pôle (single-select STR/ENV/DEV/Autre — utilisé pour le choix de vignette)
 *
 * Tolérante aux erreurs (renvoie une map vide plutôt que de propager).
 */
interface AuxByFieldId {
  principal?: string;
  principaux?: string[];
  secondaire?: string;
  pole?: string;
  vignettePoles?: string[];
  prestationAssemblage?: string;
  rehabNeuf?: string[];
  materiaux?: string[];
  statut?: string[];
}

// Multi-select avec cellFormat: 'string' → CSV. Renvoie l'array complet
// (par opposition à `firstValue` qui ne garde que le premier élément).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function allValues(v: any): string[] | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (Array.isArray(v)) {
    const arr = v.map((s) => String(s).trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  if (typeof v === 'string') {
    const arr = v.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  return undefined;
}

async function fetchAuxByFieldId(
  filterFormula?: string,
): Promise<Map<string, AuxByFieldId>> {
  const map = new Map<string, AuxByFieldId>();
  try {
    const records = await base(TABLE)
      .select({
        ...STRING_FORMAT,
        fields: [FIELD_PROGRAMME_PRINCIPAL, FIELD_PROGRAMME_SECONDAIRE, FIELD_POLE, FIELD_VIGNETTE_POLE, FIELD_PRESTATION_ASSEMBLAGE, FIELD_REHAB_NEUF, FIELD_MATERIAUX, FIELD_STATUT],
        returnFieldsByFieldId: true,
        ...(filterFormula ? { filterByFormula: filterFormula } : {}),
      })
      .all();
    records.forEach((r) => {
      const poleRaw = r.fields[FIELD_POLE];
      const prestaRaw = r.fields[FIELD_PRESTATION_ASSEMBLAGE];
      // Avec cellFormat: 'string', les multi-selects reviennent en string
      // CSV ("ENV, STR"), pas en array. On split sur la virgule pour
      // récupérer chaque pôle individuellement. Array conservé en safety
      // au cas où l'API change.
      const vignetteRaw = r.fields[FIELD_VIGNETTE_POLE];
      const toPoles = (raw: unknown): string[] | undefined => {
        if (Array.isArray(raw)) {
          const arr = raw.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
          return arr.length ? arr : undefined;
        }
        if (typeof raw === 'string' && raw.trim()) {
          const arr = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
          return arr.length ? arr : undefined;
        }
        return undefined;
      };
      const vignettePoles = toPoles(vignetteRaw);
      map.set(r.id, {
        principal: firstValue(r.fields[FIELD_PROGRAMME_PRINCIPAL]),
        principaux: allValues(r.fields[FIELD_PROGRAMME_PRINCIPAL]),
        secondaire: firstValue(r.fields[FIELD_PROGRAMME_SECONDAIRE]),
        pole: typeof poleRaw === 'string' && poleRaw.trim() ? poleRaw.trim() : undefined,
        vignettePoles,
        prestationAssemblage: typeof prestaRaw === 'string' && prestaRaw.trim() ? prestaRaw : undefined,
        rehabNeuf: allValues(r.fields[FIELD_REHAB_NEUF]) ?? [],
        materiaux: allValues(r.fields[FIELD_MATERIAUX]) ?? [],
        statut: allValues(r.fields[FIELD_STATUT]) ?? [],
      });
    });
  } catch (err) {
    console.error('[airtable] fetchAuxByFieldId failed:', err);
  }
  return map;
}

export async function getProjets(): Promise<Projet[]> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return [];
  try {
    const filter = '{Visible portfolio} = TRUE()';

    // 1. Requête principale (cellFormat=json → attachments OK) + programmes en parallèle
    const [records, programmes] = await Promise.all([
      base(TABLE)
        .select({
          filterByFormula: filter,
          sort: [
            { field: 'Année livraison', direction: 'desc' },
            { field: 'Affaire', direction: 'asc' },
          ],
        })
        .all(),
      fetchAuxByFieldId(filter),
    ]);

    // 2. Collecte des record IDs CRM depuis MOA / Architecte / Mandataire /
    //    Entreprise / BET associés / Bailleur — tous des linked records vers
    //    la base CRM AI (fldUYSS8DyqtT2gDJ pour Bailleur,
    //    fldWsiJtKrOWyzRDr pour Entreprise).
    const crmIds = records.flatMap((r) => [
      ...extractIds(r.fields["Maître d'ouvrage"]),
      ...extractIds(r.fields['Architecte']),
      ...extractIds(r.fields['Mandataire']),
      ...extractIds(r.fields['Entreprise']),
      ...extractIds(r.fields['BET associés']),
      ...extractIds(r.fields['Bailleur']),
    ]);

    // 3. Résolution des noms depuis la base CRM AI (silencieux si non configuré)
    const crmNames = await fetchCrmNames(crmIds);

    // 4. Mapping final
    return records.map((r) => {
      const prog = programmes.get(r.id);
      const aux: AuxValues = {
        programmePrincipal: prog?.principal,
        programmesPrincipaux: prog?.principaux,
        programmeSecondaire: prog?.secondaire,
        pole: prog?.pole,
        vignettePoles: prog?.vignettePoles,
        prestationAssemblage: prog?.prestationAssemblage,
        rehabNeufValues: prog?.rehabNeuf,
        materiauxValues: prog?.materiaux,
        statutValues: prog?.statut,
        crmNames,
      };
      return recordToProjet(r, aux);
    });
  } catch (err) {
    console.error('[airtable] getProjets failed:', err);
    return [];
  }
}

export async function getProjet(slug: string): Promise<Projet | null> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return null;
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return null;
  try {
    // Gate par Visible portfolio : une fiche n'est consultable que si
    // {Visible portfolio} = TRUE() — la coche dans Airtable est désormais
    // le seul déclencheur de la création d'une fiche de référence.
    const filter = `AND({Slug} = "${slug}", {Visible portfolio} = TRUE())`;

    const [records, prog] = await Promise.all([
      base(TABLE).select({ filterByFormula: filter, maxRecords: 1 }).all(),
      fetchAuxByFieldId(filter),
    ]);
    if (records.length === 0) return null;

    const r = records[0];
    const crmIds = [
      ...extractIds(r.fields["Maître d'ouvrage"]),
      ...extractIds(r.fields['Architecte']),
      ...extractIds(r.fields['Mandataire']),
      ...extractIds(r.fields['Entreprise']),
      ...extractIds(r.fields['BET associés']),
      ...extractIds(r.fields['Bailleur']),
    ];
    // Debug : on log même en succès pour pouvoir tracer pourquoi un champ
    // n'est pas résolu (le console.error de fetchCrmNames ne se déclenche
    // que sur exception, pas sur résultat vide)
    console.log(`[crm-debug] ${slug} moa field raw:`, JSON.stringify(r.fields["Maître d'ouvrage"]));
    console.log(`[crm-debug] ${slug} architecte field raw:`, JSON.stringify(r.fields['Architecte']));
    console.log(`[crm-debug] ${slug} mandataire field raw:`, JSON.stringify(r.fields['Mandataire']));
    console.log(`[crm-debug] ${slug} entreprise field raw:`, JSON.stringify(r.fields['Entreprise']));
    console.log(`[crm-debug] ${slug} ids collected:`, crmIds);
    const crmNames = await fetchCrmNames(crmIds);
    console.log(`[crm-debug] ${slug} resolved (${crmNames.size}/${crmIds.length}):`, [...crmNames.entries()]);

    const p = prog.get(r.id);
    const aux: AuxValues = {
      programmePrincipal: p?.principal,
      programmesPrincipaux: p?.principaux,
      programmeSecondaire: p?.secondaire,
      pole: p?.pole,
      vignettePoles: p?.vignettePoles,
      prestationAssemblage: p?.prestationAssemblage,
      rehabNeufValues: p?.rehabNeuf,
      materiauxValues: p?.materiaux,
      statutValues: p?.statut,
      crmNames,
    };
    return recordToProjet(r, aux);
  } catch (err) {
    console.error(`[airtable] getProjet(${slug}) failed:`, err);
    return null;
  }
}
