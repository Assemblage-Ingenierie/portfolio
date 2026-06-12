'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Projet, Statut, TemplateChoice } from '@/types/projet';
import { TEMPLATE_OPTIONS } from '@/types/projet';
import { autoSelectTemplate } from '@/lib/pdf/selectTemplate';
import { RangeSlider } from './RangeSlider';
import { color } from '@/lib/ui/tokens';

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

interface Props { projets: Projet[]; }

export default function PortfolioBuilder({ projets }: Props) {
  // ----- État de sélection -----
  // Map slug → template choisi pour cette fiche
  const [selection, setSelection] = useState<Map<string, TemplateChoice>>(new Map());
  // Étape du workflow : 'select' = filtrage + cases à cocher, 'order' = ordre
  // de la mise en page. On bascule via le bouton "Suivant →" de la barre
  // sticky. Retour possible via "← Modifier la sélection" depuis l'étape 2.
  const [step, setStep] = useState<'select' | 'order'>('select');
  // Ordre de mise en page (slugs). Initialisé en entrant dans l'étape 'order'.
  // Les flèches haut/bas réorganisent ce tableau ; l'export l'utilise tel quel.
  const [orderedSlugs, setOrderedSlugs] = useState<string[]>([]);
  // Pop-up de choix d'export : page de garde + sommaire, ou fiches seules.
  const [showExportModal, setShowExportModal] = useState(false);

  // ----- Filtres (mêmes que la grille principale) -----
  const years = useMemo(() => {
    const ys = projets.map(p => p.anneeLivraison).filter((y): y is number => !!y);
    return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : { min: 0, max: 0 };
  }, [projets]);
  // Source : champ multi-select Airtable "Vignette pôle". Ordre canonique
  // STR · ENV · DEV puis alphabétique.
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
  // Matériaux : valeurs disponibles dans les projets (multi-select AND).
  const materiauxOptions = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => (p.materiaux ?? []).forEach(v => { if (v) set.add(v); }));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projets]);
  // Type Neuf/Réhab : multi-select AND, valeurs depuis le multi-select Airtable.
  const rehabNeufOptions = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => (p.rehabNeufValues ?? []).forEach(v => { if (v) set.add(v); }));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projets]);
  const programmes = useMemo(() => {
    const set = new Set<string>();
    projets.forEach(p => {
      const list = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
      list.forEach(v => { if (v) set.add(v); });
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projets]);
  // Ordre demandé : Livré · Concours · En chantier · En pause · En étude · En consultation.
  // "Abandonné" omis volontairement du filtre (reste dans le type pour compat).
  const allStatuts: Statut[] = ['Livré', 'Concours', 'En chantier', 'En pause', 'En étude', 'En consultation'];

  const [search, setSearch] = useState('');
  // Type Neuf/Réhab : multi-sélection cumulable, AND. Set vide = "Tous".
  const [selectedRehabNeuf, setSelectedRehabNeuf] = useState<Set<string>>(new Set());
  const [selectedStatuts, setSelectedStatuts] = useState<Set<Statut>>(new Set());
  // Pôles : multi-sélection cumulable, AND (intersection). Set vide = "Tous".
  const [selectedPoles, setSelectedPoles] = useState<Set<string>>(new Set());
  // Programmes : multi-sélection cumulable, OR. Set vide = "Tous".
  const [selectedProgrammes, setSelectedProgrammes] = useState<Set<string>>(new Set());
  // Matériaux : multi-sélection cumulable, AND. Set vide = "Tous".
  const [selectedMateriaux, setSelectedMateriaux] = useState<Set<string>>(new Set());
  const [yearMin, setYearMin] = useState(years.min);
  const [yearMax, setYearMax] = useState(years.max);

  const toggleStatut = (s: Statut) => {
    setSelectedStatuts(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projets.filter(p => {
      if (q) {
        const fields = [p.nom, p.affaire, p.adresse, p.moa, p.architecte, p.pole, p.programme, p.description];
        // Filtre par type — un champ Airtable non-string ferait crasher `.toLowerCase()`.
        if (!fields.some(v => typeof v === 'string' && v.toLowerCase().includes(q))) return false;
      }
      // Type Neuf/Réhab : AND — le projet doit avoir TOUTES les valeurs cochées.
      if (selectedRehabNeuf.size > 0) {
        const vals = (p.rehabNeufValues ?? []).map(v => v.toLowerCase());
        for (const sel of selectedRehabNeuf) {
          if (!vals.includes(sel.toLowerCase())) return false;
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
        for (const code of selectedPoles) {
          if (!projetPoles.has(code)) return false;
        }
      }
      if (selectedProgrammes.size > 0) {
        const projetProgs = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
        if (!projetProgs.some(v => selectedProgrammes.has(v))) return false;
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
  }, [projets, search, selectedRehabNeuf, selectedStatuts, selectedPoles, selectedProgrammes, selectedMateriaux, yearMin, yearMax]);

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

  // ----- Étapes -----
  function goToOrderStep() {
    if (selection.size === 0) return;
    // Ordre initial : ordre d'affichage filtré (plus intuitif que l'ordre des
    // clics). On ne garde que les slugs sélectionnés. Les fiches qui auraient
    // pu sortir du filtre courant mais restent sélectionnées sont appendées.
    const filteredSelected = filtered
      .filter(p => selection.has(p.slug))
      .map(p => p.slug);
    const remaining = [...selection.keys()].filter(s => !filteredSelected.includes(s));
    setOrderedSlugs([...filteredSelected, ...remaining]);
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
      const next = new Map(prev);
      next.delete(slug);
      return next;
    });
  }

  // ----- Export -----
  // Ouvre la fenêtre d'impression.
  //  - includeCover = false → uniquement les fiches (cover=0, sans page de
  //    garde ni sommaire).
  //  - includeCover = true → page de garde + sommaire + fiches. `variant`
  //    (STR/ENV/DEV) choisit la photo de couverture de la page de garde.
  function runExport(includeCover: boolean, variant?: 'STR' | 'ENV' | 'DEV') {
    if (orderedSlugs.length === 0) return;
    const ordered = orderedSlugs
      .filter(s => selection.has(s))
      .map(s => `${s}:${selection.get(s)}`);
    let params = `items=${encodeURIComponent(ordered.join(','))}`;
    if (!includeCover) params += '&cover=0';
    else if (variant) params += `&pdg=${variant}`;
    setShowExportModal(false);
    window.open(`/portfolio/print?${params}`, '_blank');
  }

  const projetsBySlug = useMemo(() => {
    const m = new Map<string, Projet>();
    projets.forEach(p => m.set(p.slug, p));
    return m;
  }, [projets]);

  // ----- Styles -----
  const chipLabel: React.CSSProperties = {
    fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6,
  };
  const btn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: '6px', cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    border: active ? 'none' : `1px solid ${color.gris}`,
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
            {step === 'select'
              ? 'Étape 1/2 — Filtre les références, sélectionne celles à inclure et choisis leur template d’impression.'
              : 'Étape 2/2 — Réorganise l’ordre d’apparition dans le portfolio.'}
          </p>
        </header>

        {step === 'select' && (
        <>
        {/* Recherche */}
        <input
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', fontFamily: 'var(--sans)', fontSize: '9pt',
            border: `1px solid ${color.gris}`, borderRadius: '8px', outline: 'none', background: 'white',
            marginBottom: 16,
          }}
        />

        {/* Filtres — layout aligné sur la page publique :
            Row 1 : Pôle · Statut · Type
            Row 2 : Programme (pleine largeur)
            Row 3 : Matériaux (gauche, flex) · Année slider (droite) */}
        <div style={{ background: 'white', border: `1px solid ${color.gris}`, borderRadius: '12px', padding: '14px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <div>
            <div style={chipLabel}>Pôle</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedPoles(new Set())} style={btn(selectedPoles.size === 0)}>Tous</button>
              {poles.map(p => (
                <button key={p} onClick={() => togglePole(p)} style={btn(selectedPoles.has(p))}>{p}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={chipLabel}>Statut</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {allStatuts.map(s => (
                <button key={s} onClick={() => toggleStatut(s)} style={{
                  ...btn(selectedStatuts.has(s)),
                  background: selectedStatuts.has(s) ? STATUT_BG[s] : 'white',
                  color: selectedStatuts.has(s) ? STATUT_COLOR[s] : 'var(--ai-noir70)',
                  border: selectedStatuts.has(s) ? `1px solid ${STATUT_COLOR[s]}` : `1px solid ${color.gris}`,
                }}>{s}</button>
              ))}
            </div>
          </div>

          {rehabNeufOptions.length > 0 && (
            <div>
              <div style={chipLabel}>Type</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => setSelectedRehabNeuf(new Set())} style={btn(selectedRehabNeuf.size === 0)}>Tous</button>
                {rehabNeufOptions.map(v => (
                  <button key={v} onClick={() => toggleRehabNeuf(v)} style={btn(selectedRehabNeuf.has(v))}>{v}</button>
                ))}
              </div>
            </div>
          )}

          {programmes.length > 0 && (
            <div style={{ flex: '1 1 100%' }}>
              <div style={chipLabel}>Programme</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => setSelectedProgrammes(new Set())} style={btn(selectedProgrammes.size === 0)}>Tous</button>
                {programmes.map(p => (
                  <button key={p} onClick={() => toggleProgramme(p)} style={btn(selectedProgrammes.has(p))}>{p}</button>
                ))}
              </div>
            </div>
          )}

          {/* Matériaux (multi-select AND) + Année (slider) sur la même rangée. */}
          {(materiauxOptions.length > 0 || years.min < years.max) && (
            <div style={{ flex: '1 1 100%', display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {materiauxOptions.length > 0 && (
                <div style={{ flex: '1 1 auto', minWidth: 240 }}>
                  <div style={chipLabel}>Matériaux</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button onClick={() => setSelectedMateriaux(new Set())} style={btn(selectedMateriaux.size === 0)}>Tous</button>
                    {materiauxOptions.map(v => (
                      <button key={v} onClick={() => toggleMateriaux(v)} style={btn(selectedMateriaux.has(v))}>{v}</button>
                    ))}
                  </div>
                </div>
              )}
              {years.min < years.max && (
                <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
                  <div style={chipLabel}>Année de livraison</div>
                  <RangeSlider
                    min={years.min} max={years.max}
                    valueMin={yearMin} valueMax={yearMax}
                    onChange={(mn, mx) => { setYearMin(mn); setYearMax(mx); }}
                  />
                </div>
              )}
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
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {filtered.map((projet, i) => {
            const isSelected = selection.has(projet.slug);
            const currentTemplate = selection.get(projet.slug);
            return (
              <div key={projet.slug} style={{
                display: 'grid',
                gridTemplateColumns: '32px 56px 1fr 100px 80px 130px',
                gap: 12, alignItems: 'center', padding: '10px 16px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${color.gris}` : 'none',
                background: isSelected ? '#FFF5F5' : 'white',
              }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(projet)}
                  style={{ cursor: 'pointer', width: 16, height: 16, accentColor: color.rouge }}
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
                    border: `1px solid ${color.gris}`, borderRadius: 8,
                    background: isSelected ? 'white' : color.grisTresClair,
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
        </>
        )}

        {step === 'order' && (
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {orderedSlugs.map((slug, i) => {
              const projet = projetsBySlug.get(slug);
              if (!projet) return null;
              const isFirst = i === 0;
              const isLast = i === orderedSlugs.length - 1;
              const tmpl = selection.get(slug);
              return (
                <div key={slug} style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 28px 56px 1fr 100px 80px 130px 28px',
                  gap: 12, alignItems: 'center', padding: '10px 16px',
                  borderBottom: i < orderedSlugs.length - 1 ? `1px solid ${color.gris}` : 'none',
                  background: 'white',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      onClick={() => moveItem(slug, -1)}
                      disabled={isFirst}
                      aria-label="Monter"
                      style={{
                        padding: '2px 6px', fontSize: '10pt', lineHeight: 1,
                        border: `1px solid ${color.gris}`, borderRadius: 8,
                        background: 'white',
                        color: isFirst ? '#CCC' : 'var(--ai-noir70)',
                        cursor: isFirst ? 'not-allowed' : 'pointer',
                      }}
                    >▲</button>
                    <button
                      onClick={() => moveItem(slug, 1)}
                      disabled={isLast}
                      aria-label="Descendre"
                      style={{
                        padding: '2px 6px', fontSize: '10pt', lineHeight: 1,
                        border: `1px solid ${color.gris}`, borderRadius: 8,
                        background: 'white',
                        color: isLast ? '#CCC' : 'var(--ai-noir70)',
                        cursor: isLast ? 'not-allowed' : 'pointer',
                      }}
                    >▼</button>
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
                  <select
                    value={tmpl ?? ''}
                    onChange={e => setItemTemplate(slug, e.target.value as TemplateChoice)}
                    style={{
                      padding: '4px 6px', fontSize: '8pt', fontFamily: 'var(--sans)',
                      border: `1px solid ${color.gris}`, borderRadius: 8,
                      background: 'white', color: 'var(--ai-noir)', cursor: 'pointer',
                    }}
                  >
                    {TEMPLATE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeFromOrder(slug)}
                    aria-label="Retirer"
                    title="Retirer du portfolio"
                    style={{
                      padding: '4px 6px', fontSize: '10pt', lineHeight: 1,
                      border: `1px solid ${color.gris}`, borderRadius: 8,
                      background: 'white', color: 'var(--ai-noir70)', cursor: 'pointer',
                    }}
                  >✕</button>
                </div>
              );
            })}
            {orderedSlugs.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--ai-noir70)', fontSize: '10pt' }}>
                Aucune référence à ordonner. Retour à l’étape 1 pour en sélectionner.
              </div>
            )}
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
        {step === 'order' && (
          <button
            onClick={() => setStep('select')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8,
              fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Modifier la sélection
          </button>
        )}
        {step === 'select' ? (
          <button
            onClick={goToOrderStep}
            disabled={selection.size === 0}
            style={{
              padding: '10px 20px',
              background: selection.size === 0 ? '#666' : 'var(--ai-rouge)',
              color: 'white', border: 'none', borderRadius: 8,
              fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 700,
              cursor: selection.size === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            Suivant : ordonner →
          </button>
        ) : (
          <button
            onClick={() => setShowExportModal(true)}
            disabled={orderedSlugs.length === 0}
            style={{
              padding: '10px 20px',
              background: orderedSlugs.length === 0 ? '#666' : 'var(--ai-rouge)',
              color: 'white', border: 'none', borderRadius: 8,
              fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 700,
              cursor: orderedSlugs.length === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            Exporter le PDF →
          </button>
        )}
      </div>

      {/* Pop-up de choix d'export */}
      {showExportModal && (
        <div
          onClick={() => setShowExportModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 16, padding: '28px 28px 24px',
              maxWidth: 460, width: '100%',
              boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
              fontFamily: 'var(--sans)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'var(--sans)', fontSize: '13pt', fontWeight: 600, color: 'var(--ai-violet)' }}>
                Exporter le portfolio
              </h2>
              <button
                onClick={() => setShowExportModal(false)}
                aria-label="Fermer"
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: '14pt', lineHeight: 1, color: 'var(--ai-noir70)',
                }}
              >✕</button>
            </div>
            <p style={{ fontSize: '9pt', color: 'var(--ai-noir70)', marginBottom: 18 }}>
              {orderedSlugs.length} référence{orderedSlugs.length > 1 ? 's' : ''} — choisis le format du document à générer.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Option 1 : page de garde + sommaire. La page de garde se
                  décline en 3 variantes (STR/ENV/DEV) — seule la photo change. */}
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                border: `1px solid ${color.gris}`, background: 'white',
              }}>
                <div style={{ fontSize: '10pt', fontWeight: 700, color: 'var(--ai-noir)' }}>
                  Page de garde + sommaire
                </div>
                <div style={{ fontSize: '8.5pt', color: 'var(--ai-noir70)', marginTop: 2, marginBottom: 10 }}>
                  Choisis la page de garde selon le pôle (la photo de couverture change) :
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['STR', 'ENV', 'DEV'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => runExport(true, v)}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8,
                        border: 'none', background: 'var(--ai-rouge)', color: 'white',
                        fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700,
                        letterSpacing: '0.05em', cursor: 'pointer',
                      }}
                    >
                      Page de garde {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 2 : fiches seules. */}
              <button
                onClick={() => runExport(false)}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 10,
                  border: `1px solid ${color.gris}`, background: 'white', cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '10pt', fontWeight: 700, color: 'var(--ai-noir)' }}>
                  Fiches de références uniquement
                </div>
                <div style={{ fontSize: '8.5pt', color: 'var(--ai-noir70)', marginTop: 2 }}>
                  Sans page de garde ni sommaire.
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
