'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { color } from '@/lib/ui/tokens';

/**
 * Panneau Admin : applique le preset WordPress (`ASSEMBLAGE_WP_DEFAULTS`,
 * défini en dur dans `lib/wordpress/wpConfig.ts`) à toutes les fiches au statut
 * « Pas faite ». C'est l'équivalent en masse du bouton par-fiche de la sidebar
 * d'édition WordPress.
 *
 * Le preset est un partial : seules la typographie générale, les champs du
 * bandeau et les espacements sont écrasés. Les photos / catégories / prestation
 * de chaque fiche sont préservées.
 */

// Résumé affiché — purement informatif, doit rester aligné avec
// `ASSEMBLAGE_WP_DEFAULTS`.
const SUMMARY: string[] = [
  'Typographie générale — Description 16px · interlignage 1.5',
  'Champs du bandeau : 13 pt · libellés normaux noir · valeurs gras noir',
  'Mission AI : libellé rouge 13 pt · valeur noir 16 pt, gras, petites cap.',
  'Programme secondaire : noir, normal',
  'Espacements — titre↔accroche 0 · accroche↔photo 40 · photo↔description 50',
  'Photos / catégories / prestation de chaque fiche : PRÉSERVÉES',
];

type State =
  | { kind: 'idle' }
  | { kind: 'applying' }
  | { kind: 'done'; updated: number }
  | { kind: 'error'; message: string };

export default function WpDefaultsPanel() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function handleApply() {
    if (!confirm(
      'Appliquer les paramètres par défaut WordPress à TOUTES les fiches '
      + '« Pas faite » ?\n\nLa typographie générale, les champs du bandeau et les '
      + 'espacements de ces fiches seront écrasés par le preset Assemblage. '
      + 'Les photos / catégories / prestation sont conservées. Action irréversible.'
    )) return;

    setState({ kind: 'applying' });
    try {
      const res = await authedFetch('/api/admin/apply-wp-defaults', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur');
      setState({ kind: 'done', updated: data.updated ?? 0 });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Erreur' });
    }
  }

  return (
    <section style={{
      maxWidth: 720, margin: '24px auto 0', padding: '20px 24px',
      background: 'white', border: `1px solid ${color.gris}`, borderRadius: 12,
      fontFamily: 'var(--sans)',
    }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: '13pt', fontWeight: 500, color: 'var(--ai-violet)', margin: '0 0 6px' }}>
        Paramètres par défaut WordPress
      </h2>
      <p style={{ fontSize: '9pt', color: 'var(--ai-noir70)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Équivalent en masse du bouton « Appliquer les paramètres par défaut WordPress »
        des fiches. Ce bouton applique le preset à la config WordPress de toutes les
        fiches au statut <strong>« Pas faite »</strong>.
      </p>
      <ul style={{ fontSize: '8.5pt', color: 'var(--ai-noir70)', margin: '0 0 16px', paddingLeft: 18, lineHeight: 1.6 }}>
        {SUMMARY.map((s) => <li key={s}>{s}</li>)}
      </ul>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleApply}
          disabled={state.kind === 'applying'}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: state.kind === 'applying' ? '#999' : 'var(--ai-rouge)',
            color: 'white', fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700,
            cursor: state.kind === 'applying' ? 'not-allowed' : 'pointer',
          }}
        >
          {state.kind === 'applying' ? 'Application…' : 'Appliquer aux fiches « Pas faite »'}
        </button>
        {state.kind === 'done' && (
          <span style={{ fontSize: '9pt', color: '#2e7d32', fontWeight: 600 }}>
            ✓ {state.updated} fiche{state.updated > 1 ? 's' : ''} mise{state.updated > 1 ? 's' : ''} à jour
          </span>
        )}
        {state.kind === 'error' && (
          <span style={{ fontSize: '9pt', color: 'var(--ai-rouge)', fontWeight: 600 }}>✗ {state.message}</span>
        )}
      </div>
    </section>
  );
}
