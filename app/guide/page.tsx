'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { useViewMode } from '@/lib/auth/useViewMode';
import { renderMarkdown } from '@/lib/utils/markdown';
import RichTextEditor from '@/components/projet/RichTextEditor';
import { color } from '@/lib/ui/tokens';

/**
 * Guide d'utilisation du portfolio.
 *
 * - Vue **user** (et admin par défaut) : rendu en lecture seule du markdown.
 * - Vue **admin** : bouton « Modifier » → éditeur de texte enrichi
 *   (RichTextEditor) + sauvegarde vers Supabase via `/api/guide` (PUT).
 *
 * Le contenu provient de la table `portfolio_guide` (override admin) avec
 * fallback sur `DEFAULT_GUIDE_MARKDOWN` tant qu'aucune version n'a été
 * enregistrée. L'édition est volontairement « temporaire » : elle permet à un
 * admin d'ajuster le texte sans redéploiement.
 */
export default function GuidePage() {
  const { viewMode } = useViewMode();
  const isAdmin = viewMode === 'admin';

  const [markdown, setMarkdown] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch('/api/guide');
      if (!res.ok) throw new Error('Chargement impossible');
      const data = await res.json();
      setMarkdown(data.content ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    setDraft(markdown);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authedFetch('/api/guide', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Sauvegarde impossible');
      }
      setMarkdown(draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--sans)' }}>
      <header
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 16, marginBottom: 24, borderBottom: '2px solid var(--ai-rouge)', paddingBottom: 16,
        }}
      >
        <Link
          href="/"
          prefetch={false}
          style={{
            fontSize: '9pt', fontWeight: 700, color: 'var(--ai-violet)',
            textDecoration: 'none', letterSpacing: '0.03em',
          }}
        >
          ← Portfolio
        </Link>
        {isAdmin && !editing && !loading && (
          <button onClick={startEdit} style={primaryBtn}>
            ✎ Modifier le guide
          </button>
        )}
        {isAdmin && editing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancelEdit} disabled={saving} style={ghostBtn}>Annuler</button>
            <button onClick={save} disabled={saving} style={primaryBtn}>
              {saving ? 'Sauvegarde…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </header>

      {error && (
        <div style={{ background: color.rougeClair, color: color.rouge, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '9pt' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--ai-noir70)', fontSize: '10pt' }}>Chargement du guide…</p>
      ) : editing ? (
        <>
          <p style={{ fontSize: '8.5pt', color: 'var(--ai-noir70)', marginBottom: 10 }}>
            Édition réservée aux administrateurs. Les modifications sont visibles par tous une fois enregistrées.
          </p>
          <RichTextEditor value={draft} onChange={setDraft} minRows={24} />
        </>
      ) : (
        <article
          className="guide-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
        />
      )}

      <style jsx global>{`
        .guide-content {
          font-family: var(--sans);
          font-size: 11pt;
          line-height: 1.65;
          color: var(--ai-noir);
        }
        .guide-content h1 {
          font-size: 22pt;
          font-weight: 500;
          color: var(--ai-violet);
          margin: 0 0 16px;
        }
        .guide-content h2 {
          font-size: 15pt;
          font-weight: 700;
          color: var(--ai-noir);
          margin: 32px 0 12px;
          padding-bottom: 6px;
          border-bottom: 1px solid ${color.gris};
        }
        .guide-content h3 {
          font-size: 12pt;
          font-weight: 700;
          color: var(--ai-violet);
          margin: 20px 0 8px;
        }
        .guide-content p { margin: 0 0 12px; }
        .guide-content ul, .guide-content ol { margin: 0 0 12px 24px; }
        .guide-content li { margin-bottom: 6px; }
        .guide-content strong { font-weight: 700; }
        .guide-content a { color: var(--ai-rouge); }
        .guide-content hr {
          border: none;
          border-top: 1px solid ${color.gris};
          margin: 28px 0;
        }
        .guide-content blockquote {
          margin: 16px 0;
          padding: 10px 16px;
          background: ${color.grisTresClair};
          border-left: 3px solid var(--ai-rouge);
          color: var(--ai-noir70);
          font-size: 10.5pt;
        }
        .guide-content blockquote p:last-child { margin-bottom: 0; }
      `}</style>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--ai-rouge)', color: 'white',
  border: 'none', borderRadius: 8, fontFamily: 'var(--sans)', fontSize: '9pt',
  fontWeight: 700, letterSpacing: '0.03em', cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'white', color: 'var(--ai-noir70)',
  border: `1px solid ${color.gris}`, borderRadius: 8, fontFamily: 'var(--sans)',
  fontSize: '9pt', fontWeight: 700, letterSpacing: '0.03em', cursor: 'pointer',
};
