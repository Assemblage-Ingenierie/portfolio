'use client';

import { useEffect, useState } from 'react';

/**
 * Charge paged.polyfill.js (mode auto), pagine le contenu, puis l'utilisateur
 * clique "Imprimer / PDF" pour ouvrir le dialogue d'impression du navigateur.
 *
 * Le bouton est toujours visible (pas attente du callback paged.js qui peut
 * être capricieux) — un statut indique quand la pagination est terminée.
 */
export default function PrintRunner({ targetSelector }: { targetSelector: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function run() {
      try {
        const source = document.querySelector(targetSelector) as HTMLElement | null;
        if (!source) throw new Error(`Cible "${targetSelector}" introuvable`);

        // Marquer le <style> overrides écran [data-pagedjs-ignore] pour qu'il
        // ne soit pas absorbé par paged.js (et reste actif pour la toolbar).
        document.querySelectorAll('style:not([data-template-css])').forEach(s => {
          s.setAttribute('data-pagedjs-ignore', '');
        });

        // Config paged.js : doit être posée AVANT le chargement du script.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).PagedConfig = {
          auto: true,
          content: source,
          after: () => {
            // Une fois la pagination terminée, on masque la div source.
            // Sinon elle reste visible à côté des .pagedjs_pages (et apparaît
            // dans le print preview du navigateur en plus du contenu paginé).
            source.style.display = 'none';
            setStatus('ready');
          },
        };

        await loadPagedPolyfill();
      } catch (e) {
        setStatus('error');
        setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue');
      }
    }

    run();
  }, [targetSelector]);

  const tag: React.CSSProperties = { padding: '6px 10px', fontSize: 12, borderRadius: 2, fontWeight: 600 };

  return (
    <div className="print-toolbar" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 9999, fontFamily: 'sans-serif', alignItems: 'center' }}>
      {status === 'loading' && <span style={{ ...tag, background: '#30323E', color: 'white' }}>Mise en page…</span>}
      {status === 'ready' && <span style={{ ...tag, background: '#90EE90', color: '#1a4d1a' }}>✓ Prêt</span>}
      {status === 'error' && <span style={{ ...tag, background: '#E30513', color: 'white' }}>Erreur : {errorMsg}</span>}

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
    </div>
  );
}

let pagedPromise: Promise<void> | null = null;

function loadPagedPolyfill(): Promise<void> {
  if (pagedPromise) return pagedPromise;

  pagedPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/pagedjs@0.5.0-beta.2/dist/paged.polyfill.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Échec du chargement de paged.polyfill.js'));
    document.head.appendChild(script);
  });

  return pagedPromise;
}
