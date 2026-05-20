'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { Projet, Statut } from '@/types/projet';
import { TABLEAU_FIELDS, TABLEAU_DEFAULTS_BY_MODE, TABLEAU_ORDER_BY_MODE, renderTableau, type TableauOrientation, type TableauMode } from '@/lib/pdf/tableauTemplate';
import { SHARED_CSS, FONTS_LINK } from '@/lib/pdf/templates/shared';
import { measureOverflow, type OverflowMeasure } from '@/lib/utils/measureOverflow';

interface Props { projets: Projet[]; }

type Step = 'select' | 'order' | 'preview';

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

export default function TableauBuilder({ projets }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [orderedSlugs, setOrderedSlugs] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<TableauOrientation>('paysage');
  // Mode = jeu de colonnes par défaut + ordre canonique du tableau. Pré-réglé
  // sur le template de la 1re référence sélectionnée à l'entrée de l'étape 3,
  // ensuite modifiable. Quand l'utilisateur change de mode, on remet les
  // cases cochées au défaut du nouveau mode (sinon des colonnes hors-spec
  // pourraient rester actives).
  const [mode, setMode] = useState<TableauMode>('Str-Env');
  const [fields, setFields] = useState<string[]>(TABLEAU_DEFAULTS_BY_MODE['Str-Env']);
  const [modeInitialized, setModeInitialized] = useState(false);

  // ----- Filtres (sous-ensemble de PortfolioBuilder) -----
  const years = useMemo(() => {
    const ys = projets.map(p => p.anneeLivraison).filter((y): y is number => !!y);
    return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : { min: 0, max: 0 };
  }, [projets]);
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
  const allStatuts: Statut[] = ['En étude', 'En chantier', 'Livré', 'Abandonné', 'En pause', 'En consultation'];
  // Matériaux : valeurs disponibles dans les projets (multi-select AND).
  const materiauxOptions = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => (p.materiaux ?? []).forEach(v => { if (v) set.add(v); }));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projets]);

  const [search, setSearch] = useState('');
  const [selectedPoles, setSelectedPoles] = useState<Set<string>>(new Set());
  const [selectedStatuts, setSelectedStatuts] = useState<Set<Statut>>(new Set());
  // Matériaux : multi-sélection AND. Set vide = "Tous".
  const [selectedMateriaux, setSelectedMateriaux] = useState<Set<string>>(new Set());
  const [yearMin, setYearMin] = useState(years.min);
  const [yearMax, setYearMax] = useState(years.max);

  const togglePole = (code: string) => {
    setSelectedPoles(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };
  const toggleStatut = (s: Statut) => {
    setSelectedStatuts(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projets.filter(p => {
      if (q) {
        const fs = [p.nom, p.affaire, p.adresse, p.moa, p.architecte, p.programme];
        if (!fs.some(v => typeof v === 'string' && v.toLowerCase().includes(q))) return false;
      }
      // Statut : AND — le projet doit avoir TOUS les statuts cochés.
      if (selectedStatuts.size > 0) {
        const vals = new Set(p.statutValues ?? [p.statut]);
        for (const s of selectedStatuts) {
          if (!vals.has(s)) return false;
        }
      }
      if (selectedPoles.size > 0) {
        const pp = new Set((p.vignettePoles ?? []).map(v => v.toUpperCase()));
        for (const code of selectedPoles) if (!pp.has(code)) return false;
      }
      // Matériaux : AND — le projet doit avoir TOUS les matériaux cochés.
      if (selectedMateriaux.size > 0) {
        const vals = new Set((p.materiaux ?? []).map(v => v.toLowerCase()));
        for (const sel of selectedMateriaux) {
          if (!vals.has(sel.toLowerCase())) return false;
        }
      }
      if (p.anneeLivraison && (p.anneeLivraison < yearMin || p.anneeLivraison > yearMax)) return false;
      return true;
    });
  }, [projets, search, selectedStatuts, selectedPoles, selectedMateriaux, yearMin, yearMax]);

  // ----- Sélection -----
  function toggleSelect(slug: string) {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }
  function selectAllFiltered() {
    setSelection(prev => {
      const next = new Set(prev);
      filtered.forEach(p => next.add(p.slug));
      return next;
    });
  }
  function clearSelection() { setSelection(new Set()); }

  // ----- Ordre -----
  function goToOrderStep() {
    if (selection.size === 0) return;
    const inOrder = filtered.filter(p => selection.has(p.slug)).map(p => p.slug);
    const remaining = [...selection].filter(s => !inOrder.includes(s));
    setOrderedSlugs([...inOrder, ...remaining]);
    setStep('order');
  }
  function moveItem(slug: string, dir: -1 | 1) {
    setOrderedSlugs(prev => {
      const i = prev.indexOf(slug);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function removeFromOrder(slug: string) {
    setOrderedSlugs(prev => prev.filter(s => s !== slug));
    setSelection(prev => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
  }

  const projetsBySlug = useMemo(() => {
    const m = new Map<string, Projet>();
    projets.forEach(p => m.set(p.slug, p));
    return m;
  }, [projets]);

  // ----- Toggle d'un champ dans la sélection de colonnes -----
  // L'ordre du tableau est piloté par le mode (cf. TABLEAU_ORDER_BY_MODE) :
  // on garde la liste triée selon cet ordre — pratique pour la preview qui
  // affiche les colonnes dans le bon ordre.
  function toggleField(key: string) {
    setFields(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      const order = TABLEAU_ORDER_BY_MODE[mode];
      return order.filter(k => next.includes(k));
    });
  }

  function changeMode(newMode: TableauMode) {
    setMode(newMode);
    // Reset les colonnes cochées sur le défaut du nouveau mode.
    setFields(TABLEAU_DEFAULTS_BY_MODE[newMode]);
  }

  // Pré-règle le mode sur le template de la 1re référence sélectionnée lors
  // de la première entrée dans l'étape 3. Si l'utilisateur revient à l'étape
  // 3 plus tard, on respecte son choix manuel précédent.
  useEffect(() => {
    if (step !== 'preview' || modeInitialized || orderedSlugs.length === 0) return;
    const first = projetsBySlug.get(orderedSlugs[0]);
    const initial: TableauMode = first?.template === 'Dev' ? 'Dev' : 'Str-Env';
    setMode(initial);
    setFields(TABLEAU_DEFAULTS_BY_MODE[initial]);
    setModeInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, orderedSlugs, projetsBySlug, modeInitialized]);

  // ----- Export PDF (impression natif) -----
  function handleExport() {
    if (orderedSlugs.length === 0 || fields.length === 0) return;
    const url = `/portfolio/tableau/print?items=${encodeURIComponent(orderedSlugs.join(','))}&fields=${encodeURIComponent(fields.join(','))}&orient=${orientation}&mode=${encodeURIComponent(mode)}`;
    window.open(url, '_blank');
  }

  // ----- Aperçu HTML du tableau (iframe) -----
  const orderedProjets = useMemo(
    () => orderedSlugs.map(s => projetsBySlug.get(s)).filter((p): p is Projet => Boolean(p)),
    [orderedSlugs, projetsBySlug]
  );
  const previewHtml = useMemo(() => {
    if (step !== 'preview') return '';
    const bundle = renderTableau({ projets: orderedProjets, fieldKeys: fields, orientation, mode });
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">${FONTS_LINK}<style>${SHARED_CSS}${bundle.css}body{background:white;}</style></head><body>${bundle.body}</body></html>`;
  }, [step, orderedProjets, fields, orientation, mode]);

  // ----- Styles partagés -----
  const btn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 2, cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    border: active ? 'none' : '1px solid #DFE4E8',
    background: active ? 'var(--ai-rouge)' : 'white',
    color: active ? 'white' : 'var(--ai-noir70)',
  });

  return (
    <div style={{ paddingBottom: 140 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--sans)' }}>
        <header style={{ marginBottom: 20, borderBottom: '2px solid var(--ai-rouge)', paddingBottom: 16 }}>
          <Link href="/" style={{ fontSize: '9pt', color: 'var(--ai-noir70)', textDecoration: 'none', fontWeight: 600 }}>
            ← Retour au portfolio
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <h1 style={{ fontFamily: 'var(--sans)', fontSize: '16pt', fontWeight: 500, color: 'var(--ai-violet)' }}>
              Constituer le tableau
            </h1>
            <span style={{ fontSize: '9pt', color: 'var(--ai-noir70)', fontWeight: 600 }}>
              {step === 'select' ? `${filtered.length} / ${projets.length} affichés` : `${orderedSlugs.length} référence${orderedSlugs.length > 1 ? 's' : ''}`}
            </span>
          </div>
          <p style={{ fontSize: '9pt', color: 'var(--ai-noir70)', marginTop: 4 }}>
            {step === 'select' && 'Étape 1/3 — Sélectionne les références à inclure dans le tableau.'}
            {step === 'order' && 'Étape 2/3 — Réorganise l’ordre des lignes.'}
            {step === 'preview' && 'Étape 3/3 — Choisis l’orientation et les colonnes, puis exporte.'}
          </p>
        </header>

        {step === 'select' && (
          <SelectStep
            filtered={filtered}
            selection={selection}
            toggleSelect={toggleSelect}
            selectAllFiltered={selectAllFiltered}
            clearSelection={clearSelection}
            search={search} setSearch={setSearch}
            poles={poles} selectedPoles={selectedPoles} togglePole={togglePole} setSelectedPoles={setSelectedPoles}
            allStatuts={allStatuts} selectedStatuts={selectedStatuts} toggleStatut={toggleStatut}
            materiauxOptions={materiauxOptions} selectedMateriaux={selectedMateriaux} toggleMateriaux={toggleMateriaux} setSelectedMateriaux={setSelectedMateriaux}
            yearMin={yearMin} yearMax={yearMax} setYearMin={setYearMin} setYearMax={setYearMax} years={years}
            btn={btn}
          />
        )}

        {step === 'order' && (
          <OrderStep
            orderedSlugs={orderedSlugs}
            projetsBySlug={projetsBySlug}
            moveItem={moveItem}
            removeFromOrder={removeFromOrder}
          />
        )}

        {step === 'preview' && (
          <PreviewStep
            html={previewHtml}
            orientation={orientation}
            setOrientation={setOrientation}
            mode={mode}
            setMode={changeMode}
            fields={fields}
            toggleField={toggleField}
          />
        )}
      </div>

      {/* Barre sticky */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--ai-violet)', color: 'white',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)', zIndex: 100,
      }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: '10pt' }}>
          <strong style={{ fontSize: '14pt', color: 'var(--ai-rouge)' }}>{step === 'select' ? selection.size : orderedSlugs.length}</strong>
          {' '}référence{(step === 'select' ? selection.size : orderedSlugs.length) > 1 ? 's' : ''}
        </div>
        <div style={{ flex: 1 }} />
        {step !== 'select' && (
          <button
            onClick={() => setStep(step === 'order' ? 'select' : 'order')}
            style={{
              padding: '10px 16px', background: 'transparent', color: 'white',
              border: '1px solid rgba(255,255,255,0.4)', borderRadius: 2,
              fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 600, cursor: 'pointer',
            }}
          >
            ← {step === 'order' ? 'Modifier la sélection' : 'Modifier l’ordre'}
          </button>
        )}
        {step === 'select' && (
          <button onClick={goToOrderStep} disabled={selection.size === 0}
            style={primaryBtn(selection.size === 0)}>
            Suivant : ordonner →
          </button>
        )}
        {step === 'order' && (
          <button onClick={() => setStep('preview')} disabled={orderedSlugs.length === 0}
            style={primaryBtn(orderedSlugs.length === 0)}>
            Suivant : configurer →
          </button>
        )}
        {step === 'preview' && (
          <button onClick={handleExport} disabled={orderedSlugs.length === 0 || fields.length === 0}
            style={primaryBtn(orderedSlugs.length === 0 || fields.length === 0)}>
            Exporter le PDF →
          </button>
        )}
      </div>
    </div>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 20px',
    background: disabled ? '#666' : 'var(--ai-rouge)',
    color: 'white', border: 'none', borderRadius: 2,
    fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    letterSpacing: '0.05em',
  };
}

// ─── Étape 1 : sélection ────────────────────────────────────────────────────
interface SelectStepProps {
  filtered: Projet[];
  selection: Set<string>;
  toggleSelect: (slug: string) => void;
  selectAllFiltered: () => void;
  clearSelection: () => void;
  search: string; setSearch: (v: string) => void;
  poles: string[];
  selectedPoles: Set<string>;
  togglePole: (code: string) => void;
  setSelectedPoles: (s: Set<string>) => void;
  allStatuts: Statut[];
  selectedStatuts: Set<Statut>;
  toggleStatut: (s: Statut) => void;
  materiauxOptions: string[];
  selectedMateriaux: Set<string>;
  toggleMateriaux: (v: string) => void;
  setSelectedMateriaux: (s: Set<string>) => void;
  yearMin: number; yearMax: number;
  setYearMin: (n: number) => void; setYearMax: (n: number) => void;
  years: { min: number; max: number };
  btn: (active: boolean) => React.CSSProperties;
}
function SelectStep(p: SelectStepProps) {
  return (
    <>
      <input
        type="search"
        placeholder="Rechercher…"
        value={p.search}
        onChange={e => p.setSearch(e.target.value)}
        style={{
          width: '100%', padding: '8px 12px', fontFamily: 'var(--sans)', fontSize: '9pt',
          border: '1px solid #DFE4E8', borderRadius: 2, outline: 'none', background: 'white', marginBottom: 16,
        }}
      />
      <div style={{ background: 'white', border: '1px solid #DFE4E8', borderRadius: 2, padding: '14px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>Pôle</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => p.setSelectedPoles(new Set())} style={p.btn(p.selectedPoles.size === 0)}>Tous</button>
            {p.poles.map(c => (
              <button key={c} onClick={() => p.togglePole(c)} style={p.btn(p.selectedPoles.has(c))}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>Statut</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {p.allStatuts.map(s => (
              <button key={s} onClick={() => p.toggleStatut(s)} style={{
                ...p.btn(p.selectedStatuts.has(s)),
                background: p.selectedStatuts.has(s) ? STATUT_BG[s] : 'white',
                color: p.selectedStatuts.has(s) ? STATUT_COLOR[s] : 'var(--ai-noir70)',
                border: p.selectedStatuts.has(s) ? `1px solid ${STATUT_COLOR[s]}` : '1px solid #DFE4E8',
              }}>{s}</button>
            ))}
          </div>
        </div>
        {p.years.min < p.years.max && (
          <div>
            <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>Année</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '9pt' }}>
              <input type="number" value={p.yearMin} onChange={e => p.setYearMin(Math.min(Number(e.target.value), p.yearMax))} style={{ width: 60, padding: '4px 6px', border: '1px solid #DFE4E8', borderRadius: 2 }} />
              <span style={{ color: 'var(--ai-noir70)' }}>–</span>
              <input type="number" value={p.yearMax} onChange={e => p.setYearMax(Math.max(Number(e.target.value), p.yearMin))} style={{ width: 60, padding: '4px 6px', border: '1px solid #DFE4E8', borderRadius: 2 }} />
            </div>
          </div>
        )}
        {p.materiauxOptions.length > 0 && (
          <div style={{ flex: '1 1 100%' }}>
            <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>Matériaux</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => p.setSelectedMateriaux(new Set())} style={p.btn(p.selectedMateriaux.size === 0)}>Tous</button>
              {p.materiauxOptions.map(v => (
                <button key={v} onClick={() => p.toggleMateriaux(v)} style={p.btn(p.selectedMateriaux.has(v))}>{v}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', fontSize: '9pt', color: 'var(--ai-noir70)' }}>
        <button onClick={p.selectAllFiltered} style={p.btn(false)}>Tout sélectionner ({p.filtered.length})</button>
        <button onClick={p.clearSelection} style={p.btn(false)}>Tout désélectionner</button>
        <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{p.selection.size} sélectionnée{p.selection.size > 1 ? 's' : ''}</span>
      </div>
      <div style={{ background: 'white', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {p.filtered.map((projet, i) => {
          const isSelected = p.selection.has(projet.slug);
          return (
            <div key={projet.slug} style={{
              display: 'grid', gridTemplateColumns: '32px 56px 1fr 100px 80px',
              gap: 12, alignItems: 'center', padding: '10px 16px',
              borderBottom: i < p.filtered.length - 1 ? '1px solid #DFE4E8' : 'none',
              background: isSelected ? '#FFF5F5' : 'white',
            }}>
              <input type="checkbox" checked={isSelected} onChange={() => p.toggleSelect(projet.slug)}
                style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#E30513' }} />
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
            </div>
          );
        })}
        {p.filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--ai-noir70)', fontSize: '10pt' }}>
            Aucun projet ne correspond aux filtres.
          </div>
        )}
      </div>
    </>
  );
}

// ─── Étape 2 : ordre ────────────────────────────────────────────────────────
interface OrderStepProps {
  orderedSlugs: string[];
  projetsBySlug: Map<string, Projet>;
  moveItem: (slug: string, dir: -1 | 1) => void;
  removeFromOrder: (slug: string) => void;
}
function OrderStep({ orderedSlugs, projetsBySlug, moveItem, removeFromOrder }: OrderStepProps) {
  return (
    <div style={{ background: 'white', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {orderedSlugs.map((slug, i) => {
        const projet = projetsBySlug.get(slug);
        if (!projet) return null;
        const isFirst = i === 0;
        const isLast = i === orderedSlugs.length - 1;
        return (
          <div key={slug} style={{
            display: 'grid', gridTemplateColumns: '36px 28px 56px 1fr 100px 80px 28px',
            gap: 12, alignItems: 'center', padding: '10px 16px',
            borderBottom: i < orderedSlugs.length - 1 ? '1px solid #DFE4E8' : 'none',
            background: 'white',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={() => moveItem(slug, -1)} disabled={isFirst} aria-label="Monter"
                style={arrowBtn(isFirst)}>▲</button>
              <button onClick={() => moveItem(slug, 1)} disabled={isLast} aria-label="Descendre"
                style={arrowBtn(isLast)}>▼</button>
            </div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: '11pt', fontWeight: 700, color: 'var(--ai-rouge)', textAlign: 'center' }}>{i + 1}</div>
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
            <button onClick={() => removeFromOrder(slug)} aria-label="Retirer"
              style={{ padding: '4px 6px', fontSize: '10pt', lineHeight: 1, border: '1px solid #DFE4E8', borderRadius: 2, background: 'white', color: 'var(--ai-noir70)', cursor: 'pointer' }}>✕</button>
          </div>
        );
      })}
      {orderedSlugs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--ai-noir70)', fontSize: '10pt' }}>
          Aucune référence à ordonner.
        </div>
      )}
    </div>
  );
}

function arrowBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '2px 6px', fontSize: '10pt', lineHeight: 1,
    border: '1px solid #DFE4E8', borderRadius: 2, background: 'white',
    color: disabled ? '#CCC' : 'var(--ai-noir70)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

// ─── Étape 3 : preview ──────────────────────────────────────────────────────
interface PreviewStepProps {
  html: string;
  orientation: TableauOrientation;
  setOrientation: (o: TableauOrientation) => void;
  mode: TableauMode;
  setMode: (m: TableauMode) => void;
  fields: string[];
  toggleField: (k: string) => void;
}
function PreviewStep({ html, orientation, setOrientation, mode, setMode, fields, toggleField }: PreviewStepProps) {
  // Affiche les colonnes dans l'ordre canonique du mode pour que la liste de
  // checkboxes corresponde à l'ordre du tableau rendu. "Lieu" reste à sa
  // place canonique (juste avant "Année").
  const orderedFieldDefs = TABLEAU_ORDER_BY_MODE[mode]
    .map(k => TABLEAU_FIELDS.find(f => f.key === k))
    .filter((f): f is typeof TABLEAU_FIELDS[number] => Boolean(f));
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [overflow, setOverflow] = useState<OverflowMeasure | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    async function measure() {
      try {
        const doc = iframe?.contentDocument;
        if (!doc) return;
        try { await doc.fonts?.ready; } catch { /* noop */ }
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          requestAnimationFrame(() => {
            if (cancelled) return;
            setOverflow(measureOverflow(doc));
          });
        });
      } catch { /* noop */ }
    }
    function onLoad() { measure(); }
    iframe.addEventListener('load', onLoad);
    measure();
    return () => { cancelled = true; iframe.removeEventListener('load', onLoad); };
  }, [html]);

  const overflowing = overflow !== null && overflow.overflowMm > 0;
  const previewWidthMm = orientation === 'paysage' ? 297 : 210;
  const previewHeightMm = orientation === 'paysage' ? 210 : 297;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
      {/* Sidebar config */}
      <aside style={{ position: 'sticky', top: 16, alignSelf: 'start', background: 'white', border: '1px solid #DFE4E8', borderRadius: 2, padding: 16 }}>
        <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 8 }}>Mode</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
          {(['Str-Env', 'Dev'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '6px 0', fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
                border: mode === m ? 'none' : '1px solid #DFE4E8',
                background: mode === m ? 'var(--ai-rouge)' : 'white',
                color: mode === m ? 'white' : 'var(--ai-noir70)',
                cursor: 'pointer', borderRadius: 2,
              }}>{m}</button>
          ))}
        </div>
        <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 8 }}>Orientation</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
          {(['paysage', 'portrait'] as const).map(o => (
            <button key={o} onClick={() => setOrientation(o)}
              style={{
                flex: 1, padding: '6px 0', fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
                border: orientation === o ? 'none' : '1px solid #DFE4E8',
                background: orientation === o ? 'var(--ai-rouge)' : 'white',
                color: orientation === o ? 'white' : 'var(--ai-noir70)',
                cursor: 'pointer', borderRadius: 2, textTransform: 'capitalize',
              }}>{o}</button>
          ))}
        </div>
        <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 8 }}>Colonnes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {orderedFieldDefs.map(f => {
            const checked = fields.includes(f.key);
            return (
              <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '9pt', cursor: 'pointer', padding: '2px 0' }}>
                <input type="checkbox" checked={checked} onChange={() => toggleField(f.key)}
                  style={{ accentColor: '#E30513' }} />
                {f.label}
              </label>
            );
          })}
        </div>
      </aside>
      {/* Preview */}
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px' }}>
        {overflowing && (
          <div role="alert" style={{
            width: `${previewWidthMm}mm`, marginBottom: 12, padding: '10px 16px',
            background: 'var(--ai-rouge)', color: 'white', fontFamily: 'var(--sans)',
            fontSize: '9pt', fontWeight: 600, borderRadius: 2,
          }}>
            Le tableau dépasse la page de {overflow!.overflowMm} mm — réduit le nombre de lignes/colonnes ou bascule en {orientation === 'portrait' ? 'paysage' : 'portrait'}.
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="Aperçu tableau"
          srcDoc={html}
          style={{
            width: `${previewWidthMm}mm`,
            minHeight: `${previewHeightMm}mm`,
            border: 'none', background: 'white',
            boxShadow: overflowing
              ? '0 4px 24px rgba(227,5,19,0.35), 0 0 0 2px var(--ai-rouge)'
              : '0 4px 24px rgba(0,0,0,0.12)',
          }}
        />
      </main>
    </div>
  );
}
