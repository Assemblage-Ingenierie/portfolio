import { getProjet } from '@/lib/airtable';
import { notFound } from 'next/navigation';
import { renderTemplate } from '@/lib/pdf/renderHtml';
import { SHARED_CSS } from '@/lib/pdf/templates/shared';
import { isTemplateChoice } from '@/lib/pdf/selectTemplate';
import { decodeConfig } from '@/lib/pdf/manualConfig';
import PrintRunner from '@/components/PrintRunner';

/**
 * Page d'impression : rend le template PDF directement dans le navigateur,
 * puis bouton "Imprimer / PDF" qui ouvre la boîte de dialogue native du
 * navigateur (Save as PDF). Pagination via @page A4 + le moteur natif
 * du navigateur (Chromium/WebKit). Pas de paged.js, pas de Puppeteer serveur.
 *
 * Query param `template` (Solo|Diptyque|...) permet de forcer un template
 * sans dépendre de la valeur Airtable — utile car la propagation Airtable
 * n'est pas instantanée et l'utilisateur peut vouloir tester un autre layout.
 */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ template?: string; config?: string }>;
}) {
  const { slug } = await params;
  const { template: templateOverride, config: configRaw } = await searchParams;
  const projet = await getProjet(slug);
  if (!projet) notFound();

  // Si l'utilisateur passe ?template=... et que la valeur est valide, on prend
  // celle-ci plutôt que celle d'Airtable (qui peut être périmée ou auto-sélectionnée).
  const effectiveProjet = isTemplateChoice(templateOverride)
    ? { ...projet, template: templateOverride }
    : projet;

  // Si template === 'Manuel' ou 'Dev' et qu'une config est fournie, on la décode.
  const manualConfig = (effectiveProjet.template === 'Str-Env' || effectiveProjet.template === 'Dev') && configRaw
    ? decodeConfig(configRaw) ?? undefined
    : undefined;

  const bundle = renderTemplate(effectiveProjet, manualConfig ? { manualConfig } : undefined);

  // Overrides d'affichage écran (avant impression) :
  // - fond gris autour de la fiche pour visualiser la "page"
  // - ombre + centrage de la fiche (210mm de large = A4)
  // En @media print : tout ça disparaît, seule la fiche est imprimée
  // au format A4 grâce à la règle @page A4 du CSS template.
  const PRINT_OVERRIDES = `
    body { background: #ECECEC; margin: 0; padding: 24px 0; }
    #print-source {
      width: 210mm;
      margin: 0 auto;
      background: white;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }

    @media print {
      body { background: white; padding: 0; }
      .print-toolbar,
      body > button { display: none !important; }
      #print-source {
        width: auto;
        margin: 0;
        box-shadow: none;
      }
    }
  `;

  return (
    <>
      {/* Google Fonts : indispensable pour conserver les MÊMES métriques de
          texte que l'éditeur (lui passe par renderShell → FONTS_LINK).
          Sans ça, fallback Times/Arial → wrap des paragraphes différent →
          débordement du bloc Prestation Assemblage par-dessus la description. */}
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
