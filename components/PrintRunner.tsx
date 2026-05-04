'use client';

import { useEffect, useState } from 'react';

/**
 * Charge paged.js depuis CDN, lance Previewer.preview() en mode handler,
 * puis ouvre la boîte de dialogue d'impression du navigateur.
 *
 * Le résultat (PDF) est généré en local par Chromium côté utilisateur,
 * via la commande "Enregistrer au format PDF" du dialogue d'impression.
 * Pas de serveur, pas de Puppeteer, pas de limite Vercel.
 */
export default function PrintRunner({
  targetSelector,
}: {
  targetSelector: string;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await loadPagedJs();
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Paged = (window as any).Paged;
        if (!Paged?.Previewer) throw new Error('paged.js non chargé');

        const source = document.querySelector(targetSelector) as HTMLElement | null;
        if (!source) throw new Error(`Cible "${targetSelector}" introuvable`);

        // Récupérer le HTML du contenu et le retirer du DOM React (innerHTML, pas outerHTML).
        // On passe une string à paged.js plutôt que le nœud React directement, sinon
        // paged.js fait `parentNode.removeChild(node)` ce qui casse l'arbre React.
        const html = source.innerHTML;
        source.remove();

        // Conteneur de rendu dédié pour les pages paginées
        const renderTarget = document.createElement('div');
        renderTarget.id = 'pagedjs-target';
        document.body.appendChild(renderTarget);

        // Marquer le <style> overrides écran avec [data-pagedjs-ignore] pour
        // qu'il ne soit pas absorbé par paged.js (et reste actif pour la toolbar).
        const overrides = document.querySelectorAll('style:not([data-template-css])');
        overrides.forEach(s => s.setAttribute('data-pagedjs-ignore', ''));

        const previewer = new Paged.Previewer();
        // En passant `undefined` pour stylesheets, paged.js extrait automatiquement
        // les <style> du document (sauf [data-pagedjs-ignore]). Notre template-css
        // sera donc pris en compte, y compris les règles @page.
        await previewer.preview(html, undefined, renderTarget);

        if (cancelled) return;
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue');
      }
    }

    run();
    return () => { cancelled = true; };
  }, [targetSelector]);

  if (status === 'error') {
    return (
      <div style={{ position: 'fixed', top: 16, left: 16, padding: '8px 14px', background: '#E30513', color: 'white', fontFamily: 'sans-serif', fontSize: 13, borderRadius: 2, zIndex: 9999 }}>
        Erreur paged.js : {errorMsg}
      </div>
    );
  }

  return (
    <div className="print-toolbar" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 9999, fontFamily: 'sans-serif' }}>
      {status === 'loading' && (
        <span style={{ padding: '8px 14px', background: '#30323E', color: 'white', fontSize: 13, borderRadius: 2 }}>
          Mise en page…
        </span>
      )}
      {status === 'ready' && (
        <>
          <button
            onClick={() => window.print()}
            style={{ padding: '8px 14px', background: '#E30513', color: 'white', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Imprimer / Enregistrer en PDF
          </button>
          <button
            onClick={() => window.close()}
            style={{ padding: '8px 14px', background: 'white', color: '#30323E', border: '1px solid #DFE4E8', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Fermer
          </button>
        </>
      )}
    </div>
  );
}

let pagedJsPromise: Promise<void> | null = null;

function loadPagedJs(): Promise<void> {
  if (pagedJsPromise) return pagedJsPromise;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).Paged?.Previewer) return Promise.resolve();

  pagedJsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/pagedjs@0.5.0-beta.2/dist/paged.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Échec du chargement de paged.js'));
    document.head.appendChild(script);
  });

  return pagedJsPromise;
}
