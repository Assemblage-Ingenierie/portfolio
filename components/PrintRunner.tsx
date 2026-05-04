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
  cssSelector,
}: {
  targetSelector: string;
  cssSelector: string;
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

        // Récupérer l'HTML en string et masquer la source.
        // Passer une string à paged.js évite les conflits avec la gestion DOM de React
        // (paged.js essaie sinon de déplacer le nœud, ce qui casse l'arbre React).
        const html = source.innerHTML;
        source.style.display = 'none';

        // Récupérer le CSS du template (paged.js handler mode ne lit pas
        // automatiquement les <style> tags du document — il faut les passer
        // explicitement au Polisher via l'argument stylesheets).
        const styleEl = document.querySelector(cssSelector) as HTMLStyleElement | null;
        const cssText = styleEl?.textContent ?? '';

        // Conteneur de rendu dédié pour les pages paged.js
        const renderTarget = document.createElement('div');
        renderTarget.id = 'pagedjs-target';
        document.body.appendChild(renderTarget);

        const previewer = new Paged.Previewer();
        // Format attendu par paged.js Polisher : { type: 'text/css', text: cssString }
        await previewer.preview(html, [{ type: 'text/css', text: cssText }], renderTarget);

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
  }, [targetSelector, cssSelector]);

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
