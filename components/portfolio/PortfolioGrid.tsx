'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Projet, Statut } from '@/types/projet';

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

interface Props {
  projets: Projet[];
}

function Badge({ statut }: { statut: Statut }) {
  return (
    <span style={{
      fontSize: '7pt', fontWeight: 700, padding: '2px 6px',
      background: STATUT_BG[statut] ?? '#eee',
      color: STATUT_COLOR[statut] ?? '#333',
      borderRadius: '2px', whiteSpace: 'nowrap',
    }}>
      {statut}
    </span>
  );
}

function RangeSlider({
  min, max, valueMin, valueMax, onChange,
}: {
  min: number; max: number; valueMin: number; valueMax: number;
  onChange: (min: number, max: number) => void;
}) {
  const range = max - min || 1;
  const pctLeft = ((valueMin - min) / range) * 100;
  const pctRight = ((max - valueMax) / range) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', fontWeight: 700, color: '#E30513' }}>
        <span>{valueMin}</span><span>{valueMax}</span>
      </div>
      <div className="range-slider">
        {/* Track background */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: '4px', background: '#DFE4E8', borderRadius: '2px',
          transform: 'translateY(-50%)', pointerEvents: 'none',
        }} />
        {/* Active range fill */}
        <div style={{
          position: 'absolute', top: '50%',
          left: `${pctLeft}%`, right: `${pctRight}%`,
          height: '4px', background: '#E30513', borderRadius: '2px',
          transform: 'translateY(-50%)', pointerEvents: 'none',
        }} />
        {/* Min thumb — higher z-index when at max to stay grabbable */}
        <input
          type="range" min={min} max={max} value={valueMin}
          style={{ zIndex: valueMin >= valueMax ? 3 : 1 }}
          onChange={e => onChange(Math.min(Number(e.target.value), valueMax), valueMax)}
        />
        {/* Max thumb */}
        <input
          type="range" min={min} max={max} value={valueMax}
          style={{ zIndex: valueMin >= valueMax ? 2 : 3 }}
          onChange={e => onChange(valueMin, Math.max(Number(e.target.value), valueMin))}
        />
      </div>
    </div>
  );
}

export default function PortfolioGrid({ projets }: Props) {
  const years = useMemo(() => {
    const ys = projets.map(p => p.anneeLivraison).filter((y): y is number => !!y);
    return { min: Math.min(...ys), max: Math.max(...ys) };
  }, [projets]);

  // Codes pôle disponibles, dans l'ordre canonique STR · ENV · DEV puis
  // alphabétique pour toute valeur exotique. Source : champ multi-select
  // Airtable "Vignette pôle" (uppercased côté mapper).
  const poles = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => (p.vignettePoles ?? []).forEach(v => set.add(v.toUpperCase())));
    const order = ['STR', 'ENV', 'DEV'];
    return [...set].sort((a, b) => {
      const ia = order.indexOf(a); const ib = order.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [projets]);

  // Programmes principaux disponibles (union de tous les multi-select).
  const programmes = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => {
      const list = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
      list.forEach(v => { if (v) set.add(v); });
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projets]);

  const allStatuts: Statut[] = ['En étude', 'En chantier', 'Livré', 'Abandonné', 'En pause', 'En consultation'];

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [rehabNeuf, setRehabNeuf] = useState<'Tous' | 'Neuf' | 'Réhab'>('Tous');
  const [selectedStatuts, setSelectedStatuts] = useState<Set<Statut>>(new Set());
  // Pôles : multi-sélection cumulable. Semantique AND — un projet passe le
  // filtre s'il contient TOUS les pôles cochés (intersection non vide avec
  // les pôles sélectionnés). Set vide = "Tous".
  const [selectedPoles, setSelectedPoles] = useState<Set<string>>(new Set());
  // Programmes : multi-sélection cumulable. Semantique OR — un projet passe
  // s'il a au moins un des programmes cochés. Set vide = "Tous".
  const [selectedProgrammes, setSelectedProgrammes] = useState<Set<string>>(new Set());
  const [yearMin, setYearMin] = useState(years.min);
  const [yearMax, setYearMax] = useState(years.max);

  const togglePole = (code: string) => {
    setSelectedPoles(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };
  const toggleProgramme = (p: string) => {
    setSelectedProgrammes(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const toggleStatut = (s: Statut) => {
    setSelectedStatuts(prev => {
      const next = new Set(prev);
      if (next.has(s)) { next.delete(s); } else { next.add(s); }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projets.filter(p => {
      if (q) {
        const textFields = [
          p.nom, p.affaire, p.adresse, p.pitch, p.description,
          p.moa, p.architecte, p.mandataire, p.betAssocies,
          p.entreprise, p.bailleur, p.referentAi, p.missionAi,
          p.programme, p.pole, p.departement, p.rehabNeuf,
          ...p.certifications, ...p.motsCles, ...p.tagsSiteWeb,
          p.chiffresCles?.map(c => `${c.label} ${c.valeur}`).join(' '),
        ];
        // `v?.toLowerCase()` ne protège que contre null/undefined : si Airtable
        // renvoie un nombre ou autre non-string dans un de ces champs, on
        // plante avec "e?.toLowerCase is not a function". On filtre par type.
        if (!textFields.some(v => typeof v === 'string' && v.toLowerCase().includes(q))) return false;
      }
      if (rehabNeuf !== 'Tous') {
        if (!p.rehabNeuf) return false;
        const rn = p.rehabNeuf.toLowerCase();
        if (rehabNeuf === 'Neuf' && !rn.includes('neuf')) return false;
        if (rehabNeuf === 'Réhab' && !rn.includes('réhab') && !rn.includes('rehab') && !rn.includes('réhabilitation')) return false;
      }
      if (selectedStatuts.size > 0 && !selectedStatuts.has(p.statut)) return false;
      if (selectedPoles.size > 0) {
        const projetPoles = new Set((p.vignettePoles ?? []).map(v => v.toUpperCase()));
        // AND : tous les pôles cochés doivent être présents sur le projet.
        for (const code of selectedPoles) {
          if (!projetPoles.has(code)) return false;
        }
      }
      if (selectedProgrammes.size > 0) {
        const projetProgs = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
        // OR : au moins un programme du projet doit être sélectionné.
        if (!projetProgs.some(v => selectedProgrammes.has(v))) return false;
      }
      if (p.anneeLivraison && (p.anneeLivraison < yearMin || p.anneeLivraison > yearMax)) return false;
      return true;
    });
  }, [projets, search, rehabNeuf, selectedStatuts, selectedPoles, selectedProgrammes, yearMin, yearMax]);

  const hasFilters = search || rehabNeuf !== 'Tous' || selectedStatuts.size > 0 || selectedPoles.size > 0 || selectedProgrammes.size > 0;
  const resetFilters = () => {
    setSearch('');
    setRehabNeuf('Tous');
    setSelectedStatuts(new Set());
    setSelectedPoles(new Set());
    setSelectedProgrammes(new Set());
    setYearMin(years.min);
    setYearMax(years.max);
  };

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: '2px', cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    border: active ? 'none' : '1px solid #DFE4E8',
    background: active ? 'var(--ai-rouge)' : 'white',
    color: active ? 'white' : 'var(--ai-noir70)',
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--sans)' }}>

      {/* Header */}
      <header style={{ marginBottom: '20px', borderBottom: '2px solid var(--ai-rouge)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
          <h1 style={{ fontFamily: 'var(--sans)', fontSize: '28pt', fontWeight: 500, color: 'var(--ai-violet)' }}>
            Portfolio
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              href="/portfolio/builder"
              style={{
                padding: '8px 16px',
                background: 'var(--ai-rouge)',
                color: 'white',
                fontFamily: 'var(--sans)',
                fontSize: '9pt',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textDecoration: 'none',
                borderRadius: 2,
              }}
            >
              Constituer le portfolio →
            </Link>
          </div>
        </div>
        <p style={{ fontSize: '9pt', color: 'var(--ai-noir70)', marginTop: '4px' }}>
          {filtered.length} / {projets.length} projet{projets.length > 1 ? 's' : ''} · source Airtable
        </p>
      </header>

      {/* Search + view toggle */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="search"
          placeholder="Rechercher un projet, maître d'ouvrage, adresse…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', fontFamily: 'var(--sans)', fontSize: '9pt',
            border: '1px solid #DFE4E8', borderRadius: '2px', outline: 'none',
            background: 'white',
          }}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setViewMode('grid')} style={btn(viewMode === 'grid')} title="Vue grille">
            ⊞
          </button>
          <button onClick={() => setViewMode('list')} style={btn(viewMode === 'list')} title="Vue liste">
            ☰
          </button>
        </div>
        {hasFilters && (
          <button onClick={resetFilters} style={{ ...btn(false), border: '1px solid #E30513', color: '#E30513' }}>
            × Réinitialiser
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div style={{ background: 'white', border: '1px solid #DFE4E8', borderRadius: '2px', padding: '14px 16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>

        {/* Pôle — multi-sélection, intersection AND */}
        <div>
          <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '6px' }}>Pôle</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedPoles(new Set())} style={btn(selectedPoles.size === 0)}>Tous</button>
            {poles.map(p => (
              <button key={p} onClick={() => togglePole(p)} style={btn(selectedPoles.has(p))}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Programme — multi-sélection, union OR */}
        {programmes.length > 0 && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '6px' }}>Programme</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedProgrammes(new Set())} style={btn(selectedProgrammes.size === 0)}>Tous</button>
              {programmes.map(p => (
                <button key={p} onClick={() => toggleProgramme(p)} style={btn(selectedProgrammes.has(p))}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Neuf / Réhab */}
        <div>
          <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '6px' }}>Type</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['Tous', 'Neuf', 'Réhab'] as const).map(v => (
              <button key={v} onClick={() => setRehabNeuf(v)} style={btn(rehabNeuf === v)}>{v}</button>
            ))}
          </div>
        </div>

        {/* Statut */}
        <div>
          <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '6px' }}>Statut</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {allStatuts.map(s => (
              <button key={s} onClick={() => toggleStatut(s)} style={{
                ...btn(selectedStatuts.has(s)),
                background: selectedStatuts.has(s) ? STATUT_BG[s] : 'white',
                color: selectedStatuts.has(s) ? STATUT_COLOR[s] : 'var(--ai-noir70)',
                border: selectedStatuts.has(s) ? `1px solid ${STATUT_COLOR[s]}` : '1px solid #DFE4E8',
              }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Année */}
        {years.min < years.max && (
          <div>
            <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '6px' }}>Année de livraison</div>
            <RangeSlider
              min={years.min} max={years.max}
              valueMin={yearMin} valueMax={yearMax}
              onChange={(mn, mx) => { setYearMin(mn); setYearMax(mx); }}
            />
          </div>
        )}

      </div>

      {/* Results */}
      {viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {filtered.map(projet => (
            <Link key={projet.slug} href={`/projet/${projet.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article style={{ background: 'white', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                {projet.photoCouverture
                  ? <div style={{ height: '130px', backgroundImage: `url(${projet.photoCouverture.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  : <div style={{ height: '130px', background: 'var(--ai-gris)' }} />
                }
                <div style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                    <span style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ai-noir70)' }}>
                      {projet.affaire}
                    </span>
                    <Badge statut={projet.statut} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--serif)', fontSize: '12pt', fontWeight: 500, lineHeight: '1.2', color: 'var(--ai-noir)', marginBottom: '3px' }}>
                    {projet.nom}
                  </h2>
                  {projet.moa && <p style={{ fontSize: '8pt', color: 'var(--ai-noir70)', marginBottom: '2px' }}>{projet.moa}</p>}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    {projet.anneeLivraison && <span style={{ fontSize: '8pt', color: 'var(--ai-rouge)', fontWeight: 600 }}>{projet.anneeLivraison}</span>}
                    {projet.pole && <span style={{ fontSize: '7pt', color: 'var(--ai-noir70)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{projet.pole}</span>}
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {filtered.map((projet, i) => (
            <Link key={projet.slug} href={`/projet/${projet.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr 120px 80px 60px 80px',
                gap: '12px',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: i < filtered.length - 1 ? '1px solid #DFE4E8' : 'none',
                cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F2F2F2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                {projet.photoCouverture
                  ? <div style={{ width: '56px', height: '40px', backgroundImage: `url(${projet.photoCouverture.url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '1px', flexShrink: 0 }} />
                  : <div style={{ width: '56px', height: '40px', background: 'var(--ai-gris)', borderRadius: '1px', flexShrink: 0 }} />
                }
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '10.5pt', fontWeight: 500, color: 'var(--ai-noir)', lineHeight: '1.2' }}>{projet.nom}</div>
                  {projet.moa && <div style={{ fontSize: '8pt', color: 'var(--ai-noir70)', marginTop: '2px' }}>{projet.moa}</div>}
                </div>
                <div style={{ fontSize: '7.5pt', color: 'var(--ai-noir70)' }}>{projet.programme ?? '—'}</div>
                <div style={{ fontSize: '8pt', color: 'var(--ai-rouge)', fontWeight: 600 }}>{projet.anneeLivraison ?? '—'}</div>
                <div style={{ fontSize: '7.5pt', fontWeight: 700, color: 'var(--ai-noir70)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{projet.pole ?? '—'}</div>
                <Badge statut={projet.statut} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--ai-noir70)', fontFamily: 'var(--sans)', fontSize: '10pt' }}>
          Aucun projet ne correspond aux filtres.
        </div>
      )}
    </div>
  );
}
