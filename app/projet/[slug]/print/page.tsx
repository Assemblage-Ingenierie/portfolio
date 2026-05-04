import { getProjet } from '@/lib/airtable';
import { notFound } from 'next/navigation';
import { renderTemplate } from '@/lib/pdf/renderHtml';
import { SHARED_CSS } from '@/lib/pdf/templates/shared';
import { isTemplateChoice } from '@/lib/pdf/selectTemplate';
import PrintRunner from '@/components/PrintRunner';

/**
 * Page d'impression : rend le template PDF directement dans le navigateur,
 * paged.js polyfill, puis bouton "Imprimer / PDF" qui ouvre la boîte de
 * dialogue native (Save as PDF). Pas de serveur PDF.
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
  searchParams: Promise<{ template?: string }>;
}) {
  const { slug } = await params;
  const { template: templateOverride } = await searchParams;
  const projet = await getProjet(slug);
  if (!projet) notFound();

  // Si l'utilisateur passe ?template=... et que la valeur est valide, on prend
  // celle-ci plutôt que celle d'Airtable (qui peut être périmée ou auto-sélectionnée).
  const effectiveProjet = isTemplateChoice(templateOverride)
    ? { ...projet, template: templateOverride }
    : projet;

  const bundle = renderTemplate(effectiveProjet);

  // Le CSS @media print masque tous les wrappers AuthGate / barre d'outils,
  // pour que seul le contenu paginé apparaisse dans la sortie PDF.
  // #print-source : largeur fixée à A4 pour que paged.js mesure correctement.
  // Il est ensuite masqué via JS (display:none) dans le callback `after` de paged.js,
  // une fois la pagination terminée. En @media print, masquage de ceinture-bretelles.
  const PRINT_OVERRIDES = `
    body { background: #ECECEC; margin: 0; }
    #print-source { width: 210mm; margin: 0 auto; }

    @media print {
      .print-toolbar,
      body > button,
      #print-source { display: none !important; }
      body { background: white; }
    }

    .pagedjs_pages { margin: 24px auto; }
    .pagedjs_page {
      box-shadow: 0 2px 16px rgba(0,0,0,0.15);
      margin: 0 auto 24px auto;
      background: white;
    }
  `;

  // Le CSS du template (sans les overrides d'écran) est isolé dans un <style>
  // dédié pour pouvoir être passé en string à paged.js. Les overrides d'écran
  // (toolbar, fond gris, ombre des pages…) restent dans un <style> séparé.
  const TEMPLATE_CSS = SHARED_CSS + bundle.css;

  return (
    <>
      {/* Template CSS — sera extrait et appliqué par paged.js Polisher (incl. @page) */}
      <style data-template-css="" dangerouslySetInnerHTML={{ __html: TEMPLATE_CSS }} />
      {/* Overrides écran — marqué comme à ignorer par paged.js mais reste actif pour la toolbar */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_OVERRIDES }} />
      <div id="print-source" dangerouslySetInnerHTML={{ __html: bundle.body }} />
      <PrintRunner targetSelector="#print-source" />
    </>
  );
}
