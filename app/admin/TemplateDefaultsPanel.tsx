'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { color } from '@/lib/ui/tokens';

/**
 * Panneau Admin : applique les préréglages Assemblage (définis en dur dans
 * `lib/pdf/assemblageDefaults.ts`) à toutes les fiches au statut « Pas faite ».
 *
 * Les valeurs par défaut elles-mêmes ne sont PAS éditables ici (choix produit :
 * elles vivent dans le code). Pour les modifier, éditer `assemblageDefaults.ts`
 * puis re-cliquer sur le bouton pour propager.
 */

// Résumé affiché des préréglages — purement informatif, doit rester aligné
// avec `ASSEMBLAGE_DEFAULT_BANDEAU` / `ASSEMBLAGE_DEFAULT_MANUAL`.
const SUMMARY: string[] = [
  'Police Open Sans pour tous les champs',
  'Titre 15 · Statut 10 · Libellés 10 · Valeurs 10',
  'Sous-titre Programme 9 · Description 9 · Prestation Assemblage 9',
  'Mission AI : 12, gras, small-caps',
  'Cellules du bandeau : adaptées au contenu',
  'Cellule Programme : Programme secondaire visible',
  'Lignes horizontales : masquées',
  'Espacements — titre↔bandeau 30 · photo↔description 45 · photo↔bandeau 30',
  'Photo principale : paysage, taille 50 %',
  'Texte : 2 colonnes (50 % / 50 %)',
  'Photos additionnelles : désactivées',
  'Mots-clés : liste activée · Certifications : activées',
];

type State =
  | { kind: 'idle' }
  | { kind: 'applying' }
  | { kind: 'done'; updated: number }
  | { kind: 'error'; message: string };

export default function TemplateDefaultsPanel() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function handleApply() {
    if (!confirm(
      'Appliquer les paramètres par défaut du template à TOUTES les fiches '
      + '« Pas faite » ?\n\nLa mise en page (bandeau + Str-Env/Dev) de ces fiches '
      + 'sera écrasée par les préréglages Assemblage. Action irréversible.'
    )) return;

    setState({ kind: 'applying' });
    try {
      const res = await authedFetch('/api/admin/apply-defaults', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur');
      setState({ kind: 'done', updated: data.updated ?? 0 });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Erreur' });
    }
  }

  return (
    <section style={{
      maxWidth: 720, margin: '32px auto 0', padding: '20px 24px',
      background: 'white', border: `1px solid ${color.gris}`, borderRadius: 12,
      fontFamily: 'var(--sans)',
    }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: '13pt', fontWeight: 500, color: 'var(--ai-violet)', margin: '0 0 6px' }}>
        Paramètres par défaut du template
      </h2>
      <p style={{ fontSize: '9pt', color: 'var(--ai-noir70)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Préréglages appliqués par le bouton « Réinitialiser » des fiches. Ce bouton
        les écrit dans le champ Airtable « Config template manuel » de toutes les
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
