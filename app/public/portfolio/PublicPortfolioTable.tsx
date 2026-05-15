'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Statut } from '@/types/projet';
import type { PublicProjet } from '@/app/api/public/portfolio/route';

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

const ALL_STATUTS: Statut[] = ['En étude', 'En chantier', 'Livré', 'Abandonné', 'En pause', 'En consultation'];
const POLE_ORDER = ['STR', 'ENV', 'DEV'];
const PAGE_SIZE = 25;

type SortKey = 'nom' | 'anneeLivraison' | 'statut' | 'programme';
type SortDir = 'asc' | 'desc';

export default function PublicPortfolioTable() {
  const [items, setItems] = useState<PublicProjet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedPoles, setSelectedPoles] = useState<Set<string>>(new Set());
  const [selectedProgrammes, setSelectedProgrammes] = useState<Set<string>>(new Set());
  const [selectedStatuts, setSelectedStatuts] = useState<Set<Statut>>(new Set());
  const [anneeMin, setAnneeMin] = useState<number | null>(null);
  const [anneeMax, setAnneeMax] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('anneeLivraison');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/portfolio')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.items)) setItems(data.items);
        else setError('Impossible de charger les références.');
      })
      .catch(() => { if (!cancelled) setError('Erreur réseau.'); });
    return () => { cancelled = true; };
  }, []);

  const years = useMemo(() => {
    const ys = (items ?? []).map((p) => p.anneeLivraison).filter((y): y is number => !!y);
    return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : { min: 0, max: 0 };
  }, [items]);

  const poles = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((p) => (p.vignettePoles ?? []).forEach((v) => set.add(v.toUpperCase())));
    return [...set].sort((a, b) => {
      const ia = POLE_ORDER.indexOf(a); const ib = POLE_ORDER.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [items]);

  const programmes = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((p) => {
      const list = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
      list.forEach((v) => { if (v) set.add(v); });
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.toLowerCase().trim();
    let list = items.filter((p) => {
      if (q) {
        const fs = [p.nom, p.moa, p.architecte, p.programme, p.lieu];
        if (!fs.some((v) => typeof v === 'string' && v.toLowerCase().includes(q))) return false;
      }
      if (selectedStatuts.size > 0 && !selectedStatuts.has(p.statut)) return false;
      if (selectedPoles.size > 0) {
        const pp = new Set((p.vignettePoles ?? []).map((v) => v.toUpperCase()));
        for (const code of selectedPoles) if (!pp.has(code)) return false;
      }
      if (selectedProgrammes.size > 0) {
        const list = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
        if (!list.some((v) => selectedProgrammes.has(v))) return false;
      }
      if (anneeMin !== null && p.anneeLivraison && p.anneeLivraison < anneeMin) return false;
      if (anneeMax !== null && p.anneeLivraison && p.anneeLivraison > anneeMax) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const va = a[sortKey]; const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'fr') * dir;
    });
    return list;
  }, [items, search, selectedStatuts, selectedPoles, selectedProgrammes, anneeMin, anneeMax, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [search, selectedStatuts, selectedPoles, selectedProgrammes, anneeMin, anneeMax]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSet = <T,>(value: T, setState: React.Dispatch<React.SetStateAction<Set<T>>>) => {
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'anneeLivraison' ? 'desc' : 'asc'); }
  }

  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 2, cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    border: active ? 'none' : '1px solid #DFE4E8',
    background: active ? 'var(--ai-rouge)' : 'white',
    color: active ? 'white' : 'var(--ai-noir70)',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--sans)' }}>
        <header style={{ marginBottom: 20, borderBottom: '2px solid var(--ai-rouge)', paddingBottom: 16 }}>
          <h1 style={{ fontFamily: 'var(--sans)', fontSize: '18pt', fontWeight: 500, color: 'var(--ai-violet)', margin: 0 }}>
            Références — Assemblage ingénierie
          </h1>
          <p style={{ fontSize: '9pt', color: 'var(--ai-noir70)', marginTop: 6 }}>
            {items === null ? 'Chargement…' : `${filtered.length} référence${filtered.length > 1 ? 's' : ''} affichée${filtered.length > 1 ? 's' : ''}`}
          </p>
        </header>

        <input
          type="search"
          placeholder="Rechercher (nom, MOA, architecte, programme, lieu)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', fontFamily: 'var(--sans)', fontSize: '9pt',
            border: '1px solid #DFE4E8', borderRadius: 2, outline: 'none', background: 'white', marginBottom: 16,
          }}
        />

        <div style={{ background: 'white', border: '1px solid #DFE4E8', borderRadius: 2, padding: '14px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          {poles.length > 0 && (
            <div>
              <div style={chipLabel}>Pôle</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => setSelectedPoles(new Set())} style={chipBtn(selectedPoles.size === 0)}>Tous</button>
                {poles.map((c) => (
                  <button key={c} onClick={() => toggleSet(c, setSelectedPoles)} style={chipBtn(selectedPoles.has(c))}>{c}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={chipLabel}>Statut</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ALL_STATUTS.map((s) => (
                <button key={s} onClick={() => toggleSet(s, setSelectedStatuts)} style={{
                  ...chipBtn(selectedStatuts.has(s)),
                  background: selectedStatuts.has(s) ? STATUT_BG[s] : 'white',
                  color: selectedStatuts.has(s) ? STATUT_COLOR[s] : 'var(--ai-noir70)',
                  border: selectedStatuts.has(s) ? `1px solid ${STATUT_COLOR[s]}` : '1px solid #DFE4E8',
                }}>{s}</button>
              ))}
            </div>
          </div>

          {years.min < years.max && (
            <div>
              <div style={chipLabel}>Année</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '9pt' }}>
                <input type="number" placeholder={String(years.min)} value={anneeMin ?? ''}
                  onChange={(e) => setAnneeMin(e.target.value ? Number(e.target.value) : null)}
                  style={yearInput} />
                <span style={{ color: 'var(--ai-noir70)' }}>–</span>
                <input type="number" placeholder={String(years.max)} value={anneeMax ?? ''}
                  onChange={(e) => setAnneeMax(e.target.value ? Number(e.target.value) : null)}
                  style={yearInput} />
              </div>
            </div>
          )}

          {programmes.length > 0 && (
            <div style={{ flex: '1 1 100%' }}>
              <div style={chipLabel}>Programme</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => setSelectedProgrammes(new Set())} style={chipBtn(selectedProgrammes.size === 0)}>Tous</button>
                {programmes.map((p) => (
                  <button key={p} onClick={() => toggleSet(p, setSelectedProgrammes)} style={chipBtn(selectedProgrammes.has(p))}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: 16, background: '#F9E1E3', color: '#E30513', borderRadius: 2, marginBottom: 16 }}>{error}</div>
        )}

        <div style={{ background: 'white', borderRadius: 2, border: '1px solid #000', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: '9pt' }}>
            <thead>
              <tr style={{ background: '#F5F5F5', borderBottom: '1px solid #000' }}>
                <Th onClick={() => toggleSort('nom')} active={sortKey === 'nom'} dir={sortDir}>Projet</Th>
                <Th>MOA</Th>
                <Th onClick={() => toggleSort('programme')} active={sortKey === 'programme'} dir={sortDir}>Programme</Th>
                <Th>Pôles</Th>
                <Th>Lieu</Th>
                <Th onClick={() => toggleSort('anneeLivraison')} active={sortKey === 'anneeLivraison'} dir={sortDir}>Année</Th>
                <Th onClick={() => toggleSort('statut')} active={sortKey === 'statut'} dir={sortDir}>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p, i) => (
                <tr key={p.slug} style={{ borderBottom: i < paged.length - 1 ? '1px solid #DFE4E8' : 'none' }}>
                  <td style={tdNom}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {p.photoCouverture
                        ? <div style={{ width: 48, height: 36, backgroundImage: `url(${p.photoCouverture.url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 1, flexShrink: 0 }} />
                        : <div style={{ width: 48, height: 36, background: 'var(--ai-gris, #DFE4E8)', borderRadius: 1, flexShrink: 0 }} />}
                      <span style={{ fontFamily: 'var(--serif)', fontSize: '10pt', color: 'var(--ai-noir, #30323E)' }}>{p.nom}</span>
                    </div>
                  </td>
                  <td style={td}>{p.moa ?? '—'}</td>
                  <td style={td}>{p.programmePrincipal ?? p.programme ?? '—'}</td>
                  <td style={td}>{(p.vignettePoles ?? []).join(' · ') || '—'}</td>
                  <td style={td}>{p.lieu ?? '—'}</td>
                  <td style={{ ...td, color: 'var(--ai-rouge, #E30513)', fontWeight: 600 }}>{p.anneeLivraison ?? '—'}</td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 2, fontSize: '7.5pt', fontWeight: 700,
                      background: STATUT_BG[p.statut] ?? '#eee', color: STATUT_COLOR[p.statut] ?? '#333',
                    }}>{p.statut}</span>
                  </td>
                </tr>
              ))}
              {items !== null && paged.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--ai-noir70)' }}>Aucune référence ne correspond aux filtres.</td></tr>
              )}
              {items === null && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--ai-noir70)' }}>Chargement…</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, fontSize: '9pt' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(page === 1)}>← Précédent</button>
            <span style={{ color: 'var(--ai-noir70)' }}>Page {page} / {pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} style={pageBtn(page === pageCount)}>Suivant →</button>
          </div>
        )}
      </div>
    </div>
  );
}

const chipLabel: React.CSSProperties = {
  fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--ai-noir70)', marginBottom: 6,
};

const td: React.CSSProperties = {
  padding: '10px 12px', verticalAlign: 'middle', color: 'var(--ai-noir, #30323E)',
};

const tdNom: React.CSSProperties = { ...td, minWidth: 240 };

const yearInput: React.CSSProperties = {
  width: 70, padding: '4px 6px', border: '1px solid #DFE4E8', borderRadius: 2,
  fontFamily: 'var(--sans)', fontSize: '9pt',
};

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', border: '1px solid #DFE4E8', borderRadius: 2,
    background: 'white', cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#CCC' : 'var(--ai-noir70)',
    fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 600,
  };
}

interface ThProps {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
}
function Th({ children, onClick, active, dir }: ThProps) {
  return (
    <th onClick={onClick} style={{
      padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: '8.5pt',
      color: 'var(--ai-noir, #30323E)', cursor: onClick ? 'pointer' : 'default',
      userSelect: 'none', whiteSpace: 'nowrap',
    }}>
      {children}
      {active && <span style={{ marginLeft: 4, color: 'var(--ai-rouge, #E30513)' }}>{dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}
