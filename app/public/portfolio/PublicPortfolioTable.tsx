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

// Mode de colonnes. Pilote par la présence (ou non) de DEV dans le filtre Pôle.
type ColMode = 'std' | 'dev';

type SortKey = 'nom' | 'anneeLivraison' | 'statut';
type SortDir = 'asc' | 'desc';

type View = 'browse' | 'recap';

export default function PublicPortfolioTable() {
  const [items, setItems] = useState<PublicProjet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>('browse');
  // Map slug → mode au moment de la sélection. Permet d'afficher deux tableaux
  // côte à côte dans la vue récap si l'utilisateur a sélectionné des refs dans
  // les deux modes (DEV activé / DEV non activé).
  const [selection, setSelection] = useState<Map<string, ColMode>>(new Map());

  const [search, setSearch] = useState('');
  const [selectedPoles, setSelectedPoles] = useState<Set<string>>(new Set());
  const [selectedProgrammes, setSelectedProgrammes] = useState<Set<string>>(new Set());
  const [selectedStatuts, setSelectedStatuts] = useState<Set<Statut>>(new Set());
  const [anneeMin, setAnneeMin] = useState<number | null>(null);
  const [anneeMax, setAnneeMax] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('anneeLivraison');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  // Mode courant : si DEV est dans les pôles sélectionnés → 'dev', sinon 'std'.
  const currentMode: ColMode = selectedPoles.has('DEV') ? 'dev' : 'std';

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
        const fs = [p.nom, p.moa, p.architecte, p.programme, p.lieu, p.betAssocies, p.bailleur];
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

  function toggleSelectRef(slug: string) {
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(slug)) next.delete(slug);
      else next.set(slug, currentMode);
      return next;
    });
  }
  function clearSelection() { setSelection(new Map()); }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'anneeLivraison' ? 'desc' : 'asc'); }
  }

  // Récap : split la sélection par mode pour rendre deux tableaux si nécessaire.
  const recapStd = useMemo(
    () => (items ?? []).filter((p) => selection.get(p.slug) === 'std'),
    [items, selection]
  );
  const recapDev = useMemo(
    () => (items ?? []).filter((p) => selection.get(p.slug) === 'dev'),
    [items, selection]
  );

  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 2, cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    border: active ? 'none' : '1px solid #DFE4E8',
    background: active ? 'var(--ai-rouge)' : 'white',
    color: active ? 'white' : 'var(--ai-noir70)',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', paddingBottom: 100 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--sans)' }}>
        <header style={{ marginBottom: 20, borderBottom: '2px solid var(--ai-rouge)', paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--sans)', fontSize: '18pt', fontWeight: 500, color: 'var(--ai-violet)', margin: 0 }}>
              Références — Assemblage ingénierie
            </h1>
            <p style={{ fontSize: '9pt', color: 'var(--ai-noir70)', marginTop: 6 }}>
              {view === 'recap'
                ? `${selection.size} référence${selection.size > 1 ? 's' : ''} sélectionnée${selection.size > 1 ? 's' : ''}`
                : items === null ? 'Chargement…' : `${filtered.length} référence${filtered.length > 1 ? 's' : ''} · mode colonnes : ${currentMode === 'dev' ? 'DEV' : 'Standard'}`}
            </p>
          </div>
          {view === 'recap' && (
            <button onClick={() => setView('browse')} style={ghostBtn}>← Retour au tableau</button>
          )}
        </header>

        {view === 'browse' && (
          <>
            <input
              type="search"
              placeholder="Rechercher (nom, MOA, architecte, BET, programme, lieu)…"
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

            <ProjetTable
              mode={currentMode}
              rows={paged}
              selectable
              selection={selection}
              onToggleSelect={toggleSelectRef}
              loading={items === null}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />

            {pageCount > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, fontSize: '9pt' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(page === 1)}>← Précédent</button>
                <span style={{ color: 'var(--ai-noir70)' }}>Page {page} / {pageCount}</span>
                <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} style={pageBtn(page === pageCount)}>Suivant →</button>
              </div>
            )}
          </>
        )}

        {view === 'recap' && (
          <>
            {recapStd.length === 0 && recapDev.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ai-noir70)', background: 'white', border: '1px solid #DFE4E8', borderRadius: 2 }}>
                Aucune référence sélectionnée.
              </div>
            )}
            {recapStd.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <h2 style={recapTitle}>Références (mode Standard) — {recapStd.length}</h2>
                <ProjetTable mode="std" rows={recapStd} selectable={false} />
              </section>
            )}
            {recapDev.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <h2 style={recapTitle}>Références (mode DEV) — {recapDev.length}</h2>
                <ProjetTable mode="dev" rows={recapDev} selectable={false} />
              </section>
            )}
          </>
        )}
      </div>

      {/* Barre sticky : navigation entre vue tableau / vue récap */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--ai-violet)', color: 'white',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)', zIndex: 100,
      }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: '10pt' }}>
          <strong style={{ fontSize: '14pt', color: 'var(--ai-rouge)' }}>{selection.size}</strong>
          {' '}référence{selection.size > 1 ? 's' : ''} sélectionnée{selection.size > 1 ? 's' : ''}
        </div>
        <div style={{ flex: 1 }} />
        {selection.size > 0 && (
          <button onClick={clearSelection} style={{
            padding: '8px 14px', background: 'transparent', color: 'white',
            border: '1px solid rgba(255,255,255,0.4)', borderRadius: 2,
            fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 600, cursor: 'pointer',
          }}>Tout désélectionner</button>
        )}
        {view === 'browse' ? (
          <button
            onClick={() => setView('recap')}
            disabled={selection.size === 0}
            style={primaryBtn(selection.size === 0)}
          >
            Voir les références sélectionnées →
          </button>
        ) : (
          <button onClick={() => setView('browse')} style={primaryBtn(false)}>
            ← Retour au tableau
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Colonnes dynamiques ────────────────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  render: (p: PublicProjet) => React.ReactNode;
  sortKey?: SortKey;
  align?: 'left' | 'right';
}

function columnsFor(mode: ColMode): ColumnDef[] {
  const nom: ColumnDef = {
    key: 'nom', label: 'Projet', sortKey: 'nom',
    render: (p) => (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {p.photoCouverture
          ? <div style={{ width: 48, height: 36, backgroundImage: `url(${p.photoCouverture.url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 1, flexShrink: 0 }} />
          : <div style={{ width: 48, height: 36, background: 'var(--ai-gris, #DFE4E8)', borderRadius: 1, flexShrink: 0 }} />}
        <span style={{ fontFamily: 'var(--serif)', fontSize: '10pt', color: 'var(--ai-noir, #30323E)' }}>{p.nom}</span>
      </div>
    ),
  };
  const moa: ColumnDef = { key: 'moa', label: 'MOA', render: (p) => p.moa ?? '—' };
  const programme: ColumnDef = { key: 'programme', label: 'Programme', render: (p) => p.programmePrincipal ?? p.programme ?? '—' };
  const architecte: ColumnDef = { key: 'architecte', label: 'Architecte', render: (p) => p.architecte ?? '—' };
  const bet: ColumnDef = { key: 'bet', label: 'BET associés', render: (p) => p.betAssocies ?? '—' };
  const surface: ColumnDef = { key: 'surface', label: 'Surface', render: (p) => p.surface ? `${p.surface.toLocaleString('fr-FR')} m²` : '—' };
  const budget: ColumnDef = { key: 'budget', label: 'Budget', render: (p) => p.budgetHT ?? '—' };
  const certification: ColumnDef = { key: 'certification', label: 'Certification', render: (p) => (p.certifications && p.certifications.length ? p.certifications.join(', ') : '—') };
  const statut: ColumnDef = {
    key: 'statut', label: 'Statut', sortKey: 'statut',
    render: (p) => (
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 2, fontSize: '7.5pt', fontWeight: 700,
        background: STATUT_BG[p.statut] ?? '#eee', color: STATUT_COLOR[p.statut] ?? '#333',
      }}>{p.statut}</span>
    ),
  };
  const bailleur: ColumnDef = { key: 'bailleur', label: 'Bailleur', render: (p) => p.bailleur ?? '—' };
  const missionAi: ColumnDef = { key: 'missionAi', label: 'Mission AI', render: (p) => p.missionAi ?? '—' };

  if (mode === 'dev') {
    return [nom, moa, bailleur, budget, programme, missionAi, bet];
  }
  return [nom, moa, programme, architecte, bet, surface, budget, certification, statut];
}

// ─── Composant tableau réutilisable ─────────────────────────────────────────

interface ProjetTableProps {
  mode: ColMode;
  rows: PublicProjet[];
  selectable: boolean;
  selection?: Map<string, ColMode>;
  onToggleSelect?: (slug: string) => void;
  loading?: boolean;
  sortKey?: SortKey;
  sortDir?: SortDir;
  onSort?: (k: SortKey) => void;
}
function ProjetTable({ mode, rows, selectable, selection, onToggleSelect, loading, sortKey, sortDir, onSort }: ProjetTableProps) {
  const columns = columnsFor(mode);
  return (
    <div style={{ background: 'white', borderRadius: 2, border: '1px solid #000', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: '9pt' }}>
        <thead>
          <tr style={{ background: '#F5F5F5', borderBottom: '1px solid #000' }}>
            {selectable && <Th style={{ width: 36 }} />}
            {columns.map((c) => (
              <Th key={c.key}
                onClick={c.sortKey && onSort ? () => onSort(c.sortKey!) : undefined}
                active={!!c.sortKey && sortKey === c.sortKey}
                dir={sortDir}
              >{c.label}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.slug} style={{ borderBottom: i < rows.length - 1 ? '1px solid #DFE4E8' : 'none' }}>
              {selectable && (
                <td style={{ ...td, width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selection?.has(p.slug) ?? false}
                    onChange={() => onToggleSelect?.(p.slug)}
                    aria-label="Sélectionner la référence"
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#E30513' }}
                  />
                </td>
              )}
              {columns.map((c) => (
                <td key={c.key} style={c.key === 'nom' ? tdNom : td}>{c.render(p)}</td>
              ))}
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={columns.length + (selectable ? 1 : 0)} style={{ padding: 40, textAlign: 'center', color: 'var(--ai-noir70)' }}>Aucune référence.</td></tr>
          )}
          {loading && (
            <tr><td colSpan={columns.length + (selectable ? 1 : 0)} style={{ padding: 40, textAlign: 'center', color: 'var(--ai-noir70)' }}>Chargement…</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Styles & helpers ───────────────────────────────────────────────────────

const chipLabel: React.CSSProperties = {
  fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--ai-noir70)', marginBottom: 6,
};

const td: React.CSSProperties = {
  padding: '10px 12px', verticalAlign: 'middle', color: 'var(--ai-noir, #30323E)',
};

const tdNom: React.CSSProperties = { ...td, minWidth: 220 };

const yearInput: React.CSSProperties = {
  width: 70, padding: '4px 6px', border: '1px solid #DFE4E8', borderRadius: 2,
  fontFamily: 'var(--sans)', fontSize: '9pt',
};

const recapTitle: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: '12pt', fontWeight: 500,
  color: 'var(--ai-violet)', margin: '0 0 12px 0',
};

const ghostBtn: React.CSSProperties = {
  padding: '6px 12px', border: '1px solid #DFE4E8', borderRadius: 2,
  background: 'white', cursor: 'pointer', color: 'var(--ai-noir70)',
  fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 600,
};

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', border: '1px solid #DFE4E8', borderRadius: 2,
    background: 'white', cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#CCC' : 'var(--ai-noir70)',
    fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 600,
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 18px',
    background: disabled ? '#666' : 'var(--ai-rouge)',
    color: 'white', border: 'none', borderRadius: 2,
    fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    letterSpacing: '0.03em',
  };
}

interface ThProps {
  children?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
  style?: React.CSSProperties;
}
function Th({ children, onClick, active, dir, style }: ThProps) {
  return (
    <th onClick={onClick} style={{
      padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: '8.5pt',
      color: 'var(--ai-noir, #30323E)', cursor: onClick ? 'pointer' : 'default',
      userSelect: 'none', whiteSpace: 'nowrap', ...style,
    }}>
      {children}
      {active && <span style={{ marginLeft: 4, color: 'var(--ai-rouge, #E30513)' }}>{dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}
