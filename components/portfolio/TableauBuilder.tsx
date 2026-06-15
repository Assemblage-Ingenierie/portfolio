'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { Projet, Statut } from '@/types/projet';
import { RangeSlider } from './RangeSlider';
import { TABLEAU_FIELDS, TABLEAU_DEFAULTS_BY_MODE, TABLEAU_ORDER_BY_MODE, renderTableau, type TableauOrientation, type TableauMode } from '@/lib/pdf/tableauTemplate';
import { SHARED_CSS, FONTS_LINK } from '@/lib/pdf/templates/shared';
import { measureOverflow, type OverflowMeasure } from '@/lib/utils/measureOverflow';
import { color } from '@/lib/ui/tokens';

interface Props { projets: Projet[]; }

type Step = 'select' | 'order' | 'preview';

const chipLabel: React.CSSProperties = {
  fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6,
};

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

  // ----- Champ libre -----
  // nomConfigured : true quand l'utilisateur a confirmé le nom + descriptions.
  // Tant que false, on ne rend pas la colonne (mais on garde 'champLibre' dans
  // `fields` pour mémoriser l'intention de l'utilisateur).
  const [champLibreNom, setChampLibreNom] = useState('');
  const [champLibreValues, setChampLibreValues] = useState<Record<string, string>>({});
  const [champLibreConfigured, setChampLibreConfigured] = useState(false);
  const [showChampLibreModal, setShowChampLibreModal] = useState(false);

  // ----- Pagination automatique (paysage) -----
  // Quand measureOverflow détecte un dépassement, on calcule un rowsPerPage
  // qui fait tenir le contenu, on re-render, et on itère si besoin. Reset
  // automatique sur changement d'orientation / mode / colonnes / ordre /
  // champ libre — tous les paramètres qui changent la hauteur du tableau.
  const [autoRowsPerPage, setAutoRowsPerPage] = useState<number | null>(null);
  const [paginationAttempts, setPaginationAttempts] = useState(0);

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
  const allStatuts: Statut[] = ['Livré', 'Concours', 'En chantier', 'En pause', 'En étude', 'En consultation'];
  // Matériaux : valeurs disponibles dans les projets (multi-select AND).
  const materiauxOptions = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => (p.materiaux ?? []).forEach(v => { if (v) set.add(v); }));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projets]);
  // Type Neuf/Réhab : valeurs depuis le multi-select Airtable.
  const rehabNeufOptions = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => (p.rehabNeufValues ?? []).forEach(v => { if (v) set.add(v); }));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projets]);
  // Programmes principaux disponibles.
  const programmes = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => {
      const list = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
      list.forEach(v => { if (v) set.add(v); });
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projets]);

  const [search, setSearch] = useState('');
  const [selectedPoles, setSelectedPoles] = useState<Set<string>>(new Set());
  const [selectedStatuts, setSelectedStatuts] = useState<Set<Statut>>(new Set());
  const [selectedMateriaux, setSelectedMateriaux] = useState<Set<string>>(new Set());
  const [selectedRehabNeuf, setSelectedRehabNeuf] = useState<Set<string>>(new Set());
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
  const toggleRehabNeuf = (v: string) => {
    setSelectedRehabNeuf(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };
  const toggleProgramme = (v: string) => {
    setSelectedProgrammes(prev => {
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
      // Type Neuf/Réhab : AND.
      if (selectedRehabNeuf.size > 0) {
        const vals = (p.rehabNeufValues ?? []).map(v => v.toLowerCase());
        for (const sel of selectedRehabNeuf) {
          if (!vals.includes(sel.toLowerCase())) return false;
        }
      }
      // Programmes : OR — au moins un programme du projet doit être sélectionné.
      if (selectedProgrammes.size > 0) {
        const projetProgs = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
        if (!projetProgs.some(v => selectedProgrammes.has(v))) return false;
      }
      // Matériaux : AND.
      if (selectedMateriaux.size > 0) {
        const vals = new Set((p.materiaux ?? []).map(v => v.toLowerCase()));
        for (const sel of selectedMateriaux) {
          if (!vals.has(sel.toLowerCase())) return false;
        }
      }
      if (p.anneeLivraison && (p.anneeLivraison < yearMin || p.anneeLivraison > yearMax)) return false;
      return true;
    });
  }, [projets, search, selectedStatuts, selectedPoles, selectedRehabNeuf, selectedProgrammes, selectedMateriaux, yearMin, yearMax]);

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
    // Cas spécial : champ libre — ouverture du modal de configuration au lieu
    // d'un simple toggle. La case ne se coche qu'après confirmation du modal.
    if (key === 'champLibre') {
      if (fields.includes('champLibre')) {
        // Décocher : on retire le champ mais on garde les valeurs en mémoire
        // (au cas où l'utilisateur le re-coche plus tard).
        setFields(prev => prev.filter(k => k !== 'champLibre'));
      } else {
        setShowChampLibreModal(true);
      }
      return;
    }
    setFields(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      const order = TABLEAU_ORDER_BY_MODE[mode];
      return order.filter(k => next.includes(k));
    });
  }

  // ----- Champ libre : confirmation du modal -----
  function confirmChampLibre(nom: string, values: Record<string, string>) {
    setChampLibreNom(nom);
    setChampLibreValues(values);
    setChampLibreConfigured(true);
    setShowChampLibreModal(false);
    // Ajoute 'champLibre' à fields (dernière colonne via TABLEAU_ORDER_BY_MODE).
    setFields(prev => {
      const next = prev.includes('champLibre') ? prev : [...prev, 'champLibre'];
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
    const params = new URLSearchParams();
    params.set('items', orderedSlugs.join(','));
    params.set('fields', fields.join(','));
    params.set('orient', orientation);
    params.set('mode', mode);
    if (champLibreConfigured && fields.includes('champLibre')) {
      params.set('cln', champLibreNom);
      // Réduit aux slugs réellement exportés.
      const filteredValues: Record<string, string> = {};
      orderedSlugs.forEach(s => {
        if (champLibreValues[s]) filteredValues[s] = champLibreValues[s];
      });
      params.set('clv', JSON.stringify(filteredValues));
    }
    if (autoRowsPerPage && autoRowsPerPage > 0) {
      params.set('rpp', String(autoRowsPerPage));
    }
    window.open(`/portfolio/tableau/print?${params.toString()}`, '_blank');
  }

  // ----- Aperçu HTML du tableau (iframe) -----
  const orderedProjets = useMemo(
    () => orderedSlugs.map(s => projetsBySlug.get(s)).filter((p): p is Projet => Boolean(p)),
    [orderedSlugs, projetsBySlug]
  );
  const previewHtml = useMemo(() => {
    if (step !== 'preview') return '';
    const bundle = renderTableau({
      projets: orderedProjets,
      fieldKeys: fields,
      orientation,
      mode,
      champLibreNom: champLibreConfigured ? champLibreNom : undefined,
      champLibreValues: champLibreConfigured ? champLibreValues : undefined,
      // Pagination auto déclenchée par l'effet d'overflow ci-dessous.
      rowsPerPage: autoRowsPerPage ?? undefined,
    });
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">${FONTS_LINK}<style>${SHARED_CSS}${bundle.css}body{background:white;}</style></head><body>${bundle.body}</body></html>`;
  }, [step, orderedProjets, fields, orientation, mode, champLibreNom, champLibreValues, champLibreConfigured, autoRowsPerPage]);

  // Reset de la pagination automatique sur toute modification qui change la
  // hauteur du tableau (orientation, mode, colonnes, ordre, champ libre).
  // Sans ce reset on garderait un rowsPerPage qui ne correspond plus.
  useEffect(() => {
    setAutoRowsPerPage(null);
    setPaginationAttempts(0);
  }, [orientation, mode, fields, orderedSlugs, champLibreNom, champLibreValues, champLibreConfigured]);

  // ----- Styles partagés -----
  const btn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    border: active ? 'none' : `1px solid ${color.gris}`,
    background: active ? 'var(--ai-rouge)' : 'white',
    color: active ? 'white' : 'var(--ai-noir70)',
  });

  // Bandeau d'action inline (compteur + boutons d'étape). Même style que le
  // bandeau de /portfolio/builder : fond blanc, bordure grise, arrondis 12px.
  const actionBar: React.CSSProperties = {
    background: 'white', color: 'var(--ai-noir70)',
    border: `1px solid ${color.gris}`,
    padding: '12px 18px', borderRadius: 12, marginBottom: 20,
    display: 'flex', alignItems: 'center', gap: 16,
  };
  const count = step === 'select' ? selection.size : orderedSlugs.length;
  const actionBanner = (
    <div style={actionBar}>
      {step !== 'select' && (
        <button
          onClick={() => setStep(step === 'order' ? 'select' : 'order')}
          style={{
            padding: '10px 16px', background: 'white',
            color: 'var(--ai-noir70)', border: `1px solid ${color.gris}`, borderRadius: 8,
            fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← {step === 'order' ? 'Modifier la sélection' : 'Modifier l’ordre'}
        </button>
      )}
      <div style={{ fontFamily: 'var(--sans)', fontSize: '10pt', color: 'var(--ai-noir70)' }}>
        <strong style={{ fontSize: '14pt', color: 'var(--ai-rouge)' }}>{count}</strong>
        {' '}référence{count > 1 ? 's' : ''}
      </div>
      <div style={{ flex: 1 }} />
      {step === 'select' && (
        <button onClick={goToOrderStep} disabled={selection.size === 0} style={primaryBtn(selection.size === 0)}>
          Suivant : ordonner →
        </button>
      )}
      {step === 'order' && (
        <button onClick={() => setStep('preview')} disabled={orderedSlugs.length === 0} style={primaryBtn(orderedSlugs.length === 0)}>
          Suivant : configurer →
        </button>
      )}
      {step === 'preview' && (
        <button onClick={handleExport} disabled={orderedSlugs.length === 0 || fields.length === 0} style={primaryBtn(orderedSlugs.length === 0 || fields.length === 0)}>
          Exporter le PDF →
        </button>
      )}
    </div>
  );

  return (
    <div>
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
            actionBanner={actionBanner}
            filtered={filtered}
            selection={selection}
            toggleSelect={toggleSelect}
            selectAllFiltered={selectAllFiltered}
            clearSelection={clearSelection}
            search={search} setSearch={setSearch}
            poles={poles} selectedPoles={selectedPoles} togglePole={togglePole} setSelectedPoles={setSelectedPoles}
            allStatuts={allStatuts} selectedStatuts={selectedStatuts} toggleStatut={toggleStatut}
            rehabNeufOptions={rehabNeufOptions} selectedRehabNeuf={selectedRehabNeuf} toggleRehabNeuf={toggleRehabNeuf} setSelectedRehabNeuf={setSelectedRehabNeuf}
            programmes={programmes} selectedProgrammes={selectedProgrammes} toggleProgramme={toggleProgramme} setSelectedProgrammes={setSelectedProgrammes}
            materiauxOptions={materiauxOptions} selectedMateriaux={selectedMateriaux} toggleMateriaux={toggleMateriaux} setSelectedMateriaux={setSelectedMateriaux}
            yearMin={yearMin} yearMax={yearMax} setYearMin={setYearMin} setYearMax={setYearMax} years={years}
            btn={btn}
          />
        )}

        {step === 'order' && (
          <>
            {actionBanner}
            <OrderStep
              orderedSlugs={orderedSlugs}
              projetsBySlug={projetsBySlug}
              moveItem={moveItem}
              removeFromOrder={removeFromOrder}
            />
          </>
        )}

        {step === 'preview' && (
          <>
          {actionBanner}
          <PreviewStep
            html={previewHtml}
            orientation={orientation}
            setOrientation={setOrientation}
            mode={mode}
            setMode={changeMode}
            fields={fields}
            toggleField={toggleField}
            orderedProjets={orderedProjets}
            autoRowsPerPage={autoRowsPerPage}
            setAutoRowsPerPage={setAutoRowsPerPage}
            paginationAttempts={paginationAttempts}
            setPaginationAttempts={setPaginationAttempts}
            champLibreNom={champLibreConfigured ? champLibreNom : ''}
            openChampLibreModal={() => setShowChampLibreModal(true)}
          />
          </>
        )}

        {showChampLibreModal && (
          <ChampLibreModal
            orderedProjets={orderedProjets}
            initialNom={champLibreNom}
            initialValues={champLibreValues}
            onCancel={() => setShowChampLibreModal(false)}
            onConfirm={confirmChampLibre}
          />
        )}
      </div>
    </div>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 20px',
    background: disabled ? '#666' : 'var(--ai-rouge)',
    color: 'white', border: 'none', borderRadius: 8,
    fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    letterSpacing: '0.05em',
  };
}

// ─── Étape 1 : sélection ────────────────────────────────────────────────────
interface SelectStepProps {
  actionBanner: React.ReactNode;
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
  rehabNeufOptions: string[];
  selectedRehabNeuf: Set<string>;
  toggleRehabNeuf: (v: string) => void;
  setSelectedRehabNeuf: (s: Set<string>) => void;
  programmes: string[];
  selectedProgrammes: Set<string>;
  toggleProgramme: (v: string) => void;
  setSelectedProgrammes: (s: Set<string>) => void;
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
          border: `1px solid ${color.gris}`, borderRadius: 8, outline: 'none', background: 'white', marginBottom: 16,
        }}
      />
      {/* Filtres — layout aligné sur la page publique :
          Row 1 : Pôle · Statut · Type
          Row 2 : Programme (pleine largeur)
          Row 3 : Matériaux (gauche, flex) · Année slider (droite) */}
      <div style={{ background: 'white', border: `1px solid ${color.gris}`, borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div>
          <div style={chipLabel}>Pôle</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => p.setSelectedPoles(new Set())} style={p.btn(p.selectedPoles.size === 0)}>Tous</button>
            {p.poles.map(c => (
              <button key={c} onClick={() => p.togglePole(c)} style={p.btn(p.selectedPoles.has(c))}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={chipLabel}>Statut</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {p.allStatuts.map(s => (
              <button key={s} onClick={() => p.toggleStatut(s)} style={{
                ...p.btn(p.selectedStatuts.has(s)),
                background: p.selectedStatuts.has(s) ? STATUT_BG[s] : 'white',
                color: p.selectedStatuts.has(s) ? STATUT_COLOR[s] : 'var(--ai-noir70)',
                border: p.selectedStatuts.has(s) ? `1px solid ${STATUT_COLOR[s]}` : `1px solid ${color.gris}`,
              }}>{s}</button>
            ))}
          </div>
        </div>

        {p.rehabNeufOptions.length > 0 && (
          <div>
            <div style={chipLabel}>Type</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => p.setSelectedRehabNeuf(new Set())} style={p.btn(p.selectedRehabNeuf.size === 0)}>Tous</button>
              {p.rehabNeufOptions.map(v => (
                <button key={v} onClick={() => p.toggleRehabNeuf(v)} style={p.btn(p.selectedRehabNeuf.has(v))}>{v}</button>
              ))}
            </div>
          </div>
        )}

        {p.programmes.length > 0 && (
          <div style={{ flex: '1 1 100%' }}>
            <div style={chipLabel}>Programme</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => p.setSelectedProgrammes(new Set())} style={p.btn(p.selectedProgrammes.size === 0)}>Tous</button>
              {p.programmes.map(v => (
                <button key={v} onClick={() => p.toggleProgramme(v)} style={p.btn(p.selectedProgrammes.has(v))}>{v}</button>
              ))}
            </div>
          </div>
        )}

        {(p.materiauxOptions.length > 0 || p.years.min < p.years.max) && (
          <div style={{ flex: '1 1 100%', display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {p.materiauxOptions.length > 0 && (
              <div style={{ flex: '1 1 auto', minWidth: 240 }}>
                <div style={chipLabel}>Matériaux</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button onClick={() => p.setSelectedMateriaux(new Set())} style={p.btn(p.selectedMateriaux.size === 0)}>Tous</button>
                  {p.materiauxOptions.map(v => (
                    <button key={v} onClick={() => p.toggleMateriaux(v)} style={p.btn(p.selectedMateriaux.has(v))}>{v}</button>
                  ))}
                </div>
              </div>
            )}
            {p.years.min < p.years.max && (
              <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
                <div style={chipLabel}>Année de livraison</div>
                <RangeSlider
                  min={p.years.min} max={p.years.max}
                  valueMin={p.yearMin} valueMax={p.yearMax}
                  onChange={(mn, mx) => { p.setYearMin(mn); p.setYearMax(mx); }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bandeau d'action — déplacé ici depuis le bas de page (accès instinctif). */}
      {p.actionBanner}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', fontSize: '9pt', color: 'var(--ai-noir70)' }}>
        <button onClick={p.selectAllFiltered} style={p.btn(false)}>Tout sélectionner ({p.filtered.length})</button>
        <button onClick={p.clearSelection} style={p.btn(false)}>Tout désélectionner</button>
        <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{p.selection.size} sélectionnée{p.selection.size > 1 ? 's' : ''}</span>
      </div>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {p.filtered.map((projet, i) => {
          const isSelected = p.selection.has(projet.slug);
          return (
            <div key={projet.slug} style={{
              display: 'grid', gridTemplateColumns: '32px 56px 1fr 100px 80px',
              gap: 12, alignItems: 'center', padding: '10px 16px',
              borderBottom: i < p.filtered.length - 1 ? `1px solid ${color.gris}` : 'none',
              background: isSelected ? '#FFF5F5' : 'white',
            }}>
              <input type="checkbox" checked={isSelected} onChange={() => p.toggleSelect(projet.slug)}
                style={{ cursor: 'pointer', width: 16, height: 16, accentColor: color.rouge }} />
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
    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {orderedSlugs.map((slug, i) => {
        const projet = projetsBySlug.get(slug);
        if (!projet) return null;
        const isFirst = i === 0;
        const isLast = i === orderedSlugs.length - 1;
        return (
          <div key={slug} style={{
            display: 'grid', gridTemplateColumns: '36px 28px 56px 1fr 100px 80px 28px',
            gap: 12, alignItems: 'center', padding: '10px 16px',
            borderBottom: i < orderedSlugs.length - 1 ? `1px solid ${color.gris}` : 'none',
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
              style={{ padding: '4px 6px', fontSize: '10pt', lineHeight: 1, border: `1px solid ${color.gris}`, borderRadius: 8, background: 'white', color: 'var(--ai-noir70)', cursor: 'pointer' }}>✕</button>
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
    border: `1px solid ${color.gris}`, borderRadius: 8, background: 'white',
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
  orderedProjets: Projet[];
  autoRowsPerPage: number | null;
  setAutoRowsPerPage: React.Dispatch<React.SetStateAction<number | null>>;
  paginationAttempts: number;
  setPaginationAttempts: React.Dispatch<React.SetStateAction<number>>;
  champLibreNom: string;
  openChampLibreModal: () => void;
}
function PreviewStep({
  html, orientation, setOrientation, mode, setMode, fields, toggleField,
  orderedProjets, autoRowsPerPage, setAutoRowsPerPage,
  paginationAttempts, setPaginationAttempts,
  champLibreNom, openChampLibreModal,
}: PreviewStepProps) {
  // Affiche les colonnes dans l'ordre canonique du mode pour que la liste de
  // checkboxes corresponde à l'ordre du tableau rendu. "Lieu" reste à sa
  // place canonique (juste avant "Année").
  const orderedFieldDefs = TABLEAU_ORDER_BY_MODE[mode]
    .map(k => TABLEAU_FIELDS.find(f => f.key === k))
    .filter((f): f is typeof TABLEAU_FIELDS[number] => Boolean(f));
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [overflow, setOverflow] = useState<OverflowMeasure | null>(null);
  // Nombre de `.page` actuellement rendues dans l'iframe — sert à ajuster la
  // hauteur du conteneur iframe quand l'auto-pagination produit plusieurs A4.
  const [pageCount, setPageCount] = useState(1);
  // Largeur dispo pour l'aperçu (colonne 1fr de la grille) — mesurée pour
  // scaler l'A4 à la largeur restante : le menu reste aligné à gauche sur le
  // bandeau, la fin de l'A4 s'aligne sur la fin du bandeau, et tout reste
  // visible à 100% de zoom quelle que soit la largeur d'écran.
  const mainRef = useRef<HTMLDivElement>(null);
  const [mainWidth, setMainWidth] = useState(0);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const update = () => setMainWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Limite stricte sur le nombre d'itérations pour converger sur un
  // rowsPerPage qui rentre — évite toute boucle infinie en cas d'overflow
  // résiduel inexplicable (ex. ligne unique trop haute pour une A4).
  const MAX_PAGINATION_ATTEMPTS = 8;

  // Direction-lock : empêche d'osciller entre +1 et -1 quand on est sur la
  // bonne valeur à 1 ligne près. Réinitialisé via le useEffect en aval.
  const paginationDirection = useRef<null | 'down' | 'up'>(null);

  // Reset du direction-lock quand le parent réinitialise la pagination
  // (changement orientation / mode / colonnes / champ libre…).
  useEffect(() => {
    if (autoRowsPerPage === null && paginationAttempts === 0) {
      paginationDirection.current = null;
    }
  }, [autoRowsPerPage, paginationAttempts]);

  // ----- Mesure + auto-pagination paysage (effet unique) -----
  // Critique : la décision de pagination doit se faire DANS le même cycle
  // async que la mesure pour éviter la cascade de re-renders synchrones
  // sur un state `overflow` périmé. À chaque changement de `html` :
  //   1. iframe se recharge
  //   2. on attend `load` + fonts.ready + 2× rAF (DOM stabilisé)
  //   3. on mesure overflow + métriques DOM directes (hauteur ligne, etc.)
  //   4. on décide : décrémenter / incrémenter / accepter / stop
  //   5. setState → re-render → html change → cycle recommence avec un
  //      DOM RÉACTUALISÉ
  // Plus de bug de "fitRows lu sur l'ancien DOM avant que l'iframe ait
  // rechargé".
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;

    async function measureAndPaginate() {
      try {
        const doc = iframe?.contentDocument;
        if (!doc) return;
        try { await doc.fonts?.ready; } catch { /* noop */ }
        if (cancelled) return;

        requestAnimationFrame(() => {
          if (cancelled) return;
          requestAnimationFrame(() => {
            if (cancelled) return;

            // 1. Mesures DOM toujours faites (utilisé partout y compris pour
            //    afficher le warning + le compteur de pages).
            const m = measureOverflow(doc);
            setOverflow(m);
            const pages = doc.querySelectorAll('.tab-page').length;
            setPageCount(Math.max(1, pages));

            // 2. Décision pagination — paysage uniquement, limites de garde.
            if (!m) return;
            if (orientation !== 'paysage') return;
            if (paginationAttempts >= MAX_PAGINATION_ATTEMPTS) return;
            const N = orderedProjets.length;
            if (N <= 1) return;

            const firstPage = doc.querySelector<HTMLElement>('.tab-page');
            const tbody = firstPage?.querySelector<HTMLElement>('tbody');
            if (!firstPage || !tbody) return;
            const rows = tbody.querySelectorAll<HTMLElement>('tr');
            if (rows.length === 0) return;

            const tbodyHeight = tbody.getBoundingClientRect().height;
            const avgRowHeight = tbodyHeight / rows.length;
            if (avgRowHeight <= 0) return;
            const pageHeight = firstPage.clientHeight;
            const scrollHeight = firstPage.scrollHeight;
            // Non-tbody (titre + thead + footer + paddings + spacer-collapsed).
            // En cas d'overflow le spacer fait 0 ; sans overflow il remplit.
            const nonBodyHeight = scrollHeight - tbodyHeight;
            const availableForBody = pageHeight - nonBodyHeight;
            if (availableForBody <= 0) return;

            const fitRows = Math.max(1, Math.floor(availableForBody / avgRowHeight));

            if (m.overflowMm > 0) {
              // Encore en débordement → réduire.
              if (paginationDirection.current === 'up') {
                // On venait d'incrémenter, ça déborde → revenir en arrière + stop.
                if (autoRowsPerPage && autoRowsPerPage > 1) {
                  setAutoRowsPerPage(autoRowsPerPage - 1);
                }
                setPaginationAttempts(MAX_PAGINATION_ATTEMPTS);
                return;
              }
              paginationDirection.current = 'down';
              if (autoRowsPerPage === null) {
                // 1re passe : mesure DOM précise. On clamp à N-1 pour
                // garantir qu'il y a effectivement chunking (sinon
                // chunkSize >= N → pas de pagination → boucle infinie).
                const target = Math.min(fitRows, N - 1);
                setAutoRowsPerPage(Math.max(1, target));
              } else if (autoRowsPerPage > 1) {
                setAutoRowsPerPage(autoRowsPerPage - 1);
              }
              setPaginationAttempts(c => c + 1);
            } else if (autoRowsPerPage !== null) {
              // Pas d'overflow → reste-t-il de la place ? Mesure du spacer.
              const spacer = firstPage.querySelector<HTMLElement>('.tab-spacer');
              const spacerHeight = spacer ? spacer.getBoundingClientRect().height : 0;
              if (spacerHeight > avgRowHeight && paginationDirection.current !== 'down') {
                paginationDirection.current = 'up';
                setAutoRowsPerPage(autoRowsPerPage + 1);
                setPaginationAttempts(c => c + 1);
              }
            }
            // Cas autoRowsPerPage === null && pas d'overflow : tout tient
            // sur 1 page, rien à faire.
            void fitRows;
          });
        });
      } catch { /* noop */ }
    }

    function onLoad() { measureAndPaginate(); }
    iframe.addEventListener('load', onLoad);
    // On NE PAS appeler measureAndPaginate() immédiatement : sur changement
    // de srcDoc, l'iframe est encore en "loading" et son contentDocument
    // reflète l'ancien DOM. Le check `readyState === 'complete'` est
    // également piégé car il peut renvoyer true pour l'ancienne srcDoc juste
    // avant que la nouvelle ne commence à charger. Seul l'event `load`
    // garantit qu'on mesure le DOM correspondant au state React courant.
    return () => { cancelled = true; iframe.removeEventListener('load', onLoad); };
  }, [html, orientation, orderedProjets.length, autoRowsPerPage, paginationAttempts, setAutoRowsPerPage, setPaginationAttempts]);

  // L'overflow visuel n'est "réel" que si l'auto-pagination n'a pas réussi
  // (paginationAttempts >= MAX). Sinon on est en cours de convergence et le
  // warning rouge clignoterait à chaque itération — on l'attend stabilisé.
  const stillOverflowing = overflow !== null
    && overflow.overflowMm > 0
    && (orientation !== 'paysage' || paginationAttempts >= MAX_PAGINATION_ATTEMPTS);
  const paginated = orientation === 'paysage' && autoRowsPerPage !== null && pageCount > 1;
  const previewWidthMm = orientation === 'paysage' ? 297 : 210;
  const previewHeightMm = orientation === 'paysage' ? 210 : 297;
  // mm → px (96 DPI) puis facteur d'échelle pour faire tenir l'A4 dans la
  // largeur dispo (jamais d'agrandissement : scale ≤ 1).
  const previewWidthPx = (previewWidthMm * 96) / 25.4;
  const previewHeightPx = (previewHeightMm * 96) / 25.4;
  const scale = mainWidth > 0 ? Math.min(1, mainWidth / previewWidthPx) : 1;
  const scaledWidthPx = previewWidthPx * scale;
  const scaledHeightPx = previewHeightPx * pageCount * scale;

  return (
    // Grille menu (260px) + aperçu (1fr) : le menu reste collé au bord gauche
    // du conteneur, aligné sur le début du bandeau. L'aperçu A4 est scalé pour
    // tenir dans la colonne 1fr (cf. `scale`), donc sa fin s'aligne sur la fin
    // du bandeau sans déborder.
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
      {/* Sidebar config */}
      <aside style={{ position: 'sticky', top: 16, alignSelf: 'start', background: 'white', border: `1px solid ${color.gris}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 8 }}>Mode</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
          {(['Str-Env', 'Dev'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '6px 0', fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
                border: mode === m ? 'none' : `1px solid ${color.gris}`,
                background: mode === m ? 'var(--ai-rouge)' : 'white',
                color: mode === m ? 'white' : 'var(--ai-noir70)',
                cursor: 'pointer', borderRadius: 8,
              }}>{m}</button>
          ))}
        </div>
        <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 8 }}>Orientation</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
          {(['paysage', 'portrait'] as const).map(o => (
            <button key={o} onClick={() => setOrientation(o)}
              style={{
                flex: 1, padding: '6px 0', fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
                border: orientation === o ? 'none' : `1px solid ${color.gris}`,
                background: orientation === o ? 'var(--ai-rouge)' : 'white',
                color: orientation === o ? 'white' : 'var(--ai-noir70)',
                cursor: 'pointer', borderRadius: 8, textTransform: 'capitalize',
              }}>{o}</button>
          ))}
        </div>
        <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 8 }}>Colonnes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {orderedFieldDefs.map(f => {
            const checked = fields.includes(f.key);
            const isChampLibre = f.key === 'champLibre';
            // Label dynamique pour le champ libre : on affiche le nom choisi
            // par l'utilisateur quand il est configuré, sinon le label statique.
            const displayLabel = isChampLibre && champLibreNom
              ? champLibreNom
              : f.label;
            return (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '9pt', padding: '2px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleField(f.key)}
                    style={{ accentColor: color.rouge }} />
                  <span>
                    {displayLabel}
                    {isChampLibre && champLibreNom && (
                      <span style={{ color: 'var(--ai-noir70)', fontStyle: 'italic', fontSize: '8pt' }}> (champ libre)</span>
                    )}
                  </span>
                </label>
                {isChampLibre && (
                  <button
                    onClick={openChampLibreModal}
                    title="Configurer le champ libre"
                    style={{
                      padding: '2px 6px', fontSize: '7.5pt', fontWeight: 700,
                      background: 'white', border: `1px solid ${color.gris}`, borderRadius: 8,
                      color: 'var(--ai-noir70)', cursor: 'pointer',
                    }}
                  >
                    {champLibreNom ? 'Éditer' : 'Configurer'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>
      {/* Preview — minWidth:0 pour que la colonne 1fr puisse rétrécir ; l'A4
          est aligné à gauche dans la colonne (sa fin = fin de colonne = fin
          du bandeau quand scale<1). */}
      <main ref={mainRef} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {stillOverflowing && (
          <div role="alert" style={{
            width: scaledWidthPx, marginBottom: 12, padding: '10px 16px', boxSizing: 'border-box',
            background: 'var(--ai-rouge)', color: 'white', fontFamily: 'var(--sans)',
            fontSize: '9pt', fontWeight: 600, borderRadius: 8,
          }}>
            Le tableau dépasse la page de {overflow!.overflowMm} mm — réduit le nombre de lignes/colonnes ou bascule en {orientation === 'portrait' ? 'paysage' : 'portrait'}.
          </div>
        )}
        {paginated && (
          <div style={{
            width: scaledWidthPx, marginBottom: 12, padding: '8px 14px', boxSizing: 'border-box',
            background: 'var(--ai-violet)', color: 'white', fontFamily: 'var(--sans)',
            fontSize: '9pt', fontWeight: 600, borderRadius: 8,
          }}>
            Tableau réparti automatiquement sur {pageCount} pages ({autoRowsPerPage} lignes par page).
          </div>
        )}
        {/* Wrapper dimensionné à la taille scalée ; l'iframe garde sa taille A4
            réelle (px) et n'est réduite que visuellement via transform → la
            mesure d'overflow/pagination lit toujours le vrai DOM A4. */}
        <div style={{
          width: scaledWidthPx, height: scaledHeightPx, background: 'white',
          boxShadow: stillOverflowing
            ? '0 4px 24px rgba(227,5,19,0.35), 0 0 0 2px var(--ai-rouge)'
            : '0 4px 24px rgba(0,0,0,0.12)',
        }}>
          <iframe
            ref={iframeRef}
            title="Aperçu tableau"
            srcDoc={html}
            style={{
              width: previewWidthPx,
              // Hauteur dimensionnée selon le nb de pages auto-paginées. Les
              // pages sont rendues flush (pas de gap) dans la preview iframe.
              height: previewHeightPx * pageCount,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              border: 'none', background: 'white', display: 'block',
            }}
          />
        </div>
      </main>
    </div>
  );
}

// ─── Modal "Champ libre" ────────────────────────────────────────────────────
// Configuration en une étape : nom de colonne + description par référence.
// Tant que l'utilisateur n'a pas cliqué sur "Confirmer", la colonne n'apparaît
// pas dans le tableau (cf. champLibreConfigured / fields dans le parent).
interface ChampLibreModalProps {
  orderedProjets: Projet[];
  initialNom: string;
  initialValues: Record<string, string>;
  onCancel: () => void;
  onConfirm: (nom: string, values: Record<string, string>) => void;
}
function ChampLibreModal({
  orderedProjets, initialNom, initialValues, onCancel, onConfirm,
}: ChampLibreModalProps) {
  const [nom, setNom] = useState(initialNom);
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  const trimmedNom = nom.trim();
  const canConfirm = trimmedNom.length > 0;

  function updateValue(slug: string, v: string) {
    setValues(prev => ({ ...prev, [slug]: v }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, width: '100%',
          maxWidth: 720, maxHeight: '90vh', display: 'flex',
          flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
          fontFamily: 'var(--sans)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${color.gris}` }}>
          <h2 style={{ margin: 0, fontSize: '14pt', fontWeight: 500, color: 'var(--ai-violet)' }}>
            Configurer la colonne « Champ libre »
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '9pt', color: 'var(--ai-noir70)' }}>
            Nomme la colonne puis renseigne une description par référence sélectionnée.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ display: 'block', fontSize: '8pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>
              Nom du champ
            </span>
            <input
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              autoFocus
              placeholder="ex. Lot Assemblage, Particularités…"
              style={{
                width: '100%', padding: '8px 12px', fontSize: '10pt',
                border: `1px solid ${color.gris}`, borderRadius: 8, outline: 'none',
                fontFamily: 'var(--sans)',
              }}
            />
          </label>

          <div style={{ fontSize: '8pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 8 }}>
            Descriptions par référence ({orderedProjets.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orderedProjets.map((p, i) => (
              <div key={p.slug} style={{
                border: `1px solid ${color.gris}`, borderRadius: 8, padding: 10,
                background: '#FAFAFA',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: '11pt', fontWeight: 700, color: 'var(--ai-rouge)' }}>{i + 1}.</span>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: '11pt', fontWeight: 500 }}>{p.nom}</span>
                  {p.moa && <span style={{ fontSize: '8pt', color: 'var(--ai-noir70)' }}>· {p.moa}</span>}
                </div>
                <textarea
                  value={values[p.slug] ?? ''}
                  onChange={e => updateValue(p.slug, e.target.value)}
                  rows={3}
                  placeholder="Description pour cette référence…"
                  style={{
                    width: '100%', padding: '8px 10px', fontSize: '9.5pt',
                    border: `1px solid ${color.gris}`, borderRadius: 8, outline: 'none',
                    resize: 'vertical', fontFamily: 'var(--sans)',
                    minHeight: 60,
                  }}
                />
              </div>
            ))}
            {orderedProjets.length === 0 && (
              <p style={{ fontSize: '9pt', color: 'var(--ai-noir70)', fontStyle: 'italic' }}>
                Aucune référence sélectionnée — retourne à l&apos;étape de sélection.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${color.gris}`,
          display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFAFA',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', background: 'white', color: 'var(--ai-noir70)',
              border: `1px solid ${color.gris}`, borderRadius: 8,
              fontFamily: 'var(--sans)', fontSize: '9.5pt', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(trimmedNom, values)}
            disabled={!canConfirm}
            style={{
              padding: '8px 18px',
              background: canConfirm ? 'var(--ai-rouge)' : '#999',
              color: 'white', border: 'none', borderRadius: 8,
              fontFamily: 'var(--sans)', fontSize: '9.5pt', fontWeight: 700,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              letterSpacing: '0.03em',
            }}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
