'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Projet, Statut } from '@/types/projet';
import { RangeSlider } from './RangeSlider';
import { FICHE_STATUS_VALUES, DEFAULT_FICHE_STATUS, type FicheStatus } from '@/lib/pdf/projectConfig';
import { useAuth } from '@/lib/supabase/useAuth';
import { color, feedback } from '@/lib/ui/tokens';

const STATUT_BG: Record<string, string> = {
  'En étude': color.gris,
  'Concours': '#F0E8F5',
  'En chantier': color.rougeClair,
  'Livré': '#d4edda',
  'Abandonné': '#e2e3e5',
  'En pause': '#fff3cd',
  'En consultation': '#d1ecf1',
};
const STATUT_COLOR: Record<string, string> = {
  'En étude': color.violet,
  'Concours': '#6B4F94',
  'En chantier': color.rouge,
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
      borderRadius: '6px', whiteSpace: 'nowrap',
    }}>
      {statut}
    </span>
  );
}

export default function PortfolioGrid({ projets }: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
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

  // Valeurs Neuf / Réhab disponibles dans les projets.
  const rehabNeufOptions = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => (p.rehabNeufValues ?? []).forEach(v => { if (v) set.add(v); }));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projets]);

  // Matériaux disponibles dans les projets.
  const materiauxOptions = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => (p.materiaux ?? []).forEach(v => { if (v) set.add(v); }));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
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

  // Ordre demandé : Livré · Concours · En chantier · En pause · En étude · En consultation.
  // "Abandonné" est volontairement omis du filtre UI (reste dans le type pour
  // compatibilité avec d'anciens records).
  const allStatuts: Statut[] = ['Livré', 'Concours', 'En chantier', 'En pause', 'En étude', 'En consultation'];

  // Workflow : compte le nombre de fiches par status interne. Le défaut
  // pour les fiches non renseignées est DEFAULT_FICHE_STATUS ('Pas faite').
  const workflowCounts = useMemo(() => {
    const counts: Record<FicheStatus, number> = {
      'Pas faite': 0,
      'En cours': 0,
      'En attente de validation': 0,
      'Prête pour publication': 0,
    };
    projets.forEach((p) => {
      counts[p.ficheStatus ?? DEFAULT_FICHE_STATUS]++;
    });
    return counts;
  }, [projets]);

  const [workflowOpen, setWorkflowOpen] = useState(true);
  // Statuts dont la liste déroulante de projets est ouverte.
  const [expandedStatuses, setExpandedStatuses] = useState<Set<FicheStatus>>(
    new Set(['En attente de validation'])
  );
  const toggleStatusExpanded = (s: FicheStatus) => {
    setExpandedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };
  // Filtre par état de publication (set vide = tous).
  const [selectedFicheStatuses, setSelectedFicheStatuses] = useState<Set<FicheStatus>>(new Set());
  const toggleFicheStatus = (s: FicheStatus) => {
    setSelectedFicheStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  // Map status → projets correspondants (calculé une fois par render).
  const projetsByStatus = useMemo(() => {
    const map: Record<FicheStatus, Projet[]> = {
      'Pas faite': [],
      'En cours': [],
      'En attente de validation': [],
      'Prête pour publication': [],
    };
    projets.forEach((p) => {
      map[p.ficheStatus ?? DEFAULT_FICHE_STATUS].push(p);
    });
    return map;
  }, [projets]);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // Rehab/Neuf : multi-sélection AND — sélection vide = tous.
  const [selectedRehabNeuf, setSelectedRehabNeuf] = useState<Set<string>>(new Set());
  // Matériaux : multi-sélection AND — sélection vide = tous.
  const [selectedMateriaux, setSelectedMateriaux] = useState<Set<string>>(new Set());
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

  const toggleRehabNeuf = (v: string) => {
    setSelectedRehabNeuf(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };
  const toggleMateriaux = (v: string) => {
    setSelectedMateriaux(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };
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
      // Rehab/Neuf : AND — le projet doit avoir TOUTES les valeurs cochées.
      if (selectedRehabNeuf.size > 0) {
        const vals = (p.rehabNeufValues ?? []).map(v => v.toLowerCase());
        for (const sel of selectedRehabNeuf) {
          if (!vals.includes(sel.toLowerCase())) return false;
        }
      }
      // Matériaux : AND — le projet doit avoir TOUS les matériaux cochés.
      if (selectedMateriaux.size > 0) {
        const vals = new Set((p.materiaux ?? []).map(v => v.toLowerCase()));
        for (const sel of selectedMateriaux) {
          if (!vals.has(sel.toLowerCase())) return false;
        }
      }
      // Statut : AND — le projet doit avoir TOUS les statuts cochés.
      if (selectedStatuts.size > 0) {
        const vals = new Set(p.statutValues ?? [p.statut]);
        for (const s of selectedStatuts) {
          if (!vals.has(s)) return false;
        }
      }
      if (selectedPoles.size > 0) {
        const projetPoles = new Set((p.vignettePoles ?? []).map(v => v.toUpperCase()));
        // AND : tous les pôles cochés doivent être présents sur le projet.
        // 1 coché → projets qui contiennent au moins ce pôle ; 2 cochés →
        // uniquement les projets qui contiennent les deux.
        for (const code of selectedPoles) {
          if (!projetPoles.has(code)) return false;
        }
      }
      if (selectedProgrammes.size > 0) {
        const projetProgs = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
        // OR : au moins un programme du projet doit être sélectionné.
        if (!projetProgs.some(v => selectedProgrammes.has(v))) return false;
      }
      if (selectedFicheStatuses.size > 0) {
        const fs = p.ficheStatus ?? DEFAULT_FICHE_STATUS;
        if (!selectedFicheStatuses.has(fs)) return false;
      }
      if (p.anneeLivraison && (p.anneeLivraison < yearMin || p.anneeLivraison > yearMax)) return false;
      return true;
    });
  }, [projets, search, selectedRehabNeuf, selectedMateriaux, selectedStatuts, selectedPoles, selectedProgrammes, selectedFicheStatuses, yearMin, yearMax]);

  const hasFilters = search || selectedRehabNeuf.size > 0 || selectedMateriaux.size > 0 || selectedStatuts.size > 0 || selectedPoles.size > 0 || selectedProgrammes.size > 0 || selectedFicheStatuses.size > 0 || yearMin !== years.min || yearMax !== years.max;
  const resetFilters = () => {
    setSearch('');
    setSelectedRehabNeuf(new Set());
    setSelectedMateriaux(new Set());
    setSelectedStatuts(new Set());
    setSelectedPoles(new Set());
    setSelectedProgrammes(new Set());
    setSelectedFicheStatuses(new Set());
    setYearMin(years.min);
    setYearMax(years.max);
  };

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: '6px', cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    border: active ? 'none' : `1px solid ${color.gris}`,
    background: active ? 'var(--ai-rouge)' : 'white',
    color: active ? 'white' : 'var(--ai-noir70)',
  });

  const totalProjets = projets.length;
  const statusColor: Record<FicheStatus, string> = {
    'Pas faite': '#9e9e9e',
    'En cours': feedback.info,
    'En attente de validation': feedback.attente,
    'Prête pour publication': feedback.succes,
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--sans)' }}>

      {/* Header */}
      <header style={{ marginBottom: '20px', borderBottom: '2px solid var(--ai-rouge)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
          <h1 style={{ fontFamily: 'var(--sans)', fontSize: '28pt', fontWeight: 500, color: 'var(--ai-violet)' }}>
            Portfolio
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <Link
              href="/portfolio/builder"
              prefetch={false}
              style={{
                padding: '8px 16px',
                background: 'var(--ai-rouge)',
                color: 'white',
                fontFamily: 'var(--sans)',
                fontSize: '9pt',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textDecoration: 'none',
                borderRadius: 8,
                textAlign: 'center',
              }}
            >
              Constituer le portfolio
            </Link>
            <Link
              href="/portfolio/tableau"
              prefetch={false}
              style={{
                padding: '8px 16px',
                background: 'var(--ai-rouge)',
                color: 'white',
                fontFamily: 'var(--sans)',
                fontSize: '9pt',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textDecoration: 'none',
                borderRadius: 8,
                textAlign: 'center',
              }}
            >
              Constituer le tableau
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                prefetch={false}
                style={{
                  padding: '8px 16px',
                  background: 'white',
                  color: 'var(--ai-violet)',
                  border: '1px solid var(--ai-violet)',
                  fontFamily: 'var(--sans)',
                  fontSize: '9pt',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textDecoration: 'none',
                  borderRadius: 8,
                  textAlign: 'center',
                }}
              >
                ⚙ Admin
              </Link>
            )}
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
            border: `1px solid ${color.gris}`, borderRadius: '8px', outline: 'none',
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
          <button onClick={resetFilters} style={{ ...btn(false), border: `1px solid ${color.rouge}`, color: color.rouge }}>
            × Réinitialiser
          </button>
        )}
      </div>

      {/* Ligne flex [sidebar État de publication | filtres + résultats].
          Sidebar sticky alignée avec le haut du bandeau de filtres. */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

      <aside style={{ flex: '0 0 220px', position: 'sticky', top: 24, alignSelf: 'flex-start' }}>
        <div style={{ background: 'white', border: `1px solid ${color.gris}`, borderRadius: 12, overflow: 'hidden' }}>
          <button
            onClick={() => setWorkflowOpen((v) => !v)}
            style={{
              width: '100%', padding: '10px 12px', textAlign: 'left',
              background: 'var(--ai-violet)', color: 'white', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            État de publication ({totalProjets})
            <span style={{ fontSize: '10pt' }}>{workflowOpen ? '▾' : '▸'}</span>
          </button>
          {workflowOpen && (
            <div style={{ padding: '6px 12px 10px' }}>
              {FICHE_STATUS_VALUES.map((s) => {
                const isFiltered = selectedFicheStatuses.has(s);
                const canExpand = s !== 'Pas faite' && workflowCounts[s] > 0;
                const isOpen = expandedStatuses.has(s);
                const list = projetsByStatus[s];
                return (
                  <div key={s} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <div
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 0', gap: 4,
                      }}
                    >
                      {/* Bouton filtre — toute la largeur sauf la flèche */}
                      <button
                        onClick={() => toggleFicheStatus(s)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                          background: isFiltered ? statusColor[s] : 'transparent',
                          border: isFiltered ? 'none' : `1px solid transparent`,
                          borderRadius: 6, padding: '3px 6px',
                          cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'var(--sans)', fontSize: '8.5pt',
                          color: isFiltered ? 'white' : 'var(--ai-noir70)',
                          userSelect: 'none',
                        }}
                        title={isFiltered ? 'Retirer le filtre' : 'Filtrer par cet état'}
                      >
                        <span style={{
                          display: 'inline-block', flexShrink: 0,
                          width: 8, height: 8, borderRadius: '50%',
                          background: isFiltered ? 'white' : statusColor[s],
                        }} />
                        <span style={{ flex: 1 }}>{s}</span>
                        <span style={{ fontWeight: 700, color: isFiltered ? 'white' : 'var(--ai-noir)' }}>
                          {workflowCounts[s]}
                        </span>
                      </button>
                      {/* Flèche expand — uniquement pour les statuts non vides (hors "Pas faite") */}
                      {canExpand && (
                        <button
                          onClick={() => toggleStatusExpanded(s)}
                          title={isOpen ? 'Replier' : 'Voir les fiches'}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            padding: '3px 4px', fontSize: '9pt', color: 'var(--ai-noir70)',
                            lineHeight: 1,
                          }}
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                      )}
                    </div>
                    {canExpand && isOpen && (
                      <ul style={{
                        listStyle: 'none', padding: '2px 0 8px 14px', margin: 0,
                        display: 'flex', flexDirection: 'column', gap: 3,
                      }}>
                        {list.map((p) => (
                          <li key={p.slug}>
                            <Link
                              href={`/projet/${p.slug}`}
                              prefetch={false}
                              style={{
                                display: 'block', fontSize: '8.5pt', color: 'var(--ai-violet)',
                                textDecoration: 'none', lineHeight: 1.3,
                              }}
                              title={p.nom}
                            >
                              → {p.nom}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>

      {/* Filters bar — disposition compacte : les petits filtres (Pôle ·
          Statut · Type · Année) tiennent sur la 1re rangée ; Programme
          (multi-select large) flue naturellement sur la rangée suivante. */}
      <div style={{ background: 'white', border: `1px solid ${color.gris}`, borderRadius: '12px', padding: '10px 14px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '14px 20px', alignItems: 'flex-start' }}>

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

        {/* Statut — déplacé en 2e position (échange avec Programme) */}
        <div>
          <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '6px' }}>Statut</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {allStatuts.map(s => (
              <button key={s} onClick={() => toggleStatut(s)} style={{
                ...btn(selectedStatuts.has(s)),
                background: selectedStatuts.has(s) ? STATUT_BG[s] : 'white',
                color: selectedStatuts.has(s) ? STATUT_COLOR[s] : 'var(--ai-noir70)',
                border: selectedStatuts.has(s) ? `1px solid ${STATUT_COLOR[s]}` : `1px solid ${color.gris}`,
              }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Neuf / Réhab — multi-sélection AND */}
        {rehabNeufOptions.length > 0 && (
          <div>
            <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '6px' }}>Type</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedRehabNeuf(new Set())} style={btn(selectedRehabNeuf.size === 0)}>Tous</button>
              {rehabNeufOptions.map(v => (
                <button key={v} onClick={() => toggleRehabNeuf(v)} style={btn(selectedRehabNeuf.has(v))}>{v}</button>
              ))}
            </div>
          </div>
        )}

        {/* Matériaux (multi-select AND) + Année slider sur la même rangée.
            Matériaux flex à gauche, slider repoussé à droite via marginLeft auto. */}
        {(materiauxOptions.length > 0 || years.min < years.max) && (
          <div style={{ flex: '1 1 100%', display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {materiauxOptions.length > 0 && (
              <div style={{ flex: '1 1 auto', minWidth: 240 }}>
                <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '6px' }}>Matériaux</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button onClick={() => setSelectedMateriaux(new Set())} style={btn(selectedMateriaux.size === 0)}>Tous</button>
                  {materiauxOptions.map(v => (
                    <button key={v} onClick={() => toggleMateriaux(v)} style={btn(selectedMateriaux.has(v))}>{v}</button>
                  ))}
                </div>
              </div>
            )}
            {years.min < years.max && (
              <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
                <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '6px' }}>Année de livraison</div>
                <RangeSlider
                  min={years.min} max={years.max}
                  valueMin={yearMin} valueMax={yearMax}
                  onChange={(mn, mx) => { setYearMin(mn); setYearMax(mx); }}
                />
              </div>
            )}
          </div>
        )}

        {/* Programme — déplacé en dernier (largeur libre, prend une rangée
            entière sans pousser les autres filtres) */}
        {programmes.length > 0 && (
          <div style={{ flex: '1 1 100%' }}>
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

      </div>

      {/* Results */}
      {viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {filtered.map(projet => (
            <Link key={projet.slug} href={`/projet/${projet.slug}`} prefetch={false} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
              {/* Tuile uniforme : height 100% (la grille align-items: stretch
                  par défaut + height 100% sur le Link force toutes les tuiles
                  d'une même rangée à la même hauteur). Image en aspect-ratio
                  fixe pour un rendu cohérent quelle que soit la photo source. */}
              <article style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {projet.photoCouverture
                  ? <div style={{ aspectRatio: '16 / 10', width: '100%', backgroundImage: `url(${projet.photoCouverture.url})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }} />
                  : <div style={{ aspectRatio: '16 / 10', width: '100%', background: 'var(--ai-gris)', flexShrink: 0 }} />
                }
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
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
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '4px' }}>
                    {projet.anneeLivraison && <span style={{ fontSize: '8pt', color: 'var(--ai-rouge)', fontWeight: 600 }}>{projet.anneeLivraison}</span>}
                    {(projet.vignettePoles ?? []).length > 0 && <span style={{ fontSize: '7pt', color: 'var(--ai-noir70)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{(projet.vignettePoles ?? []).join(' · ')}</span>}
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {filtered.map((projet, i) => (
            <Link key={projet.slug} href={`/projet/${projet.slug}`} prefetch={false} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr 120px 80px 60px 80px',
                gap: '12px',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${color.gris}` : 'none',
                cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = color.grisTresClair)}
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
                <div style={{ fontSize: '7.5pt', fontWeight: 700, color: 'var(--ai-noir70)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{(projet.vignettePoles ?? []).length > 0 ? (projet.vignettePoles ?? []).join(' · ') : '—'}</div>
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
      </div>
    </div>
  );
}
