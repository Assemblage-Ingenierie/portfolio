'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Projet, LayoutChoice } from '@/types/projet';
import LayoutEditorial from '@/components/layouts/LayoutEditorial';
import LayoutMagazine from '@/components/layouts/LayoutMagazine';
import Link from 'next/link';

interface Props { projet: Projet; }
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const LABEL: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--sans)', fontSize: '7pt', fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: '4px',
};
const INPUT: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--sans)', fontSize: '10pt',
  padding: '7px 10px', border: '1px solid #DFE4E8', borderRadius: '2px', background: 'white', outline: 'none',
};
const TEXTAREA: React.CSSProperties = { ...INPUT, resize: 'vertical' as const, lineHeight: '1.5' };
const SECTION: React.CSSProperties = { marginBottom: '28px', paddingBottom: '28px', borderBottom: '1px solid #DFE4E8' };
const STITLE: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700, letterSpacing: '0.15em',
  textTransform: 'uppercase' as const, color: 'var(--ai-rouge)', marginBottom: '16px',
};
const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' };

export default function ProjetEditor({ projet }: Props) {
  const router = useRouter();

  const [nom, setNom] = useState(projet.nom);
  const [adresse, setAdresse] = useState(projet.adresse ?? '');
  const [pitch, setPitch] = useState(projet.pitch ?? '');
  const [description, setDescription] = useState(projet.description);
  const [moa, setMoa] = useState(projet.moa ?? '');
  const [mandataire, setMandataire] = useState(projet.mandataire ?? '');
  const [betAssocies, setBetAssocies] = useState(projet.betAssocies ?? '');
  const [entreprise, setEntreprise] = useState(projet.entreprise ?? '');
  const [bailleur, setBailleur] = useState(projet.bailleur ?? '');
  const [referentAi, setReferentAi] = useState(projet.referentAi ?? '');
  const [missionAi, setMissionAi] = useState(projet.missionAi ?? '');
  const [surface, setSurface] = useState(projet.surface?.toString() ?? '');
  const [budget, setBudget] = useState(projet.budgetRaw?.toString() ?? '');
  const [annee, setAnnee] = useState(projet.anneeLivraison?.toString() ?? '');
  const [programme, setProgramme] = useState(projet.programme ?? '');
  const [pole, setPole] = useState(projet.pole ?? '');
  const [departement, setDepartement] = useState(projet.departement ?? '');
  const [rehabNeuf, setRehabNeuf] = useState(projet.rehabNeuf ?? '');
  const [statut, setStatut] = useState(projet.statut);
  const [layout, setLayout] = useState<LayoutChoice>(projet.layout);
  const [certifications, setCertifications] = useState(projet.certifications.join('\n'));
  const [motsCles, setMotsCles] = useState(projet.motsCles.join(', '));
  const [chiffresClesRaw, setChiffresClesRaw] = useState(
    (projet.chiffresCles ?? []).map(c => `${c.label} | ${c.valeur}`).join('\n')
  );

  const [preview, setPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMsg, setSaveMsg] = useState('');

  const parseChiffres = () =>
    chiffresClesRaw.split('\n').filter(Boolean).map(line => {
      const [label, valeur] = line.split('|').map(s => s.trim());
      return { label: label ?? '', valeur: valeur ?? '' };
    });

  async function handleSave() {
    setSaveStatus('saving');
    setSaveMsg('');
    try {
      const res = await fetch(`/api/projet/${projet.slug}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: nom || undefined,
          adresse: adresse || undefined,
          pitch: pitch || undefined,
          description: description || undefined,
          moa: moa || undefined,
          mandataire: mandataire || undefined,
          betAssocies: betAssocies || undefined,
          entreprise: entreprise || undefined,
          bailleur: bailleur || undefined,
          referentAi: referentAi || undefined,
          missionAi: missionAi || undefined,
          surface: surface ? Number(surface) : undefined,
          budgetRaw: budget ? Number(budget) : undefined,
          anneeLivraison: annee ? Number(annee) : undefined,
          programme: programme || undefined,
          pole: pole || undefined,
          departement: departement || undefined,
          rehabNeuf: rehabNeuf || undefined,
          statut,
          layout,
          certifications: certifications.split('\n').map(s => s.trim()).filter(Boolean),
          motsCles: motsCles.split(/[,;]+/).map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setSaveStatus('saved');
      setSaveMsg('Sauvegardé dans Airtable');
      router.refresh();
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
        <span style={{ color: saveStatus === 'error' ? '#ffaaaa' : '#90EE90', fontWeight: 600 }}>
          {saveStatus === 'saving' ? '...' : saveMsg}
        </span>
      )}
      {!preview && (
        <button onClick={handleSave} disabled={saveStatus === 'saving'} style={{ background: saveStatus === 'saving' ? '#888' : 'var(--ai-rouge)', color: 'white', padding: '5px 14px', borderRadius: '2px', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--sans)', fontSize: '8pt' }}>
          {saveStatus === 'saving' ? 'Sauvegarde...' : 'Sauvegarder dans Airtable'}
        </button>
      )}
      <button onClick={() => setPreview(v => !v)} style={{ background: 'white', color: 'var(--ai-violet)', padding: '5px 12px', borderRadius: '2px', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--sans)', fontSize: '8pt' }}>
        {preview ? 'Modifier' : 'Aperçu'}
      </button>
      <a href={`/api/projet/${projet.slug}/pdf`} style={{ background: 'var(--ai-rouge)', color: 'white', padding: '5px 12px', borderRadius: '2px', textDecoration: 'none', fontWeight: 600 }}>
        Télécharger PDF
      </a>
    </div>
  );

  if (preview) {
    const overrides = { pitch, description, chiffresCles: parseChiffres() };
    return (
      <>
        {toolbar}
        {layout === 'Magazine'
          ? <LayoutMagazine projet={{ ...projet, layout }} overrides={overrides} />
          : <LayoutEditorial projet={{ ...projet, layout }} overrides={overrides} />}
      </>
    );
  }

  return (
    <div style={{ background: '#ECECEC', minHeight: '100vh' }}>
      {toolbar}
      <div style={{ maxWidth: '760px', margin: '32px auto', padding: '0 24px 48px', fontFamily: 'var(--sans)' }}>

        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '22pt', fontWeight: 500, color: 'var(--ai-violet)', marginBottom: '28px' }}>
          {projet.nom}
          <span style={{ fontFamily: 'var(--sans)', fontSize: '9pt', color: 'var(--ai-noir70)', marginLeft: '12px', fontWeight: 400 }}>{projet.affaire}</span>
        </h1>

        <div style={SECTION}>
          <div style={STITLE}>Layout</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['Editorial', 'Magazine'] as LayoutChoice[]).map(l => (
              <button key={l} onClick={() => setLayout(l)} style={{ padding: '6px 18px', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700, background: layout === l ? 'var(--ai-violet)' : 'white', color: layout === l ? 'white' : 'var(--ai-noir70)', border: layout === l ? 'none' : '1px solid #DFE4E8' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div style={SECTION}>
          <div style={STITLE}>Identité</div>
          <div style={{ marginBottom: '14px' }}><label style={LABEL}>Nom du projet</label><input value={nom} onChange={e => setNom(e.target.value)} style={INPUT} /></div>
          <div style={{ marginBottom: '14px' }}><label style={LABEL}>Adresse</label><input value={adresse} onChange={e => setAdresse(e.target.value)} style={INPUT} /></div>
          <div style={{ marginBottom: '14px' }}><label style={LABEL}>Pitch</label><textarea value={pitch} onChange={e => setPitch(e.target.value)} rows={3} style={TEXTAREA} /></div>
          <div>
            <label style={LABEL}>Description projet</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={10} style={TEXTAREA} />
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px' }}>Séparer les paragraphes par une ligne vide.</p>
          </div>
        </div>

        <div style={SECTION}>
          <div style={STITLE}>Intervenants</div>
          <div style={GRID2}>
            <div><label style={LABEL}>Maître d&apos;ouvrage</label><input value={moa} onChange={e => setMoa(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Mission AI</label><input value={missionAi} onChange={e => setMissionAi(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Mandataire</label><input value={mandataire} onChange={e => setMandataire(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>BET associés</label><input value={betAssocies} onChange={e => setBetAssocies(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Entreprise</label><input value={entreprise} onChange={e => setEntreprise(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Bailleur</label><input value={bailleur} onChange={e => setBailleur(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Référent AI</label><input value={referentAi} onChange={e => setReferentAi(e.target.value)} style={INPUT} /></div>
            <div>
              <label style={LABEL}>Architecte (lecture seule)</label>
              <input value={projet.architecte ?? ''} readOnly style={{ ...INPUT, background: '#F2F2F2', color: '#888', cursor: 'not-allowed' }} />
            </div>
          </div>
        </div>

        <div style={SECTION}>
          <div style={STITLE}>Données projet</div>
          <div style={GRID2}>
            <div><label style={LABEL}>Surface (m²)</label><input type="number" value={surface} onChange={e => setSurface(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Budget HT (€ brut)</label><input type="number" value={budget} onChange={e => setBudget(e.target.value)} style={INPUT} placeholder="ex: 8200000" /></div>
            <div><label style={LABEL}>Année de livraison</label><input type="number" value={annee} onChange={e => setAnnee(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Programme</label><input value={programme} onChange={e => setProgramme(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Pôle</label><input value={pole} onChange={e => setPole(e.target.value)} style={INPUT} /></div>
            <div><label style={LABEL}>Département</label><input value={departement} onChange={e => setDepartement(e.target.value)} style={INPUT} /></div>
            <div>
              <label style={LABEL}>Réhab / Neuf</label>
              <select value={rehabNeuf} onChange={e => setRehabNeuf(e.target.value)} style={INPUT}>
                <option value="">—</option>
                <option>Neuf</option>
                <option>Réhabilitation</option>
                <option>Réhab + Extension</option>
              </select>
            </div>
            <div>
              <label style={LABEL}>Statut</label>
              <select value={statut} onChange={e => setStatut(e.target.value as typeof statut)} style={INPUT}>
                <option>En étude</option>
                <option>En consultation</option>
                <option>En chantier</option>
                <option>Livré</option>
                <option>En pause</option>
                <option>Abandonné</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ ...SECTION, borderBottom: 'none', marginBottom: 0 }}>
          <div style={STITLE}>Contenu enrichi</div>
          <div style={{ marginBottom: '14px' }}>
            <label style={LABEL}>Chiffres clés</label>
            <textarea value={chiffresClesRaw} onChange={e => setChiffresClesRaw(e.target.value)} rows={6} style={TEXTAREA} placeholder={'Surface totale | 4 242 m2\nBudget travaux | 8,2 M HT'} />
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px' }}>Une ligne par chiffre, format : Label | Valeur</p>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={LABEL}>Certifications</label>
            <textarea value={certifications} onChange={e => setCertifications(e.target.value)} rows={3} style={TEXTAREA} placeholder={'BDF bronze\nE+C-'} />
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px' }}>Une par ligne.</p>
          </div>
          <div>
            <label style={LABEL}>Mots-clés</label>
            <input value={motsCles} onChange={e => setMotsCles(e.target.value)} style={INPUT} placeholder="structure bois, réhabilitation, Paris 18e" />
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px' }}>Séparés par des virgules.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
