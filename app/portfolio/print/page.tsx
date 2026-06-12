import { getProjet } from '@/lib/airtable';
import { notFound } from 'next/navigation';
import type { Projet, TemplateChoice } from '@/types/projet';
import { isTemplateChoice } from '@/lib/pdf/selectTemplate';
import { renderPortfolioBundle, PortfolioItem } from '@/lib/pdf/renderPortfolio';
import { COVER_VARIANTS, type CoverVariant } from '@/lib/pdf/templates/cover';
import { SHARED_CSS } from '@/lib/pdf/templates/shared';
import PrintRunner from '@/components/PrintRunner';

/**
 * Page d'export portfolio : Cover + Sommaire + N fiches concaténées en un
 * seul document A4. Impression native du navigateur (Save as PDF) →
 * un seul PDF concaténé.
 *
 * Format de l'URL : /portfolio/print?items=slug1:Solo,slug2:Diptyque,...
 *
 * Paramètre optionnel `cover` : `cover=0` exporte uniquement les fiches de
 * références (sans page de garde ni sommaire). Toute autre valeur (ou absence)
 * inclut la page de garde + le sommaire.
 *
 * Paramètre optionnel `pdg` : variante de page de garde (STR/ENV/DEV) — change
 * la photo de couverture. Défaut STR.
 */

interface ParsedItem {
  slug: string;
  template: TemplateChoice;
}

function parseItemsParam(raw: string | undefined): ParsedItem[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const [slug, tmpl] = entry.split(':');
      return { slug, template: isTemplateChoice(tmpl) ? tmpl : 'Solo' };
    })
    // Filtre les slugs invalides (sécurité)
    .filter(it => /^[a-zA-Z0-9_-]+$/.test(it.slug));
}

export default async function PortfolioPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string; cover?: string; pdg?: string }>;
}) {
  const { items: rawItems, cover, pdg } = await searchParams;
  const parsed = parseItemsParam(rawItems);
  if (parsed.length === 0) notFound();

  // `cover=0` → uniquement les fiches (pas de page de garde ni de sommaire).
  const includeCover = cover !== '0';
  // `pdg` → variante de page de garde (photo de couverture). Défaut STR.
  const coverVariant: CoverVariant = COVER_VARIANTS.includes(pdg as CoverVariant)
    ? (pdg as CoverVariant)
    : 'STR';

  // Fetch parallèle de tous les projets sélectionnés
  const projets = await Promise.all(parsed.map(p => getProjet(p.slug)));

  const items: PortfolioItem[] = parsed
    .map((p, i) => ({ projet: projets[i], template: p.template }))
    .filter((it): it is { projet: Projet; template: TemplateChoice } => Boolean(it.projet));

  if (items.length === 0) notFound();

  const bundle = renderPortfolioBundle(items, 'Portfolio', includeCover, coverVariant);

  // Affichage écran : fond gris, pages avec ombre (visualisation A4)
  // Impression : on retire toute la chrome et le moteur natif rend chaque .page
  // sur une feuille A4 séparée grâce à `page-break-before` (déclaré dans bundle.css).
  const PRINT_OVERRIDES = `
    body { background: #ECECEC; margin: 0; padding: 24px 0; }
    #print-source { width: 210mm; margin: 0 auto; }
    #print-source > .page {
      background: white;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      margin: 0 auto 24px auto;
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
      {/* Google Fonts : mêmes métriques que l'éditeur. Cf. /projet/[slug]/print
          pour la justification (sans ça, wrap divergent → overlap des blocs
          position:absolute par-dessus la description). */}
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
