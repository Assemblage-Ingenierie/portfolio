'use client';

import type {
  BandeauConfig, BandeauStyle, BandeauLinesStyle, ProgrammeCellOptions,
  BandeauCellsConfig, CellsLayout, MetaLabel,
  FontFamilyChoice, TextAlignChoice, TextTransformChoice,
} from '@/lib/pdf/bandeauConfig';
import { CANONICAL_META_LABELS } from '@/lib/pdf/bandeauConfig';
import { useViewMode } from '@/lib/auth/useViewMode';
import ColorSelector from './ColorSelector';
import type { Projet } from '@/types/projet';
import { color } from '@/lib/ui/tokens';

interface Props {
  value: BandeauConfig;
  onChange: (next: BandeauConfig) => void;
  /** Projet courant — utilisé uniquement par la section "Sauts de ligne"
   *  pour montrer les valeurs réelles de chaque cellule multi-valeurs. */
  projet?: Projet;
  /** Si fourni, le bouton "Réinitialiser" appelle ce callback (qui doit
   *  appliquer les préréglages Assemblage AUSSI au ManualConfig). Sinon
   *  le bouton fait le comportement legacy : vide juste BandeauConfig. */
  onResetAll?: () => void;
}

/** Valeurs par cellule du bandeau (miroir de la logique de `metaGridHtml`
 *  dans shared.ts), pour toutes les cellules candidates aux sauts de ligne.
 *  Renvoie Map<label, values[]> (≥ 1 valeur). */
function cellValuesFromProjet(projet: Projet | undefined): Map<MetaLabel, string[]> {
  const result = new Map<MetaLabel, string[]>();
  if (!projet) return result;
  const splitCsv = (v: string | undefined): string[] => {
    if (!v) return [];
    return v.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
  };
  // Miroir de `collapseAmoMissionAi` dans shared.ts : si AMO ENV / AMO DEV
  // sont présents on les remplace par un seul "AMO". Les indices de breaks
  // doivent matcher le rendu — d'où la transformation ici aussi.
  const collapseAmo = (values: string[]): string[] => {
    const out: string[] = [];
    let amoInserted = false;
    for (const v of values) {
      if (v === 'AMO ENV' || v === 'AMO DEV') {
        if (!amoInserted) { out.push('AMO'); amoInserted = true; }
        continue;
      }
      out.push(v);
    }
    return out;
  };
  const rawMissionAi = projet.missionAiValues && projet.missionAiValues.length > 0
    ? projet.missionAiValues
    : splitCsv(projet.missionAi);
  const candidates: Array<[MetaLabel, string[]]> = [
    ['MOA',           splitCsv(projet.moa)],
    ['Bailleur',      splitCsv(projet.bailleur)],
    ['Architecte',    splitCsv(projet.architecte)],
    ['BET associés',  splitCsv(projet.betAssocies)],
    ['Entreprise',    splitCsv(projet.entreprise)],
    ['Mission AI',    collapseAmo(rawMissionAi)],
    // Matériaux : multi-select Airtable, exposé dans le bandeau après Programme.
    ['Matériaux',     projet.materiaux ?? []],
  ];
  for (const [label, values] of candidates) {
    if (values.length >= 1) result.set(label, values);
  }
  return result;
}

/** Cellules multi-valeurs (≥ 2 valeurs) — éligibles aux sauts inter-options. */
function multiValueCellsFromProjet(projet: Projet | undefined): Map<MetaLabel, string[]> {
  const result = new Map<MetaLabel, string[]>();
  for (const [label, vals] of cellValuesFromProjet(projet)) {
    if (vals.length >= 2) result.set(label, vals);
  }
  return result;
}

type WordBreakSep = 'none' | 'value' | 'word';
export interface WordBreakModel {
  /** Tokens (mots) de toute la cellule, dans l'ordre, valeurs concaténées. */
  tokens: string[];
  /** Séparateur APRES le token i : 'none' (fin de cellule), 'value' (séparateur
   *  inter-options, géré par `breaks`), 'word' (gap intra-valeur, géré par
   *  `wordBreaks`). Index aligné sur le compteur de token global de `renderValues`. */
  seps: WordBreakSep[];
  /** Indices de token (sep 'word') où l'UI propose un toggle de saut de ligne —
   *  espacés d'environ `WORD_BREAK_MIN_CHARS` caractères (toujours en fin de mot). */
  offerable: Set<number>;
}

/** Seuil de proposition d'un point de coupure intra-valeur (en caractères). */
const WORD_BREAK_MIN_CHARS = 10;

/** Construit le modèle de sauts intra-valeur d'une cellule à partir de ses
 *  valeurs (mêmes valeurs que le rendu). Le compteur de token est global —
 *  cf. `renderValues` dans shared.ts — pour fonctionner sur mono- ET
 *  multi-valeurs. Les points de coupure sont proposés ~tous les 10 caractères. */
function buildWordBreakModel(values: string[]): WordBreakModel {
  const tokens: string[] = [];
  const seps: WordBreakSep[] = [];
  const offerable = new Set<number>();
  let g = 0;
  values.forEach((val, vi) => {
    const toks = val.split(/\s+/).filter(Boolean);
    if (toks.length === 0) return;
    const startG = g;
    let acc = 0;
    let lastWordGapG = -1;
    toks.forEach((t, ti) => {
      tokens.push(t);
      const lastTok = ti === toks.length - 1;
      seps.push(lastTok ? (vi === values.length - 1 ? 'none' : 'value') : 'word');
      acc += t.length + 1;
      if (!lastTok) {
        lastWordGapG = g;
        if (acc >= WORD_BREAK_MIN_CHARS) { offerable.add(g); acc = 0; }
      }
      g++;
    });
    // Garantit au moins un point proposé si la valeur est longue mais qu'aucun
    // gap n'a atteint le seuil (ex. "Encore Heureux" = 1 seul gap à 7 car.).
    const hasOffer = [...offerable].some((idx) => idx >= startG && idx < g);
    if (!hasOffer && lastWordGapG >= 0 && val.length > WORD_BREAK_MIN_CHARS) {
      offerable.add(lastWordGapG);
    }
  });
  return { tokens, seps, offerable };
}

/** Cellules éligibles aux sauts de ligne intra-valeur : ≥ 2 tokens, texte
 *  total > 10 caractères, au moins un gap intra-valeur. Couvre les cellules
 *  mono-valeur longues ET les cellules multi-valeurs (en plus des sauts
 *  inter-options de la section précédente). */
function wordBreakCellsFromProjet(projet: Projet | undefined): Map<MetaLabel, WordBreakModel> {
  const result = new Map<MetaLabel, WordBreakModel>();
  for (const [label, vals] of cellValuesFromProjet(projet)) {
    const model = buildWordBreakModel(vals);
    if (model.tokens.length < 2) continue;
    if (model.tokens.join(' ').length <= 10) continue;
    if (!model.seps.includes('word')) continue;
    result.set(label, model);
  }
  return result;
}

type StyleSectionKey = Exclude<keyof BandeauConfig, 'lines' | 'titleMetaGap' | 'photoTextGap' | 'bandeauPhotoGap' | 'programme' | 'cells' | 'hiddenCells'>;

const SECTIONS: { key: StyleSectionKey; label: string; help: string }[] = [
  { key: 'titre',       label: 'Titre de la fiche',           help: 'Le nom du projet (titre principal h1).' },
  { key: 'status',      label: 'Statut (en haut à droite)',   help: '"● Livré · 2025"' },
  { key: 'missionAi',   label: 'Mission AI (face au lieu)',   help: 'La ligne Mission AI affichée en face du lieu, au-dessus du titre. Templates Str-Env et Dev uniquement.' },
  { key: 'labels',      label: 'Libellés du bandeau',         help: '"Architecte", "Budget", "Surface"…' },
  { key: 'values',      label: 'Valeurs du bandeau',          help: '"Encore Heureux", "8,2 M€ HT", "4 242 m²"…' },
  { key: 'metaSub',     label: 'Sous-titre du Programme',     help: 'La ligne discrète sous "Programme" — affiche le Programme secondaire quand un Programme principal est aussi rempli.' },
  { key: 'description', label: 'Description projet',          help: 'Le texte courant de la fiche (paragraphes Markdown). Appliqué sur tous les templates.' },
  { key: 'prestationAssemblage', label: 'Prestation Assemblage', help: 'Bloc rich text dédié, rendu uniquement par le template Dev (titre + valeur).' },
];

/** Sections typographiques HORS du sous-menu « Bandeau » (titre, statut,
 *  description, prestation). Affichées au premier niveau, admin uniquement. */
const TOP_SECTION_KEYS: StyleSectionKey[] = ['titre', 'status', 'missionAi', 'description', 'prestationAssemblage'];
/** Sections typographiques regroupées DANS le sous-menu « Bandeau » (admin). */
const BANDEAU_SECTION_KEYS: StyleSectionKey[] = ['labels', 'values', 'metaSub'];

const TOP_SECTIONS = SECTIONS.filter((s) => TOP_SECTION_KEYS.includes(s.key));
const BANDEAU_SECTIONS = SECTIONS.filter((s) => BANDEAU_SECTION_KEYS.includes(s.key));

const LABEL_S: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--sans)', fontSize: '7pt', fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)',
  marginBottom: '4px',
};
const INPUT_S: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--sans)', fontSize: '10pt',
  padding: '6px 8px', border: `1px solid ${color.gris}`, borderRadius: '2px',
  background: 'white', outline: 'none',
};
const ROW: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center',
  marginBottom: '6px',
};
const COLOR_INPUT: React.CSSProperties = {
  width: '40px', height: '32px',
  padding: '2px',
  border: `1px solid ${color.gris}`, borderRadius: '2px',
  background: 'white', cursor: 'pointer',
  flex: '0 0 40px',
};
const TOGGLE: React.CSSProperties = {
  padding: '4px 10px', border: `1px solid ${color.gris}`, borderRadius: '2px',
  background: 'white', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: '10pt',
};
const TOGGLE_ON: React.CSSProperties = {
  ...TOGGLE,
  background: 'var(--ai-violet)', color: 'white', borderColor: 'var(--ai-violet)',
};

function StyleRow({ style, onChange }: { style: BandeauStyle; onChange: (s: BandeauStyle) => void }) {
  const set = <K extends keyof BandeauStyle>(k: K, v: BandeauStyle[K]) => onChange({ ...style, [k]: v });

  return (
    <div>
      <div style={ROW}>
        <select
          value={style.fontFamily ?? ''}
          onChange={(e) => set('fontFamily', (e.target.value || undefined) as FontFamilyChoice | undefined)}
          style={{ ...INPUT_S, width: 'auto', flex: '1 1 110px', minWidth: '110px' }}
        >
          <option value="">Police défaut</option>
          <option value="sans">Sans (Open Sans)</option>
          <option value="serif">Serif (Newsreader)</option>
        </select>
        <input
          type="number"
          step="0.5"
          min="6"
          max="24"
          value={style.fontSize ?? ''}
          onChange={(e) => set('fontSize', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Taille (pt)"
          style={{ ...INPUT_S, width: '90px', flex: '0 0 90px' }}
        />
        <div style={{ display: 'flex', gap: '4px', flex: '0 0 auto' }}>
          <button type="button" onClick={() => set('bold', !style.bold)} style={style.bold ? TOGGLE_ON : TOGGLE} title="Gras"><b>B</b></button>
          <button type="button" onClick={() => set('italic', !style.italic)} style={style.italic ? TOGGLE_ON : TOGGLE} title="Italique"><i>I</i></button>
          <button type="button" onClick={() => set('underline', !style.underline)} style={style.underline ? TOGGLE_ON : TOGGLE} title="Souligné"><u>U</u></button>
          <button type="button" onClick={() => set('smallCaps', !style.smallCaps)} style={style.smallCaps ? TOGGLE_ON : TOGGLE} title="Petites capitales (small-caps)"><span style={{ fontVariant: 'small-caps' }}>Ab</span></button>
        </div>
        <div style={{ flex: '1 1 100%', display: 'grid', gridTemplateColumns: '36px 1fr', gap: '4px', alignItems: 'center', fontSize: '8pt', color: 'var(--ai-noir70)' }}>
          <span>Texte</span>
          <ColorSelector value={style.color} onChange={(c) => set('color', c)} customTitle="Couleur de texte personnalisée" />
          <span>Fond</span>
          <ColorSelector
            value={style.background}
            onChange={(c) => set('background', c)}
            fallback={color.blanc}
            customTitle="Couleur de surlignage personnalisée"
            allowNone
          />
        </div>
      </div>

      <AdvancedStyleSection style={style} set={set} />
    </div>
  );
}

/** Réglages typo/spacing avancés repliés dans un menu déroulant.
 *  Ouvert automatiquement si au moins une propriété avancée est définie. */
function AdvancedStyleSection({
  style,
  set,
}: {
  style: BandeauStyle;
  set: <K extends keyof BandeauStyle>(k: K, v: BandeauStyle[K]) => void;
}) {
  const hasAdvanced =
    style.lineHeight !== undefined ||
    style.letterSpacing !== undefined ||
    style.wordSpacing !== undefined ||
    !!style.textAlign || !!style.textTransform ||
    style.marginTop !== undefined ||
    style.marginBottom !== undefined ||
    style.paddingX !== undefined ||
    style.paddingY !== undefined;

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: hasAdvanced ? 'var(--ai-rouge)' : 'var(--ai-noir70)',
    padding: '6px 0',
    userSelect: 'none',
    listStyle: 'none',
  };

  return (
    <details open={hasAdvanced} style={{ marginTop: '4px' }}>
      <summary style={summaryStyle}>
        ▸ Réglages avancés{hasAdvanced ? ' •' : ''}
      </summary>

      {/* Rangée typo fine : interligne, espace lettres/mots, alignement, casse */}
      <div style={{ ...ROW, marginTop: '6px' }}>
        <input
          type="number" step="0.05" min="0.8" max="2.5"
          value={style.lineHeight ?? ''}
          onChange={(e) => set('lineHeight', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Interligne"
          title="Interligne (sans unité). Ex. 1.15 (serré), 1.3 (lecture), 1.5 (aéré)."
          style={{ ...INPUT_S, width: '100px', flex: '0 0 100px' }}
        />
        <input
          type="number" step="0.01" min="-0.1" max="0.4"
          value={style.letterSpacing ?? ''}
          onChange={(e) => set('letterSpacing', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Espace lettres"
          title="Espacement entre lettres. Décimal sans unité. Négatif resserre, positif aère (ex. 0.05 = espacement subtil de type titre)."
          style={{ ...INPUT_S, width: '120px', flex: '0 0 120px' }}
        />
        <input
          type="number" step="0.05" min="-0.2" max="1"
          value={style.wordSpacing ?? ''}
          onChange={(e) => set('wordSpacing', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Espace mots"
          title="Espacement entre mots. Décimal sans unité. Positif aère les espaces entre mots."
          style={{ ...INPUT_S, width: '110px', flex: '0 0 110px' }}
        />
        <select
          value={style.textAlign ?? ''}
          onChange={(e) => set('textAlign', (e.target.value || undefined) as TextAlignChoice | undefined)}
          title="Alignement du texte"
          style={{ ...INPUT_S, width: 'auto', flex: '1 1 110px', minWidth: '110px' }}
        >
          <option value="">Alignement défaut</option>
          <option value="left">Gauche</option>
          <option value="center">Centré</option>
          <option value="right">Droite</option>
          <option value="justify">Justifié</option>
        </select>
        <select
          value={style.textTransform ?? ''}
          onChange={(e) => set('textTransform', (e.target.value || undefined) as TextTransformChoice | undefined)}
          title="Transformation de casse"
          style={{ ...INPUT_S, width: 'auto', flex: '1 1 110px', minWidth: '110px' }}
        >
          <option value="">Casse défaut</option>
          <option value="none">Normale</option>
          <option value="uppercase">MAJUSCULES</option>
          <option value="lowercase">minuscules</option>
          <option value="capitalize">Initiales</option>
        </select>
      </div>

      {/* Rangée spacing : marges externes et marges internes en mm */}
      <div style={ROW}>
        <input
          type="number" step="0.5" min="-20" max="40"
          value={style.marginTop ?? ''}
          onChange={(e) => set('marginTop', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Marge haut (mm)"
          title="Marge extérieure au-dessus du bloc, en mm. Négative pour rapprocher du bloc précédent."
          style={{ ...INPUT_S, width: '140px', flex: '0 0 140px' }}
        />
        <input
          type="number" step="0.5" min="-20" max="40"
          value={style.marginBottom ?? ''}
          onChange={(e) => set('marginBottom', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Marge bas (mm)"
          title="Marge extérieure en-dessous du bloc, en mm."
          style={{ ...INPUT_S, width: '140px', flex: '0 0 140px' }}
        />
        <input
          type="number" step="0.5" min="0" max="20"
          value={style.paddingX ?? ''}
          onChange={(e) => set('paddingX', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Marge interne H (mm)"
          title="Espace intérieur horizontal (gauche + droite), en mm. Utile pour créer un pavé surligné avec un fond coloré."
          style={{ ...INPUT_S, width: '170px', flex: '0 0 170px' }}
        />
        <input
          type="number" step="0.5" min="0" max="20"
          value={style.paddingY ?? ''}
          onChange={(e) => set('paddingY', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Marge interne V (mm)"
          title="Espace intérieur vertical (haut + bas), en mm."
          style={{ ...INPUT_S, width: '170px', flex: '0 0 170px' }}
        />
      </div>
    </details>
  );
}

export { StyleRow };

export default function BandeauConfigPanel({ value, onChange, projet, onResetAll }: Props) {
  const multiValueCells = multiValueCellsFromProjet(projet);
  const wordBreakCells = wordBreakCellsFromProjet(projet);
  // Mode de vue (admin = full UI, user = restreint à Cellules du bandeau +
  // Cellule Programme). Géré dans `lib/auth/useViewMode.ts` ; le toggle est
  // dans la toolbar (visible uniquement pour les profils Supabase admin).
  const { viewMode } = useViewMode();
  const isUserView = viewMode === 'user';
  function updateSection(key: StyleSectionKey, style: BandeauStyle) {
    // Si toutes les propriétés sont vides, on retire la section pour garder
    // la config minimale et utiliser les défauts CSS du template.
    const isEmpty =
      !style.fontFamily &&
      style.fontSize === undefined &&
      !style.bold && !style.italic && !style.underline && !style.smallCaps &&
      !style.color && !style.background &&
      style.lineHeight === undefined &&
      style.letterSpacing === undefined &&
      style.wordSpacing === undefined &&
      !style.textAlign && !style.textTransform &&
      style.marginTop === undefined &&
      style.marginBottom === undefined &&
      style.paddingX === undefined &&
      style.paddingY === undefined;
    const next = { ...value };
    if (isEmpty) {
      delete next[key];
    } else {
      next[key] = style;
    }
    onChange(next);
  }

  function resetAll() {
    // Si le parent fournit un callback complet, on lui delegue : il
    // appliquera les preregages Assemblage au BandeauConfig ET au
    // ManualConfig (cf. lib/pdf/assemblageDefaults.ts). Sinon, comportement
    // historique : on vide juste le BandeauConfig.
    if (onResetAll) onResetAll();
    else onChange({});
  }

  // Handlers extraits (réutilisés dans le sous-menu « Bandeau »).
  const cellsOnChange = (c: BandeauCellsConfig | undefined) => {
    const empty = !c || (
      !c.layout &&
      !c.gap &&
      (!c.weights || Object.keys(c.weights).length === 0) &&
      (!c.breaks || Object.keys(c.breaks).length === 0) &&
      (!c.wordBreaks || Object.keys(c.wordBreaks).length === 0)
    );
    // Reconstruction explicite (nouvelle réf d'objet) — cf. fix du toggle.
    if (empty) {
      const { cells: _omitCells, ...rest } = value;
      void _omitCells;
      onChange(rest);
    } else {
      onChange({ ...value, cells: c });
    }
  };
  const programmeOnChange = (p: ProgrammeCellOptions | undefined) => {
    const next = { ...value };
    if (!p || p.hideSecondaire !== true) delete next.programme;
    else next.programme = p;
    onChange(next);
  };
  const gapOnChange = (key: 'titleMetaGap' | 'photoTextGap' | 'bandeauPhotoGap') => (v: number | undefined) => {
    const next = { ...value };
    if (v === undefined || v === 50) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  const hiddenCellsOnChange = (h: MetaLabel[]) => {
    const next = { ...value };
    if (h.length === 0) delete next.hiddenCells;
    else next.hiddenCells = h;
    onChange(next);
  };

  const renderStyleSection = (s: { key: StyleSectionKey; label: string; help: string }) => (
    <div key={s.key} style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: `1px dotted ${color.gris}` }}>
      <label style={LABEL_S}>{s.label}</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>{s.help}</p>
      <StyleRow style={value[s.key] ?? {}} onChange={(st) => updateSection(s.key, st)} />
    </div>
  );

  const bandeauSummaryStyle: React.CSSProperties = {
    cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8.5pt', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: color.violet, padding: '8px 0',
  };

  return (
    <div>
      {!isUserView && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <p style={{ fontSize: '8pt', color: 'var(--ai-noir70)', margin: 0 }}>
            Surcharges optionnelles. Laisser vide pour utiliser les valeurs par défaut du template.
          </p>
          <button
            type="button"
            onClick={resetAll}
            style={{ ...TOGGLE, fontSize: '8pt' }}
            title={onResetAll
              ? 'Applique les préréglages Assemblage : typographie + bandeau + photo principale + texte + mots-clés + certifications. Écrase la configuration actuelle.'
              : 'Vide la configuration du bandeau.'}
          >
            Réinitialiser
          </button>
        </div>
      )}

      {/* Sections typographiques hors bandeau (titre, statut, description,
          prestation) — admin uniquement, au premier niveau. */}
      {!isUserView && TOP_SECTIONS.map(renderStyleSection)}

      {/* Sous-menu déroulant « Bandeau ». Admin : typo + cellules + lignes +
          espacements + visibilité. User : cellules + espacements + visibilité. */}
      <details open style={{ marginTop: '4px', borderTop: `1px solid ${color.gris}` }}>
        <summary style={bandeauSummaryStyle}>Bandeau</summary>
        <div style={{ paddingTop: '8px' }}>
          {!isUserView && BANDEAU_SECTIONS.map(renderStyleSection)}
          <CellsLayoutRow
            value={value.cells}
            multiValueCells={multiValueCells}
            wordBreakCells={wordBreakCells}
            onChange={cellsOnChange}
          />
          <ProgrammeOptionsRow value={value.programme} onChange={programmeOnChange} />
          {!isUserView && (
            <LinesRow value={value.lines ?? {}} onChange={(l) => onChange({ ...value, lines: l })} />
          )}
          <TitleMetaGapRow value={value.titleMetaGap} onChange={gapOnChange('titleMetaGap')} />
          <PhotoTextGapRow value={value.photoTextGap} onChange={gapOnChange('photoTextGap')} />
          <BandeauPhotoGapRow value={value.bandeauPhotoGap} onChange={gapOnChange('bandeauPhotoGap')} />
          <FieldVisibilityRow hidden={value.hiddenCells ?? []} onChange={hiddenCellsOnChange} />
        </div>
      </details>
    </div>
  );
}

function PhotoTextGapRow({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const v = value ?? 50;
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Espacement photo ↔ description</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Rapproche ou éloigne le bloc Description projet de la photo principale. 50 = défaut, &lt; 50 = rapproché, &gt; 50 = éloigné. Appliqué sur Str-Env et Dev.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <input
          type="range"
          min={0} max={100} step={5}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: '1 1 160px', accentColor: color.rouge }}
        />
        <input
          type="number"
          min={0} max={100} step={1}
          value={v}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(0, Math.min(100, n)));
          }}
          style={{ ...INPUT_S, width: '70px', flex: '0 0 70px', textAlign: 'right' }}
        />
        <button type="button" onClick={() => onChange(undefined)} style={{ ...TOGGLE, fontSize: '8pt' }} title="Réinitialiser à la valeur par défaut">
          Reset
        </button>
      </div>
    </div>
  );
}

function BandeauPhotoGapRow({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const v = value ?? 50;
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Espacement photo ↔ bandeau</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Rapproche ou éloigne la photo principale du bandeau métadonnées. 50 = défaut, &lt; 50 = rapproché, &gt; 50 = éloigné. Appliqué sur Str-Env et Dev.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <input
          type="range"
          min={0} max={100} step={5}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: '1 1 160px', accentColor: color.rouge }}
        />
        <input
          type="number"
          min={0} max={100} step={1}
          value={v}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(0, Math.min(100, n)));
          }}
          style={{ ...INPUT_S, width: '70px', flex: '0 0 70px', textAlign: 'right' }}
        />
        <button type="button" onClick={() => onChange(undefined)} style={{ ...TOGGLE, fontSize: '8pt' }} title="Réinitialiser à la valeur par défaut">
          Reset
        </button>
      </div>
    </div>
  );
}

/** Libellés des cellules dont l'affichage est togglable par l'utilisateur,
 *  pour réduire la largeur du bandeau. */
const TOGGLEABLE_CELLS: MetaLabel[] = ['BET associés', 'Entreprise', 'Budget/Surface', 'Matériaux'];

function FieldVisibilityRow({ hidden, onChange }: { hidden: MetaLabel[]; onChange: (next: MetaLabel[]) => void }) {
  const hiddenSet = new Set(hidden);
  const toggle = (label: MetaLabel) => {
    const next = new Set(hiddenSet);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange([...next]);
  };
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Activer / désactiver les champs</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Masque certains champs du bandeau pour gagner en largeur. Un champ désactivé n&apos;apparaît plus dans la fiche, même s&apos;il est renseigné dans Airtable.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {TOGGLEABLE_CELLS.map((label) => {
          const visible = !hiddenSet.has(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              style={visible ? TOGGLE_ON : TOGGLE}
              title={visible ? `« ${label} » affiché — cliquer pour masquer.` : `« ${label} » masqué — cliquer pour afficher.`}
            >
              {visible ? `✓ ${label}` : `✕ ${label}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TitleMetaGapRow({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const v = value ?? 50;
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Espacement titre ↔ bandeau</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Rapproche ou éloigne le bandeau métadonnées du titre. 50 = défaut, &lt; 50 = rapproché, &gt; 50 = éloigné. Appliqué sur les 4 templates.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <input
          type="range"
          min={0} max={100} step={5}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: '1 1 160px', accentColor: color.rouge }}
        />
        <input
          type="number"
          min={0} max={100} step={1}
          value={v}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(0, Math.min(100, n)));
          }}
          style={{ ...INPUT_S, width: '70px', flex: '0 0 70px', textAlign: 'right' }}
        />
        <button type="button" onClick={() => onChange(undefined)} style={{ ...TOGGLE, fontSize: '8pt' }} title="Réinitialiser à la valeur par défaut">
          Reset
        </button>
      </div>
    </div>
  );
}

function CellsLayoutRow({
  value,
  multiValueCells,
  wordBreakCells,
  onChange,
}: {
  value: BandeauCellsConfig | undefined;
  multiValueCells: Map<MetaLabel, string[]>;
  wordBreakCells: Map<MetaLabel, WordBreakModel>;
  onChange: (v: BandeauCellsConfig | undefined) => void;
}) {
  const layout: CellsLayout = value?.layout ?? 'content';
  const gap = value?.gap;
  const weights: Partial<Record<MetaLabel, number>> = value?.weights ?? {};
  const breaks: Partial<Record<MetaLabel, number[]>> = value?.breaks ?? {};
  const wordBreaks: Partial<Record<MetaLabel, number[]>> = value?.wordBreaks ?? {};

  const setLayout = (next: CellsLayout) => {
    // Pas la peine de persister 'content' (= défaut) si rien d'autre n'est défini.
    const out: BandeauCellsConfig = { ...(value ?? {}) };
    if (next === 'content') delete out.layout;
    else out.layout = next;
    onChange(out);
  };
  const setGap = (next: number | undefined) => {
    const out: BandeauCellsConfig = { ...(value ?? {}) };
    if (next === undefined || !Number.isFinite(next) || next <= 0) delete out.gap;
    else out.gap = next;
    onChange(out);
  };
  const setWeight = (label: MetaLabel, next: number | undefined) => {
    const out: BandeauCellsConfig = { ...(value ?? {}) };
    const nextWeights: Partial<Record<MetaLabel, number>> = { ...weights };
    if (next === undefined || !Number.isFinite(next) || next === 1 || next <= 0) {
      delete nextWeights[label];
    } else {
      nextWeights[label] = next;
    }
    if (Object.keys(nextWeights).length === 0) delete out.weights;
    else out.weights = nextWeights;
    onChange(out);
  };
  /** Toggle un saut de ligne dans une cellule. `store` indique sur quel
   *  champ on agit : 'breaks' (multi-valeur, idx = index de valeur) ou
   *  'wordBreaks' (single-value long, idx = index de token).
   *  Reconstruit toujours un nouvel objet `out` (pas de mutation in-place)
   *  pour garantir que React voit un changement de référence et re-render
   *  l'aperçu. Cf. fix bug "le bandeau ne se met pas à jour quand on
   *  annule le dernier saut de ligne". */
  const toggleBreakIn = (
    store: 'breaks' | 'wordBreaks',
    label: MetaLabel,
    idx: number,
  ) => {
    const source = store === 'breaks' ? breaks : wordBreaks;
    const current = new Set(source[label] ?? []);
    if (current.has(idx)) current.delete(idx);
    else current.add(idx);
    const nextStore: Partial<Record<MetaLabel, number[]>> = { ...source };
    if (current.size === 0) {
      delete nextStore[label];
    } else {
      nextStore[label] = [...current].sort((a, b) => a - b);
    }
    // Reconstruction explicite sans `delete` mutatif. Si le store cible est
    // vide après l'opération, on omet la clé via destructuration.
    const empty = Object.keys(nextStore).length === 0;
    const base: BandeauCellsConfig = { ...(value ?? {}) };
    if (store === 'breaks') {
      const { breaks: _omit, ...rest } = base;
      void _omit;
      onChange(empty ? rest : { ...rest, breaks: nextStore });
    } else {
      const { wordBreaks: _omit, ...rest } = base;
      void _omit;
      onChange(empty ? rest : { ...rest, wordBreaks: nextStore });
    }
  };
  const toggleBreak = (label: MetaLabel, idx: number) => toggleBreakIn('breaks', label, idx);
  const toggleWordBreak = (label: MetaLabel, idx: number) => toggleBreakIn('wordBreaks', label, idx);

  const layoutBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 2, cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 600,
    background: active ? 'var(--ai-violet)' : 'white',
    color: active ? 'white' : 'var(--ai-noir70)',
    border: active ? '1px solid var(--ai-violet)' : `1px solid ${color.gris}`,
  });

  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Cellules du bandeau</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Contrôle la largeur des cellules et l&apos;espace entre elles. « Adaptée au contenu » = chaque cellule prend la place qu&apos;elle a besoin (recommandé). « Équirépartie » = toutes les cellules sont de même largeur (ancien comportement).
      </p>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <button type="button" onClick={() => setLayout('content')} style={layoutBtn(layout === 'content')}>
          Adaptée au contenu
        </button>
        <button type="button" onClick={() => setLayout('equal')} style={layoutBtn(layout === 'equal')}>
          Équirépartie
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '8pt', color: 'var(--ai-noir70)', minWidth: '110px' }}>Espace entre cellules</span>
        <input
          type="range" min={0} max={15} step={0.5}
          value={gap ?? 0}
          onChange={(e) => setGap(Number(e.target.value))}
          style={{ flex: '1 1 100px', accentColor: color.rouge }}
        />
        <input
          type="number" min={0} max={20} step={0.5}
          value={gap ?? ''}
          onChange={(e) => setGap(e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="mm"
          style={{ ...INPUT_S, width: '70px', flex: '0 0 70px', textAlign: 'right' }}
        />
      </div>

      <details style={{ marginTop: '4px' }}>
        <summary
          style={{
            cursor: 'pointer',
            fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: Object.keys(weights).length > 0 ? 'var(--ai-rouge)' : 'var(--ai-noir70)',
            padding: '6px 0',
            userSelect: 'none', listStyle: 'none',
          }}
        >
          ▸ Largeur par cellule{Object.keys(weights).length > 0 ? ` • ${Object.keys(weights).length}` : ''}
        </summary>
        <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '6px 0' }}>
          Poids relatif de chaque cellule (1 = défaut). En mode « Adaptée au contenu », le poids impose une largeur minimum (poids × 20 mm). En mode « Équirépartie », le poids multiplie la part de chaque cellule (2 = double largeur).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px' }}>
          {CANONICAL_META_LABELS.map((label) => {
            const w = weights[label];
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '8pt', color: 'var(--ai-noir70)', minWidth: '90px' }}>{label}</span>
                <input
                  type="number" min={0.3} max={4} step={0.1}
                  value={w ?? ''}
                  onChange={(e) => setWeight(label, e.target.value === '' ? undefined : Number(e.target.value))}
                  placeholder="1.0"
                  title={`Poids relatif de la cellule ${label}. Vide ou 1 = défaut.`}
                  style={{ ...INPUT_S, width: '70px', flex: '0 0 70px', textAlign: 'right' }}
                />
              </div>
            );
          })}
        </div>
      </details>

      {multiValueCells.size > 0 && (
        <details
          open={Object.keys(breaks).length > 0}
          style={{ marginTop: '8px' }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: Object.keys(breaks).length > 0 ? 'var(--ai-rouge)' : 'var(--ai-noir70)',
              padding: '6px 0',
              userSelect: 'none', listStyle: 'none',
            }}
          >
            ▸ Sauts de ligne{Object.keys(breaks).length > 0 ? ` • ${Object.keys(breaks).length}` : ''}
          </summary>
          <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '6px 0 10px' }}>
            Pour les cellules avec plusieurs valeurs, clique sur le séparateur entre deux valeurs pour basculer de virgule (inline) à saut de ligne. Seules les cellules multi-valeurs de cette fiche sont affichées.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...multiValueCells.entries()].map(([label, vals]) => {
              const breakSet = new Set(breaks[label] ?? []);
              return (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '8pt', color: 'var(--ai-noir70)', fontWeight: 600 }}>{label}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                    {vals.map((v, idx) => {
                      const isLast = idx === vals.length - 1;
                      const isBreak = breakSet.has(idx);
                      return (
                        <span key={`${label}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              background: color.grisTresClair,
                              border: `1px solid ${color.gris}`,
                              borderRadius: 2,
                              padding: '3px 7px',
                              fontSize: '9pt',
                              color: 'var(--ai-noir)',
                            }}
                          >
                            {v}
                          </span>
                          {!isLast && (
                            <button
                              type="button"
                              onClick={() => toggleBreak(label, idx)}
                              title={isBreak ? `Saut de ligne après "${v}". Cliquer pour rendre inline.` : `"${v}" et "${vals[idx + 1]}" sont sur la même ligne. Cliquer pour ajouter un saut de ligne.`}
                              style={{
                                cursor: 'pointer',
                                background: isBreak ? 'var(--ai-rouge)' : 'white',
                                color: isBreak ? 'white' : 'var(--ai-noir70)',
                                border: isBreak ? '1px solid var(--ai-rouge)' : `1px solid ${color.gris}`,
                                borderRadius: 2,
                                width: 28,
                                height: 24,
                                fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 700,
                                padding: 0,
                                lineHeight: 1,
                              }}
                            >
                              {isBreak ? '↵' : ','}
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {wordBreakCells.size > 0 && (
        <details
          open={Object.keys(wordBreaks).length > 0}
          style={{ marginTop: '8px' }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: Object.keys(wordBreaks).length > 0 ? 'var(--ai-rouge)' : 'var(--ai-noir70)',
              padding: '6px 0',
              userSelect: 'none', listStyle: 'none',
            }}
          >
            ▸ Sauts de ligne intra-valeur{Object.keys(wordBreaks).length > 0 ? ` • ${Object.keys(wordBreaks).length}` : ''}
          </summary>
          <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '6px 0 10px' }}>
            Pour wrapper une valeur longue, un point de coupure (toujours en fin de mot) est proposé environ tous les 10 caractères. Fonctionne aussi sur les champs multi-valeurs — en plus des sauts inter-options ci-dessus. La virgule indique le séparateur entre deux options (réglable via « Sauts de ligne »).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...wordBreakCells.entries()].map(([label, model]) => {
              const wbSet = new Set(wordBreaks[label] ?? []);
              return (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '8pt', color: 'var(--ai-noir70)', fontWeight: 600 }}>{label}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                    {model.tokens.map((t, idx) => {
                      const sep = model.seps[idx];
                      // Toggle proposé uniquement sur un gap intra-valeur 'word'
                      // qui est offert (espacement ~10 car.) OU déjà coché (pour
                      // pouvoir l'annuler même hors grille de proposition).
                      const showToggle = sep === 'word' && (model.offerable.has(idx) || wbSet.has(idx));
                      const isBreak = wbSet.has(idx);
                      const nextTok = model.tokens[idx + 1];
                      return (
                        <span key={`${label}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              background: color.grisTresClair,
                              border: `1px solid ${color.gris}`,
                              borderRadius: 2,
                              padding: '3px 7px',
                              fontSize: '9pt',
                              color: 'var(--ai-noir)',
                            }}
                          >
                            {t}{sep === 'value' ? ',' : ''}
                          </span>
                          {showToggle && (
                            <button
                              type="button"
                              onClick={() => toggleWordBreak(label, idx)}
                              title={isBreak ? `Saut de ligne après "${t}". Cliquer pour rendre inline.` : `"${t}" et "${nextTok}" sont sur la même ligne. Cliquer pour ajouter un saut de ligne.`}
                              style={{
                                cursor: 'pointer',
                                background: isBreak ? 'var(--ai-rouge)' : 'white',
                                color: isBreak ? 'white' : 'var(--ai-noir70)',
                                border: isBreak ? '1px solid var(--ai-rouge)' : `1px solid ${color.gris}`,
                                borderRadius: 2,
                                width: 28,
                                height: 24,
                                fontFamily: 'var(--sans)', fontSize: '10pt', fontWeight: 700,
                                padding: 0,
                                lineHeight: 1,
                              }}
                            >
                              {isBreak ? '↵' : '·'}
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function ProgrammeOptionsRow({
  value,
  onChange,
}: {
  value: ProgrammeCellOptions | undefined;
  onChange: (v: ProgrammeCellOptions | undefined) => void;
}) {
  const hideSecondaire = value?.hideSecondaire === true;
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Cellule Programme</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Contrôle le contenu de la cellule « Programme » du bandeau. Par défaut, le Programme principal est affiché en grand et le Programme secondaire en sous-titre.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onChange({ ...(value ?? {}), hideSecondaire: !hideSecondaire })}
          style={hideSecondaire ? TOGGLE_ON : TOGGLE}
          title={hideSecondaire ? 'Le Programme secondaire est masqué — seul le principal s’affiche.' : 'Le Programme secondaire s’affiche en sous-titre.'}
        >
          {hideSecondaire ? '✓ Programme secondaire masqué' : '✕ Programme secondaire visible'}
        </button>
      </div>
    </div>
  );
}

function LinesRow({ value, onChange }: { value: BandeauLinesStyle; onChange: (v: BandeauLinesStyle) => void }) {
  // Convention : `show` non défini = visible par défaut. Le toggle bascule
  // explicitement vers false / true (jamais undefined) pour que l'intention
  // de l'utilisateur soit persistée.
  const visible = value.show !== false;
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Lignes horizontales du bandeau</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Les deux traits qui encadrent le bandeau métadonnées (au-dessus de Maître d&apos;ouvrage et sous le bandeau).
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onChange({ ...value, show: !visible })}
          style={visible ? TOGGLE_ON : TOGGLE}
          title={visible ? 'Masquer les lignes' : 'Afficher les lignes'}
        >
          {visible ? '✓ Affichées' : '✕ Masquées'}
        </button>
        <input
          type="number"
          step="0.5"
          min="0.25"
          max="6"
          value={value.width ?? ''}
          onChange={(e) => onChange({ ...value, width: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="Épaisseur (pt)"
          disabled={!visible}
          style={{ ...INPUT_S, width: '110px', flex: '0 0 110px', opacity: visible ? 1 : 0.4 }}
        />
        <div style={{ flex: '1 1 100%' }}>
          <ColorSelector
            value={value.color}
            onChange={(c) => onChange({ ...value, color: c })}
            disabled={!visible}
            customTitle="Couleur de ligne personnalisée"
          />
        </div>
      </div>
    </div>
  );
}
