'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Projet, Statut, TemplateChoice } from '@/types/projet';
import { TEMPLATE_OPTIONS } from '@/types/projet';
import { autoSelectTemplate } from '@/lib/pdf/selectTemplate';

const STATUT_BG: Record<string, string> = {
  'En étude': '#DFE4E8',
  'En chantier': '#F9E1E3',
  'Livré': '#d4edda',
  'Abandonné': '#e2e3e5',
  'En pause': '#fff3cd',
  'En consultation': '#d1ecf1',
};
const STATUT_COLOR: Record<string, string> = {
  'En étude': '#30323E',
  'En chantier': '#E30513',
  'Livré': '#155724',
  'Abandonné': '#6c757d',
  'En pause': '#856404',
  'En consultation': '#0c5460',
};

interface Props { projets: Projet[]; }

export default function PortfolioBuilder({ projets }: Props) {
  // ----- État de sélection -----
  // Map slug → template choisi pour cette fiche
  const [selection, setSelection] = useState<Map<string, TemplateChoice>>(new Map());

  // ----- Filtres (mêmes que la grille principale) -----
  const years = useMemo(() => {
    const ys = projets.map(p => p.anneeLivraison).filter((y): y is number => !!y);
    return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : { min: 0, max: 0 };
  }, [projets]);
  const poles = useMemo(() =>
    [...new Set(projets.map(p => p.pole).filter(Boolean))].sort() as string[],
    [projets]
  );
  const allStatuts: Statut[] = ['En étude', 'En chantier', 'Livré', 'Abandonné', 'En pause', 'En consultation'];

  const [search, setSearch] = useState('');
  const [rehabNeuf, setRehabNeuf] = useState<'Tous' | 'Neuf' | 'Réhab'>('Tous');
  const [selectedStatuts, setSelectedStatuts] = useState<Set<Statut>>(new Set());
  const [selectedPole, setSelectedPole] = useState<string | null>(null);
  const [yearMin, setYearMin] = useState(years.min);
  const [yearMax, setYearMax] = useState(years.max);

  const toggleStatut = (s: Statut) => {
    setSelectedStatuts(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projets.filter(p => {
      if (q) {
        const fields = [p.nom, p.affaire, p.adresse, p.moa, p.architecte, p.pole, p.programme, p.description];
        // Filtre par type — un champ Airtable non-string ferait crasher `.toLowerCase()`.
        if (!fields.some(v => typeof v === 'string' && v.toLowerCase().includes(q))) return false;
      }
      if (rehabNeuf !== 'Tous') {
        if (!p.rehabNeuf) return false;
        const rn = p.rehabNeuf.toLowerCase();
        if (rehabNeuf === 'Neuf' && !rn.includes('neuf')) return false;
        if (rehabNeuf === 'Réhab' && !rn.includes('réhab') && !rn.includes('rehab')) return false;
      }
      if (selectedStatuts.size > 0 && !selectedStatuts.has(p.statut)) return false;
      if (selectedPole && p.pole !== selectedPole) return false;
      if (p.anneeLivraison && (p.anneeLivraison < yearMin || p.anneeLivraison > yearMax)) return false;
      return true;
    });
  }, [projets, search, rehabNeuf, selectedStatuts, selectedPole, yearMin, yearMax]);

  // ----- Sélection -----
  function toggleSelect(p: Projet) {
    setSelection(prev => {
      const next = new Map(prev);
      if (next.has(p.slug)) {
        next.delete(p.slug);
      } else {
        // Template par défaut : valeur Airtable si valide, sinon auto-sélection
        next.set(p.slug, p.template ?? autoSelectTemplate(p));
      }
      return next;
    });
  }

  function setItemTemplate(slug: string, t: TemplateChoice) {
    setSelection(prev => {
      const next = new Map(prev);
      if (next.has(slug)) next.set(slug, t);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelection(prev => {
      const next = new Map(prev);
      filtered.forEach(p => {
        if (!next.has(p.slug)) next.set(p.slug, p.template ?? autoSelectTemplate(p));
      });
      return next;
    });
  }

  function clearSelection() { setSelection(new Map()); }

  // ----- Export -----
  function handleExport() {
    if (selection.size === 0) return;
    // Ordre : on respecte l'ordre des projets filtrés/affichés (plutôt que l'ordre d'ajout
    // qui dépendrait des clics, ce qui serait moins intuitif pour le sommaire).
    const ordered = filtered
      .filter(p => selection.has(p.slug))
      .map(p => `${p.slug}:${selection.get(p.slug)}`);
    const url = `/portfolio/print?items=${encodeURIComponent(ordered.join(','))}`;
    window.open(url, '_blank');
  }

  // ----- Styles -----
  const btn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: '2px', cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    border: active ? 'none' : '1px solid #DFE4E8',
    background: active ? 'var(--ai-rouge)' : 'white',
    color: active ? 'white' : 'var(--ai-noir70)',
  });

  return (
    <div style={{ paddingBottom: '120px' /* place pour la barre d'export sticky */ }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--sans)' }}>

        {/* Header */}
        <header style={{ marginBottom: '20px', borderBottom: '2px solid var(--ai-rouge)', paddingBottom: '16px' }}>
          <Link href="/" style={{ fontSize: '9pt', color: 'var(--ai-noir70)', textDecoration: 'none', fontWeight: 600 }}>
            ← Retour au portfolio
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <h1 style={{ fontFamily: 'var(--sans)', fontSize: '16pt', fontWeight: 500, color: 'var(--ai-violet)' }}>
              Constituer le portfolio
            </h1>
            <span style={{ fontSize: '9pt', color: 'var(--ai-noir70)', fontWeight: 600 }}>
              {filtered.length} / {projets.length} affichés
            </span>
          </div>
          <p style={{ fontSize: '9pt', color: 'var(--ai-noir70)', marginTop: 4 }}>
            Filtre les références, sélectionne celles à inclure et choisis leur template d&apos;impression.
          </p>
        </header>

        {/* Recherche */}
        <input
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', fontFamily: 'var(--sans)', fontSize: '9pt',
            border: '1px solid #DFE4E8', borderRadius: '2px', outline: 'none', background: 'white',
            marginBottom: 16,
          }}
        />

        {/* Filtres */}
        <div style={{ background: 'white', border: '1px solid #DFE4E8', borderRadius: '2px', padding: '14px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>Pôle</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedPole(null)} style={btn(selectedPole === null)}>Tous</button>
              {poles.map(p => (
                <button key={p} onClick={() => setSelectedPole(selectedPole === p ? null : p)} style={btn(selectedPole === p)}>{p}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>Type</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['Tous', 'Neuf', 'Réhab'] as const).map(v => (
                <button key={v} onClick={() => setRehabNeuf(v)} style={btn(rehabNeuf === v)}>{v}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>Statut</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {allStatuts.map(s => (
                <button key={s} onClick={() => toggleStatut(s)} style={{
                  ...btn(selectedStatuts.has(s)),
                  background: selectedStatuts.has(s) ? STATUT_BG[s] : 'white',
                  color: selectedStatuts.has(s) ? STATUT_COLOR[s] : 'var(--ai-noir70)',
                  border: selectedStatuts.has(s) ? `1px solid ${STATUT_COLOR[s]}` : '1px solid #DFE4E8',
                }}>{s}</button>
              ))}
            </div>
          </div>

          {years.min < years.max && (
            <div>
              <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>Année</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '9pt' }}>
                <input type="number" value={yearMin} onChange={e => setYearMin(Math.min(Number(e.target.value), yearMax))} style={{ width: 60, padding: '4px 6px', border: '1px solid #DFE4E8', borderRadius: 2 }} />
                <span style={{ color: 'var(--ai-noir70)' }}>–</span>
                <input type="number" value={yearMax} onChange={e => setYearMax(Math.max(Number(e.target.value), yearMin))} style={{ width: 60, padding: '4px 6px', border: '1px solid #DFE4E8', borderRadius: 2 }} />
              </div>
            </div>
          )}
        </div>

        {/* Actions sélection groupée */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', fontSize: '9pt', color: 'var(--ai-noir70)' }}>
          <button onClick={selectAllFiltered} style={btn(false)}>Tout sélectionner ({filtered.length})</button>
          <button onClick={clearSelection} style={btn(false)}>Tout désélectionner</button>
          <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
            {selection.size} sélectionnée{selection.size > 1 ? 's' : ''}
          </span>
        </div>

        {/* Liste */}
        <div style={{ background: 'white', borderRadius: '2px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {filtered.map((projet, i) => {
            const isSelected = selection.has(projet.slug);
            const currentTemplate = selection.get(projet.slug);
            return (
              <div key={projet.slug} style={{
                display: 'grid',
                gridTemplateColumns: '32px 56px 1fr 100px 80px 130px',
                gap: 12, alignItems: 'center', padding: '10px 16px',
                borderBottom: i < filtered.length - 1 ? '1px solid #DFE4E8' : 'none',
                background: isSelected ? '#FFF5F5' : 'white',
              }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(projet)}
                  style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#E30513' }}
                />
                {projet.photoCouverture
                  ? <div style={{ width: 56, height: 40, backgroundImage: `url(${projet.photoCouverture.url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 1 }} />
                  : <div style={{ width: 56, height: 40, background: 'var(--ai-gris)', borderRadius: 1 }} />
                }
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '10.5pt', fontWeight: 500, color: 'var(--ai-noir)', lineHeight: 1.2 }}>{projet.nom}</div>
                  {projet.moa && <div style={{ fontSize: '8pt', color: 'var(--ai-noir70)', marginTop: 2 }}>{projet.moa} · {projet.affaire}</div>}
                </div>
                <div style={{ fontSize: '7.5pt', color: 'var(--ai-noir70)' }}>{projet.programme ?? '—'}</div>
                <div style={{ fontSize: '8pt', color: 'var(--ai-rouge)', fontWeight: 600 }}>{projet.anneeLivraison ?? '—'}</div>
                <select
                  value={currentTemplate ?? ''}
                  onChange={e => setItemTemplate(projet.slug, e.target.value as TemplateChoice)}
                  disabled={!isSelected}
                  style={{
                    padding: '4px 6px', fontSize: '8pt', fontFamily: 'var(--sans)',
                    border: '1px solid #DFE4E8', borderRadius: 2,
                    background: isSelected ? 'white' : '#F2F2F2',
                    color: isSelected ? 'var(--ai-noir)' : 'var(--ai-noir70)',
                    cursor: isSelected ? 'pointer' : 'not-allowed',
                  }}
                >
                  {!isSelected && <option value="">—</option>}
                  {TEMPLATE_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--ai-noir70)', fontSize: '10pt' }}>
            Aucun projet ne correspond aux filtres.
          </div>
        )}
      </div>

      {/* Barre d'export sticky */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--ai-violet)', color: 'white',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
        zIndex: 100,
      }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: '10pt' }}>
          <strong style={{ fontSize: '14pt', color: 'var(--ai-rouge)' }}>{selection.size}</strong> référence{selection.size > 1 ? 's' : ''} sélectionnée{selection.size > 1 ? 's' : ''}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleExport}
          disabled={selection.size === 0}
          style={{
            padding: '10px 20px',
            background: selection.size === 0 ? '#666' : 'var(--ai-rouge)',
            color: 'white', border: 'none', borderRadius: 2,
            fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 700,
            cursor: selection.size === 0 ? 'not-allowed' : 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          Exporter le portfolio →
        </button>
      </div>
    </div>
  );
}
