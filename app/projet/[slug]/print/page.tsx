import { getProjet } from '@/lib/airtable';
import { notFound } from 'next/navigation';
import { renderTemplate } from '@/lib/pdf/renderHtml';
import { SHARED_CSS } from '@/lib/pdf/templates/shared';
import PrintRunner from '@/components/PrintRunner';

/**
 * Page d'impression : rend le template PDF directement dans le navigateur,
 * paged.js paginé en mode handler, puis bouton "Imprimer / PDF" qui ouvre
 * la boîte de dialogue native (Save as PDF). Pas de serveur PDF.
 */
export default async function PrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const projet = await getProjet(slug);
  if (!projet) notFound();

  const bundle = renderTemplate(projet);

  // Le CSS @media print masque tous les wrappers AuthGate / barre d'outils,
  // pour que seul le contenu paginé apparaisse dans la sortie PDF.
  const PRINT_OVERRIDES = `
    body { background: #ECECEC; }
    /* Le bouton logout d'AuthGate est un button au top du body — masqué en mode impression */
    @media print {
      .print-toolbar,
      body > button { display: none !important; }
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
      <style id="print-template-css" dangerouslySetInnerHTML={{ __html: TEMPLATE_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: PRINT_OVERRIDES }} />
      <div id="print-source" dangerouslySetInnerHTML={{ __html: bundle.body }} />
      <PrintRunner targetSelector="#print-source" cssSelector="#print-template-css" />
    </>
  );
}
