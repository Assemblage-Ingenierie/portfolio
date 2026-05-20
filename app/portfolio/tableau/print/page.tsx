import { getProjet } from '@/lib/airtable';
import { notFound } from 'next/navigation';
import { SHARED_CSS } from '@/lib/pdf/templates/shared';
import { renderTableau, TABLEAU_DEFAULTS_BY_MODE, TABLEAU_FIELD_KEYS, type TableauOrientation, type TableauMode } from '@/lib/pdf/tableauTemplate';
import PrintRunner from '@/components/PrintRunner';
import type { Projet } from '@/types/projet';

/**
 * Page d'impression du tableau. URL :
 *   /portfolio/tableau/print?items=slug1,slug2&fields=nom,moa&orient=paysage
 *
 * Pas de PDF serveur — on s'appuie sur la boîte d'impression native du
 * navigateur (Save as PDF) comme pour /portfolio/print.
 */
export default async function TableauPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    items?: string; fields?: string; orient?: string; mode?: string;
    cln?: string;  // champ libre — nom de la colonne
    clv?: string;  // champ libre — JSON { slug: description }
    rpp?: string;  // rows per page (auto-pagination paysage)
  }>;
}) {
  const { items: rawItems, fields: rawFields, orient: rawOrient, mode: rawMode, cln: rawCln, clv: rawClv, rpp: rawRpp } = await searchParams;

  const slugs = (rawItems ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));
  if (slugs.length === 0) notFound();

  const mode: TableauMode = rawMode === 'Dev' ? 'Dev' : 'Str-Env';

  const fieldKeys = (rawFields ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(k => TABLEAU_FIELD_KEYS.includes(k));
  const fields = fieldKeys.length > 0 ? fieldKeys : TABLEAU_DEFAULTS_BY_MODE[mode];

  const orientation: TableauOrientation = rawOrient === 'portrait' ? 'portrait' : 'paysage';

  // Champ libre : nom + valeurs par slug (JSON URL-encodé côté client).
  const champLibreNom = typeof rawCln === 'string' && rawCln.trim() ? rawCln : undefined;
  let champLibreValues: Record<string, string> | undefined;
  if (rawClv) {
    try {
      const parsed: unknown = JSON.parse(rawClv);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Sanitise : on ne garde que les paires { slug-valide: string }.
        const safe: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (/^[a-zA-Z0-9_-]+$/.test(k) && typeof v === 'string') safe[k] = v;
        }
        if (Object.keys(safe).length > 0) champLibreValues = safe;
      }
    } catch { /* JSON invalide → on ignore */ }
  }

  const rowsPerPageParsed = rawRpp ? Number(rawRpp) : NaN;
  const rowsPerPage = Number.isFinite(rowsPerPageParsed) && rowsPerPageParsed > 0
    ? Math.floor(rowsPerPageParsed)
    : undefined;

  const projetsLoaded = await Promise.all(slugs.map(s => getProjet(s)));
  const projets = projetsLoaded.filter((p): p is Projet => Boolean(p));
  if (projets.length === 0) notFound();

  const bundle = renderTableau({
    projets, fieldKeys: fields, orientation, mode,
    champLibreNom, champLibreValues, rowsPerPage,
  });

  const pageWidthMm = orientation === 'paysage' ? 297 : 210;
  const pageHeightMm = orientation === 'paysage' ? 210 : 297;

  const PRINT_OVERRIDES = `
    body { background: #ECECEC; margin: 0; padding: 24px 0; }
    #print-source { width: ${pageWidthMm}mm; margin: 0 auto; }
    #print-source > .page {
      background: white;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      margin: 0 auto 24px auto;
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
    }
    @media print {
      body { background: white; padding: 0; }
      .print-toolbar,
      body > button { display: none !important; }
      #print-source { width: auto; margin: 0; }
      #print-source > .page { box-shadow: none; margin: 0; }
    }
  `;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,300;1,6..72,400;1,6..72,500&family=Open+Sans:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: SHARED_CSS + bundle.css + PRINT_OVERRIDES }} />
      <div id="print-source" dangerouslySetInnerHTML={{ __html: bundle.body }} />
      <PrintRunner />
    </>
  );
}
