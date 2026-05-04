'use client';

import { useEffect, useState } from 'react';

/**
 * Charge paged.polyfill.js (mode auto) et déclenche window.print() après
 * pagination. Le PDF est généré en local par le navigateur via "Save as PDF".
 *
 * Pourquoi le polyfill plutôt que le handler explicite : le handler mode
 * (Previewer.preview() avec arguments) était trop fragile dans le contexte
 * Next.js + React (gestion des stylesheets et du nœud content). Le polyfill
 * est l'entrée publique éprouvée et accepte une config via window.PagedConfig.
 */
export default function PrintRunner({ targetSelector }: { targetSelector: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const source = document.querySelector(targetSelector) as HTMLElement | null;
        if (!source) throw new Error(`Cible "${targetSelector}" introuvable`);

        // Le polyfill prend tout le body comme contenu par défaut. On contraint
        // au noeud source uniquement (sinon il essaierait de paginer la toolbar).
        // PagedConfig DOIT être défini avant que le script polyfill ne se charge.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).PagedConfig = {
          auto: true,
          content: source,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          after: (_flow: any) => {
            if (cancelled) return;
            setStatus('ready');
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          error: (err: any) => {
            if (cancelled) return;
            setStatus('error');
            setErrorMsg(err?.message ?? String(err));
          },
        };

        // Marquer le <style> overrides écran avec [data-pagedjs-ignore]
        // pour qu'il ne soit pas absorbé par paged.js (et reste actif pour la toolbar).
        document.querySelectorAll('style:not([data-template-css])').forEach(s => {
          s.setAttribute('data-pagedjs-ignore', '');
        });

        await loadPagedPolyfill();
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
