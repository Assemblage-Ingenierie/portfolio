'use client';

import { useEffect, useRef, useState } from 'react';
import type { Projet } from '@/types/projet';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { color } from '@/lib/ui/tokens';

/**
 * Export WordPress GROUPÉ.
 *
 * Réutilise strictement la route unitaire `/api/projet/[slug]/publish` — aucune
 * logique de publication n'est dupliquée ici. Les fiches sont traitées
 * SÉQUENTIELLEMENT : chaque publication uploade N médias vers WordPress, un
 * fan-out parallèle saturerait l'API WP (et les quotas Airtable derrière).
 *
 * Les garde-fous SEO sont ceux de la fiche unitaire (cf. `WordpressView`) :
 * Tags export WP + méta description + photo de couverture. Ici ils ne bloquent
 * pas le lot — la fiche fautive est marquée « ignorée » et le lot continue.
 *
 * ⚠ Pages de pôle : une fiche multi-pôle (« Vignette pôle » = STR + ENV) est
 * ajoutée à CHAQUE galerie correspondante — c'est `pfgGalleriesForPoles`
 * (lib/wordpress/poleGallery.ts) qui itère côté serveur. Les libellés de pôle
 * affichés ici servent à vérifier la cible avant de lancer le lot.
 */

type ItemState = 'pending' | 'running' | 'done' | 'skipped' | 'error';

interface ItemResult {
  state: ItemState;
  message?: string;
  url?: string;
  /** Libellés des pages de pôle réellement mises à jour (retour serveur). */
  galleries?: string[];
}

const POLE_LABEL: Record<string, string> = {
  STR: 'Structure',
  ENV: 'Environnement',
  DEV: 'Développement',
};

/** Libellés des pages de pôle ciblées par une fiche, d'après sa Vignette pôle. */
export function poleLabelsOf(projet: Projet): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of projet.vignettePoles ?? []) {
    const code = String(raw).trim().toUpperCase();
    const label = POLE_LABEL[code];
    if (!label || seen.has(code)) continue;
    seen.add(code);
    out.push(label);
  }
  return out;
}

/**
 * Raisons pour lesquelles une fiche ne peut pas être exportée. Mêmes règles
 * que l'export unitaire, évaluées ici pour ne pas lancer un appel réseau voué
 * à un 422.
 */
export function exportBlockers(projet: Projet): string[] {
  const out: string[] = [];
  if (!projet.photoCouverture?.url) out.push('pas de photo de couverture');
  if (!projet.tagsExportWp || projet.tagsExportWp.length === 0) out.push('Tags export WP vides');
  if (!projet.metaDescription || !projet.metaDescription.trim()) out.push('méta description SEO vide');
  return out;
}

interface Props {
  projets: Projet[];
  onClose: () => void;
  /** Appelé après un lot terminé avec au moins une publication réussie. */
  onDone?: () => void;
}

export default function WpBulkExportModal({ projets, onClose, onDone }: Props) {
  const [results, setResults] = useState<Record<string, ItemResult>>(() =>
    Object.fromEntries(projets.map((p) => [p.slug, { state: 'pending' as ItemState }])),
  );
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  // Ref (et pas state) : la boucle d'export relit la valeur à chaque itération,
  // un state serait figé par la closure.
  const abortRef = useRef(false);

  const blockersBySlug: Record<string, string[]> = Object.fromEntries(
    projets.map((p) => [p.slug, exportBlockers(p)]),
  );
  const exportable = projets.filter((p) => blockersBySlug[p.slug].length === 0);

  // Empêche la fermeture accidentelle pendant un lot (chaque item est une
  // publication réelle et irréversible côté WordPress).
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [running]);

  function setItem(slug: string, next: ItemResult) {
    setResults((prev) => ({ ...prev, [slug]: next }));
  }

  async function runBatch() {
    const msg = [
      `Publier EN LIGNE ${exportable.length} fiche${exportable.length > 1 ? 's' : ''} sur assemblage.net ?`,
      '',
      'Chaque article sera visible immédiatement et ajouté à sa/ses page(s) de pôle.',
      "Il n'y a pas d'étape brouillon.",
    ].join('\n');
    if (!confirm(msg)) return;

    abortRef.current = false;
    setRunning(true);
    setFinished(false);

    // Les fiches bloquées sont marquées d'emblée : l'utilisateur voit
    // immédiatement ce que le lot ne traitera pas, et pourquoi.
    for (const p of projets) {
      const blockers = blockersBySlug[p.slug];
      if (blockers.length > 0) setItem(p.slug, { state: 'skipped', message: blockers.join(' · ') });
    }

    let anySuccess = false;
    for (const p of exportable) {
      if (abortRef.current) {
        setItem(p.slug, { state: 'skipped', message: 'lot interrompu' });
        continue;
      }
      setItem(p.slug, { state: 'running' });
      try {
        const res = await authedFetch(`/api/projet/${p.slug}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variant: 'v1' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue');
        anySuccess = true;
        // `added: false` sans `error` = tuile déjà présente (endpoint pôle
        // idempotent) : ce n'est pas un échec, on liste la galerie quand même.
        const galleries: string[] = Array.isArray(data.gallery)
          ? data.gallery
              .filter((g: { error?: string }) => !g.error)
              .map((g: { label: string }) => g.label)
          : [];
        setItem(p.slug, { state: 'done', url: data.url, message: data.warning, galleries });
      } catch (e) {
        setItem(p.slug, { state: 'error', message: e instanceof Error ? e.message : 'Erreur' });
      }
    }

    setRunning(false);
    setFinished(true);
    if (anySuccess) onDone?.();
  }

  const counts = projets.reduce(
    (acc, p) => {
      acc[results[p.slug]?.state ?? 'pending']++;
      return acc;
    },
    { pending: 0, running: 0, done: 0, skipped: 0, error: 0 } as Record<ItemState, number>,
  );

  const badge = (state: ItemState) => {
    const map: Record<ItemState, { bg: string; fg: string; txt: string }> = {
      pending: { bg: '#F0F0F0', fg: 'var(--ai-noir70)', txt: 'En attente' },
      running: { bg: 'var(--ai-violet)', fg: 'white', txt: 'Publication…' },
      done: { bg: '#1E8E3E', fg: 'white', txt: 'Publié' },
      skipped: { bg: '#FDE68A', fg: '#7A5B00', txt: 'Ignoré' },
      error: { bg: 'var(--ai-rouge)', fg: 'white', txt: 'Échec' },
    };
    const s = map[state];
    return (
      <span style={{
        fontSize: '7pt', fontWeight: 700, padding: '2px 6px', borderRadius: 6,
        background: s.bg, color: s.fg, whiteSpace: 'nowrap',
      }}>
        {s.txt}
      </span>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        fontFamily: 'var(--sans)',
      }}
      onClick={() => { if (!running) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, width: 'min(760px, 100%)',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <header style={{ padding: '14px 18px', borderBottom: `1px solid ${color.gris}` }}>
          <h2 style={{ fontSize: '13pt', fontWeight: 500, color: 'var(--ai-violet)' }}>
            Export WordPress groupé
          </h2>
          <p style={{ fontSize: '8.5pt', color: 'var(--ai-noir70)', marginTop: 4 }}>
            {projets.length} fiche{projets.length > 1 ? 's' : ''} sélectionnée{projets.length > 1 ? 's' : ''}
            {' · '}{exportable.length} exportable{exportable.length > 1 ? 's' : ''}
            {counts.done > 0 && ` · ${counts.done} publiée${counts.done > 1 ? 's' : ''}`}
            {counts.error > 0 && ` · ${counts.error} en échec`}
          </p>
        </header>

        <div style={{ overflowY: 'auto', padding: '8px 18px', flex: 1 }}>
          {projets.map((p) => {
            const r = results[p.slug] ?? { state: 'pending' as ItemState };
            const poles = poleLabelsOf(p);
            const blockers = blockersBySlug[p.slug];
            return (
              <div key={p.slug} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '8px 0', borderBottom: '1px solid #F0F0F0',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '9.5pt', color: 'var(--ai-noir)', fontWeight: 500 }}>{p.nom}</div>
                  <div style={{ fontSize: '8pt', color: 'var(--ai-noir70)', marginTop: 2 }}>
                    {poles.length > 0
                      ? <>Page{poles.length > 1 ? 's' : ''} de pôle : {poles.join(' + ')}</>
                      : <span style={{ color: 'var(--ai-rouge)' }}>Aucune page de pôle (« Vignette pôle » vide)</span>}
                  </div>
                  {r.state === 'pending' && blockers.length > 0 && (
                    <div style={{ fontSize: '8pt', color: '#7A5B00', marginTop: 2 }}>
                      Non exportable : {blockers.join(' · ')}
                    </div>
                  )}
                  {r.message && (
                    <div style={{ fontSize: '8pt', color: r.state === 'error' ? 'var(--ai-rouge)' : 'var(--ai-noir70)', marginTop: 2 }}>
                      {r.message}
                    </div>
                  )}
                  {r.state === 'done' && r.galleries && r.galleries.length > 0 && (
                    <div style={{ fontSize: '8pt', color: '#1E8E3E', marginTop: 2 }}>
                      Ajouté à : {r.galleries.join(' + ')}
                    </div>
                  )}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '8pt', color: 'var(--ai-violet)', marginTop: 2, display: 'inline-block' }}>
                      Voir l&apos;article →
                    </a>
                  )}
                </div>
                {badge(r.state)}
              </div>
            );
          })}
        </div>

        <footer style={{
          padding: '12px 18px', borderTop: `1px solid ${color.gris}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center',
        }}>
          {running && (
            <button
              onClick={() => { abortRef.current = true; }}
              style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${color.rouge}`, background: 'white', color: 'var(--ai-rouge)',
                fontSize: '9pt', fontWeight: 700, fontFamily: 'var(--sans)',
              }}
            >
              Interrompre après la fiche en cours
            </button>
          )}
          <button
            onClick={onClose}
            disabled={running}
            style={{
              padding: '8px 14px', borderRadius: 8, cursor: running ? 'default' : 'pointer',
              border: `1px solid ${color.gris}`, background: 'white', color: 'var(--ai-noir70)',
              fontSize: '9pt', fontWeight: 700, fontFamily: 'var(--sans)', opacity: running ? 0.5 : 1,
            }}
          >
            {finished ? 'Fermer' : 'Annuler'}
          </button>
          {!finished && (
            <button
              onClick={runBatch}
              disabled={running || exportable.length === 0}
              style={{
                padding: '8px 16px', borderRadius: 8,
                cursor: running || exportable.length === 0 ? 'default' : 'pointer',
                border: 'none', background: 'var(--ai-rouge)', color: 'white',
                fontSize: '9pt', fontWeight: 700, fontFamily: 'var(--sans)',
                opacity: running || exportable.length === 0 ? 0.5 : 1,
              }}
            >
              {running
                ? `Publication… (${counts.done + counts.error}/${exportable.length})`
                : `Publier ${exportable.length} fiche${exportable.length > 1 ? 's' : ''} en ligne`}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
