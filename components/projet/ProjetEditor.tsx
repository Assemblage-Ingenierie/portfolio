'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Projet, Statut, TemplateChoice } from '@/types/projet';
import { TEMPLATE_OPTIONS } from '@/types/projet';
import TemplatePreview from '@/components/TemplatePreview';
import Link from 'next/link';
import { authedFetch } from '@/lib/supabase/authHeaders';
import RichTextEditor from './RichTextEditor';
import MultiSelectField from './MultiSelectField';
import { color, feedback, ui } from '@/lib/ui/tokens';

/** Shape de la réponse de /api/airtable/select-options. */
interface SelectOptions {
  missionAi: string[];
  programmesPrincipaux: string[];
  programmesSecondaires: string[];
  etatAvancement: string[];
  materiaux: string[];
  rehabNeuf: string[];
}
const EMPTY_OPTIONS: SelectOptions = {
  missionAi: [], programmesPrincipaux: [], programmesSecondaires: [],
  etatAvancement: [], materiaux: [], rehabNeuf: [],
};

interface Props { projet: Projet; }
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const LABEL: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--sans)', fontSize: '7pt', fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '4px',
};
const INPUT: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--sans)', fontSize: '10pt',
  padding: '7px 10px', border: `1px solid ${color.gris}`, borderRadius: '2px', background: 'white', outline: 'none',
};
const TEXTAREA: React.CSSProperties = { ...INPUT, resize: 'vertical' as const, lineHeight: '1.5' };
const SECTION: React.CSSProperties = { marginBottom: '28px', paddingBottom: '28px', borderBottom: `1px solid ${color.gris}` };
const STITLE: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700, letterSpacing: '0.15em',
  textTransform: 'uppercase' as const, color: 'var(--ai-rouge)', marginBottom: '16px',
};
const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' };

// Style d'un champ lecture seule (CRM ou formule Airtable).
const READONLY_INPUT: React.CSSProperties = {
  ...INPUT, background: color.grisTresClair, color: ui.disabled, cursor: 'not-allowed',
};
const HINT: React.CSSProperties = {
  fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px',
};

/** Champ en lecture seule lie a la base Sync CRM. La valeur affichee est
 *  le nom resolu depuis le CRM (cf. lib/airtable/crm.ts). Pour modifier la
 *  valeur, l'utilisateur doit passer par la base CRM directement — toute
 *  ecriture depuis le portfolio casserait la relation linked record. */
function CrmField({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <input value={value ?? ''} readOnly style={READONLY_INPUT} />
      <p style={HINT}>Champ lie a Sync CRM (lecture seule depuis le portfolio).</p>
    </div>
  );
}

export default function ProjetEditor({ projet }: Props) {
  const router = useRouter();

  const [nom, setNom] = useState(projet.nom);
  const [adresse, setAdresse] = useState(projet.adresse ?? '');
  const [pitch, setPitch] = useState(projet.pitch ?? '');
  const [description, setDescription] = useState(projet.description);
  const [prestationAssemblage, setPrestationAssemblage] = useState(projet.prestationAssemblage ?? '');
  // MOA / Architecte / Mandataire / Entreprise / BET associes / Bailleur :
  // tous des linked records vers la base Sync CRM. Lecture seule ici — voir
  // composant <CrmField/>. Pas de state local : la valeur affichee vient
  // directement du Projet.
  const [referentAi, setReferentAi] = useState(projet.referentAi ?? '');
  const [surface, setSurface] = useState(projet.surface?.toString() ?? '');
  const [budget, setBudget] = useState(projet.budgetRaw?.toString() ?? '');
  const [annee, setAnnee] = useState(projet.anneeLivraison?.toString() ?? '');
  // Champ "Programme" (texte libre) deprecated en 2026 — remplace par
  // "Programmes principaux" / "Programmes secondaires" (multi-selects).
  const [pole, setPole] = useState(projet.pole ?? '');
  const [departement, setDepartement] = useState(projet.departement ?? '');

  // Multi-selects : array d'options. Default initialisé depuis le Projet.
  // Pour `statutValues`, fallback sur [statut] si l'array est vide (rétro-compat
  // avec les anciennes fiches qui n'ont qu'un statut canonique).
  const [missionAiValues, setMissionAiValues] = useState<string[]>(projet.missionAiValues ?? []);
  const [programmesPrincipaux, setProgrammesPrincipaux] = useState<string[]>(projet.programmesPrincipaux ?? []);
  const [programmesSecondaires, setProgrammesSecondaires] = useState<string[]>(projet.programmesSecondaires ?? []);
  const [statutValues, setStatutValues] = useState<string[]>(
    (projet.statutValues && projet.statutValues.length > 0)
      ? projet.statutValues
      : (projet.statut ? [projet.statut] : [])
  );
  const [materiaux, setMateriaux] = useState<string[]>(projet.materiaux ?? []);
  const [rehabNeufValues, setRehabNeufValues] = useState<string[]>(projet.rehabNeufValues ?? []);

  // Options canoniques chargées depuis la metadata Airtable.
  const [selectOptions, setSelectOptions] = useState<SelectOptions>(EMPTY_OPTIONS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch('/api/airtable/select-options');
        if (!res.ok) return;
        const data = (await res.json()) as Partial<SelectOptions>;
        if (cancelled) return;
        setSelectOptions({
          missionAi: data.missionAi ?? [],
          programmesPrincipaux: data.programmesPrincipaux ?? [],
          programmesSecondaires: data.programmesSecondaires ?? [],
          etatAvancement: data.etatAvancement ?? [],
          materiaux: data.materiaux ?? [],
          rehabNeuf: data.rehabNeuf ?? [],
        });
      } catch {
        // En mode dégradé : l'utilisateur peut quand même taper des valeurs
        // libres (création automatique côté Airtable via typecast).
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [template, setTemplate] = useState<TemplateChoice>(projet.template);
  // Certifications et mots-clés : même format de saisie (séparateur virgule)
  // pour une UX cohérente — les deux sont des listes plates de tags.
  const [certifications, setCertifications] = useState(projet.certifications.join(', '));
  const [motsCles, setMotsCles] = useState(projet.motsCles.join(', '));
  const [chiffresClesRaw, setChiffresClesRaw] = useState(
    (projet.chiffresCles ?? []).map(c => `${c.label} | ${c.valeur}`).join('\n')
  );
  const [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMsg, setSaveMsg] = useState('');

  const parseChiffres = () =>
    chiffresClesRaw.split('\n').filter(Boolean).map(line => {
      const [label, valeur] = line.split('|').map(s => s.trim());
      return { label: label ?? '', valeur: valeur ?? '' };
    });

  async function handleDownloadPdf() {
    setExporting(true);
    try {
      // Sauvegarde implicite avant export pour que le PDF reflète l'édition courante
      await handleSave();
      window.open(
        `/projet/${projet.slug}/print?template=${encodeURIComponent(template)}`,
        '_blank'
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur export PDF');
    } finally {
      setExporting(false);
    }
  }

  async function handleSave() {
    setSaveStatus('saving');
    setSaveMsg('');
    try {
      const res = await authedFetch(`/api/projet/${projet.slug}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: nom || undefined,
          adresse: adresse || undefined,
          description: description || undefined,
          prestationAssemblage: prestationAssemblage || undefined,
          // MOA / Mandataire / BET associes / Entreprise / Bailleur :
          // linked records vers Sync CRM, jamais ecrits depuis le portfolio.
          referentAi: referentAi || undefined,
          // Multi-selects → arrays
          missionAiValues,
          programmesPrincipaux,
          programmesSecondaires,
          statutValues,
          materiaux,
          rehabNeufValues,
          surface: surface ? Number(surface) : undefined,
          budgetRaw: budget ? Number(budget) : undefined,
          anneeLivraison: annee ? Number(annee) : undefined,
          pole: pole || undefined,
          departement: departement || undefined,
          template,
          certifications: certifications.split(/[,;]+/).map(s => s.trim()).filter(Boolean),
          motsCles: motsCles.split(/[,;]+/).map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setSaveStatus('saved');
      setSaveMsg('Sauvegardé dans Airtable');
      // Le slug Airtable est une formule basée sur "Nom du projet" : si le nom
      // a changé, le slug change aussi → rediriger vers la nouvelle URL.
      if (data.slug && data.slug !== projet.slug) {
        router.replace(`/projet/${data.slug}/edit`);
      } else {
        router.refresh();
      }
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      setSaveStatus('error');
      setSaveMsg(e instanceof Error ? e.message : 'Erreur inconnue');
    }
  }

  const toolbar = (
    <div style={{ background: 'var(--ai-violet)', padding: '10px 24px', display: 'flex', gap: '12px', alignItems: 'center', fontFamily: 'var(--sans)', fontSize: '8pt', position: 'sticky', top: 0, zIndex: 10 }}>
      <Link href={`/projet/${projet.slug}`} style={{ color: 'var(--ai-gris)', textDecoration: 'none', fontWeight: 600 }}>
        {'←'} Retour à la fiche
      </Link>
      <div style={{ flex: 1 }} />
      {saveMsg && (
        <span style={{ color: saveStatus === 'error' ? feedback.erreurClair : feedback.succesClair, fontWeight: 600 }}>
          {saveStatus === 'saving' ? '...' : saveMsg}
        </span>
      )}
      {!preview && (
        <button onClick={handleSave} disabled={saveStatus === 'saving'} style={{ background: saveStatus === 'saving' ? ui.disabled : 'var(--ai-rouge)', color: 'white', padding: '5px 14px', borderRadius: '2px', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--sans)', fontSize: '8pt' }}>
          {saveStatus === 'saving' ? 'Sauvegarde...' : 'Sauvegarder dans Airtable'}
        </button>
      )}
      <button onClick={() => setPreview(v => !v)} style={{ background: 'white', color: 'var(--ai-violet)', padding: '5px 12px', borderRadius: '2px', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--sans)', fontSize: '8pt' }}>
        {preview ? 'Modifier' : 'Aperçu'}
      </button>
      <button onClick={handleDownloadPdf} disabled={exporting} style={{ background: 'var(--ai-rouge)', color: 'white', padding: '5px 12px', borderRadius: '2px', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--sans)', fontSize: '8pt', opacity: exporting ? 0.7 : 1 }}>
        {exporting ? 'Export…' : 'Télécharger PDF'}
      </button>
    </div>
  );

  if (preview) {
    // Construit un projet enrichi des champs en cours d'édition pour aperçu live
    const previewProjet: Projet = {
      ...projet,
      template,
      nom,
      adresse: adresse || undefined,
      pitch: pitch || undefined,
      description,
      prestationAssemblage: prestationAssemblage || undefined,
      // CRM (read-only) : on garde la valeur courante de la fiche
      referentAi: referentAi || undefined,
      // Multi-selects édités : on reflète les arrays + valeurs jointes
      // pour le rendu legacy (templates qui consomment encore les CSV).
      missionAi: missionAiValues.length > 0 ? missionAiValues.join(', ') : undefined,
      missionAiValues,
      programmesPrincipaux,
      programmesSecondaires,
      programmePrincipal: programmesPrincipaux[0],
      programmeSecondaire: programmesSecondaires[0],
      materiaux,
      rehabNeufValues,
      rehabNeuf: rehabNeufValues.length > 0 ? rehabNeufValues.join(', ') : undefined,
      surface: surface ? Number(surface) : undefined,
      anneeLivraison: annee ? Number(annee) : undefined,
      pole: pole || undefined,
      departement: departement || undefined,
      // statut (single) reste utilisé par certains rendus historiques :
      // on prend la première valeur cochée comme valeur canonique.
      statut: (statutValues[0] ?? projet.statut) as Statut,
      statutValues: statutValues as Statut[],
      chiffresCles: parseChiffres(),
      certifications: certifications.split(/[,;]+/).map(s => s.trim()).filter(Boolean),
      motsCles: motsCles.split(',').map(s => s.trim()).filter(Boolean),
    };
    return (
      <>
        {toolbar}
        <TemplatePreview projet={previewProjet} />
      </>
    );
  }

  return (
    <div style={{ background: ui.fondPage, minHeight: '100vh' }}>
      {toolbar}
      <div style={{ maxWidth: '760px', margin: '32px auto', padding: '0 24px 48px', fontFamily: 'var(--sans)' }}>

        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '22pt', fontWeight: 500, color: 'var(--ai-violet)', marginBottom: '28px' }}>
          {projet.nom}
          <span style={{ fontFamily: 'var(--sans)', fontSize: '9pt', color: 'var(--ai-noir70)', marginLeft: '12px', fontWeight: 400 }}>{projet.affaire}</span>
        </h1>

        <div style={SECTION}>
          <div style={STITLE}>Template</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {TEMPLATE_OPTIONS.map(t => (
              <button key={t} onClick={() => setTemplate(t)} style={{ padding: '6px 18px', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700, background: template === t ? 'var(--ai-violet)' : 'white', color: template === t ? 'white' : 'var(--ai-noir70)', border: template === t ? 'none' : `1px solid ${color.gris}` }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={SECTION}>
          <div style={STITLE}>Identité</div>
          <div style={{ marginBottom: '14px' }}><label style={LABEL}>Nom du projet</label><input value={nom} onChange={e => setNom(e.target.value)} style={INPUT} /></div>
          <div style={{ marginBottom: '14px' }}><label style={LABEL}>Adresse</label><input value={adresse} onChange={e => setAdresse(e.target.value)} style={INPUT} /></div>
          <div style={{ marginBottom: '14px' }}>
            <label style={LABEL}>Pitch (formule Airtable, lecture seule)</label>
            <textarea value={pitch} onChange={e => setPitch(e.target.value)} rows={3} style={{ ...TEXTAREA, background: color.grisTresClair, color: ui.disabled }} readOnly />
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px' }}>Calculé par formule dans Airtable. Modifiable en aperçu uniquement.</p>
          </div>
          <div>
            <label style={LABEL}>Description projet</label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Description du projet…"
              minRows={10}
            />
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px' }}>Texte enrichi (Markdown) — synchronisé avec le champ Airtable.</p>
          </div>
          {template === 'Dev' && (
            <div style={{ marginTop: '20px' }}>
              <label style={LABEL}>Prestation Assemblage</label>
              <RichTextEditor
                value={prestationAssemblage}
                onChange={setPrestationAssemblage}
                placeholder="Description de la prestation Assemblage…"
                minRows={6}
              />
              <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px' }}>
                Texte enrichi (Markdown) — synchronisé avec le champ Airtable « Prestation Assemblage ».
                Police et taille modifiables via la section dédiée dans <em>Mise en page typographique</em> ci-dessus.
              </p>
            </div>
          )}
        </div>

        <div style={SECTION}>
          <div style={STITLE}>Intervenants</div>
          <div style={GRID2}>
            <CrmField label="Maître d'ouvrage" value={projet.moa} />
            <CrmField label="Architecte"        value={projet.architecte} />
            <CrmField label="Mandataire"        value={projet.mandataire} />
            <CrmField label="BET associés"      value={projet.betAssocies} />
            <CrmField label="Entreprise"        value={projet.entreprise} />
            <CrmField label="Bailleur"          value={projet.bailleur} />
            <div>
              <label style={LABEL}>Référent AI</label>
              <input value={referentAi} onChange={e => setReferentAi(e.target.value)} style={INPUT} />
            </div>
            <MultiSelectField
              label="Mission AI"
              values={missionAiValues}
              onChange={setMissionAiValues}
              options={selectOptions.missionAi}
              placeholder="Ajouter une mission…"
              hint="Multi-select Airtable. Tape pour filtrer, Entrée pour créer une nouvelle option."
            />
          </div>
        </div>

        <div style={SECTION}>
          <div style={STITLE}>Données projet</div>
          <div style={GRID2}>
            <div><label style={LABEL}>Surface (m²)</label><input type="number" value={surface} onChange={e => setSurface(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Budget HT (€ brut)</label><input type="number" value={budget} onChange={e => setBudget(e.target.value)} style={INPUT} placeholder="ex: 8200000" /></div>
            <div><label style={LABEL}>Année de livraison</label><input type="number" value={annee} onChange={e => setAnnee(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Pôle</label><input value={pole} onChange={e => setPole(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Département</label><input value={departement} onChange={e => setDepartement(e.target.value)} style={INPUT} /></div>
            <MultiSelectField
              label="Réhab / Neuf"
              values={rehabNeufValues}
              onChange={setRehabNeufValues}
              options={selectOptions.rehabNeuf}
              placeholder="Choisir…"
              hint="Multi-select Airtable. Plusieurs valeurs autorisées."
            />
            <MultiSelectField
              label="État avancement (statut)"
              values={statutValues}
              onChange={setStatutValues}
              options={selectOptions.etatAvancement}
              placeholder="Choisir un ou plusieurs statuts…"
              hint="Multi-select Airtable. La première valeur reste le statut canonique pour le bandeau."
            />
            <MultiSelectField
              label="Programmes principaux"
              values={programmesPrincipaux}
              onChange={setProgrammesPrincipaux}
              options={selectOptions.programmesPrincipaux}
              placeholder="Ajouter un programme principal…"
              hint="Multi-select Airtable. Le premier élément alimente le bandeau « Programme »."
            />
            <MultiSelectField
              label="Programmes secondaires"
              values={programmesSecondaires}
              onChange={setProgrammesSecondaires}
              options={selectOptions.programmesSecondaires}
              placeholder="Ajouter un programme secondaire…"
              hint="Multi-select Airtable. Affiché en sous-titre du « Programme » dans le bandeau."
            />
            <MultiSelectField
              label="Matériaux"
              values={materiaux}
              onChange={setMateriaux}
              options={selectOptions.materiaux}
              placeholder="Ajouter un matériau…"
              hint="Multi-select Airtable. Visible dans les filtres et le tableau récap."
            />
          </div>
        </div>

        <div style={{ ...SECTION, borderBottom: 'none', marginBottom: 0 }}>
          <div style={STITLE}>Contenu enrichi</div>
          <div style={{ marginBottom: '14px' }}>
            <label style={LABEL}>Chiffres clés (formule Airtable, lecture seule)</label>
            <textarea value={chiffresClesRaw} onChange={e => setChiffresClesRaw(e.target.value)} rows={6} style={{ ...TEXTAREA, background: color.grisTresClair, color: ui.disabled }} readOnly placeholder={'Surface totale | 4 242 m2\nBudget travaux | 8,2 M HT'} />
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px' }}>Calculé par formule dans Airtable. Modifiable en aperçu uniquement.</p>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={LABEL}>Mots-clés</label>
            <input value={motsCles} onChange={e => setMotsCles(e.target.value)} style={INPUT} placeholder="structure bois, réhabilitation, Paris 18e" />
          </div>
          <div>
            <label style={LABEL}>Certifications</label>
            <input value={certifications} onChange={e => setCertifications(e.target.value)} style={INPUT} placeholder="BDF bronze, E+C-, BBC" />
          </div>
        </div>

      </div>
    </div>
  );
}
