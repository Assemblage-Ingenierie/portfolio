import type { TemplateBundle } from './shared';

/** Variante de page de garde : pilote uniquement la photo de couverture.
 *  Le reste de la mise en page est identique pour les trois pôles. */
export type CoverVariant = 'STR' | 'ENV' | 'DEV';

export const COVER_VARIANTS: CoverVariant[] = ['STR', 'ENV', 'DEV'];

const BRANDING =
  'https://hhkofvbptnrtwbazftlm.supabase.co/storage/v1/object/public/Branding';

// Logo Assemblage ingénierie (wordmark rouge) — coin haut gauche.
const LOGO_URL = `${BRANDING}/logo/logo_Ai_rouge.svg`;

// Vignettes pôle (SVG nativement rouges) — coin haut droit, ordre STR · ENV · DEV.
const VIGNETTE_BASE = `${BRANDING}/vignettes%20svg`;
const VIGNETTES: ReadonlyArray<{ code: CoverVariant; url: string }> = [
  { code: 'STR', url: `${VIGNETTE_BASE}/STR.svg` },
  { code: 'ENV', url: `${VIGNETTE_BASE}/ENV.svg` },
  { code: 'DEV', url: `${VIGNETTE_BASE}/DEV.svg` },
];

// Photo de couverture par variante de page de garde (bucket Branding).
const COVER_PHOTOS: Record<CoverVariant, string> = {
  STR: `${BRANDING}/portfolio%20-%20photos%20sommaire/Pole-Structure.jpg`,
  ENV: `${BRANDING}/portfolio%20-%20photos%20sommaire/Pole-Environnement.jpg`,
  DEV: `${BRANDING}/portfolio%20-%20photos%20sommaire/Pole-Developpement.jpg`,
};

const CSS = `
.pdg-page {
  display: flex;
  flex-direction: column;
}
/* Bandeau logo (gauche) + vignettes pôle (droite). */
.pdg-head {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14mm 18mm 0 6mm;
}
/* Logo 26mm de haut (largeur rendue ≈73.1mm). Le SVG a ~5.4% de blanc à
   gauche dans son viewBox (glyphe à x=30.6 sur 566.9) → ≈3.95mm à cette
   taille. La marge négative compense ce blanc pour que le bord gauche VISIBLE
   du logo s'aligne sur la marge 6mm (padding head). */
.pdg-logo { height: 26mm; width: auto; display: block; margin-left: -3.95mm; }
.pdg-vignettes { display: flex; align-items: center; gap: 4mm; }
.pdg-vignette { height: 15mm; width: auto; display: block; }

/* Accroche + lignes Portfolio / Date. */
.pdg-intro {
  flex: 0 0 auto;
  padding: 16mm 18mm 12mm 6mm;
}
.pdg-title {
  font-family: var(--sans);
  font-size: 14pt;
  font-weight: 600;
  color: var(--ai-rouge);
  line-height: 1.25;
  letter-spacing: -0.005em;
  white-space: nowrap;
  margin-bottom: 12mm;
}
.pdg-lines {
  font-family: var(--sans);
  display: flex;
  flex-direction: column;
  gap: 4mm;
}
.pdg-line {
  font-size: 14pt;
  font-weight: 550;
  color: var(--ai-noir);
}
.pdg-line-label {
  font-size: 14pt;
  font-weight: 550;
  color: var(--ai-noir);
}

/* Photo de couverture pleine largeur. Hauteur réduite à ~0.7× de l'espace
   qu'elle occupait quand elle remplissait toute la page (≈180mm). Le footer
   est poussé en bas via margin-top:auto. */
.pdg-photo-frame {
  flex: 0 0 126mm;
  overflow: hidden;
  display: flex;
}
.pdg-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Pied de page : adresse + email, même taille. */
.pdg-footer {
  flex: 0 0 auto;
  margin-top: auto;
  /* Marge gauche 6mm (alignée sur le logo, l'accroche et Portfolio). */
  padding: 6mm 18mm 9mm 6mm;
  font-family: var(--sans);
  font-size: 9pt;
  color: var(--ai-noir70);
}
.pdg-footer-addr {
  font-size: 9pt;
  color: var(--ai-noir);
  font-weight: 400;
}
`;

export interface CoverParams {
  title?: string;
  date?: Date;
  count?: number;
  /** Variante (STR/ENV/DEV). Défaut STR. Ne change que la photo de couverture. */
  variant?: CoverVariant;
}

export function renderCover(params: CoverParams = {}): TemplateBundle {
  const variant: CoverVariant = params.variant ?? 'STR';
  const count = params.count ?? 0;
  const countLine = `${count} Référence${count > 1 ? 's' : ''}`;
  const photoUrl = COVER_PHOTOS[variant];

  const vignettes = VIGNETTES
    .map(v => `<img class="pdg-vignette" src="${v.url}" alt="${v.code}" />`)
    .join('');

  const body = `<article class="page pdg-page">
    <div class="pdg-head">
      <img class="pdg-logo" src="${LOGO_URL}" alt="Assemblage ingénierie" />
      <div class="pdg-vignettes">${vignettes}</div>
    </div>

    <div class="pdg-intro">
      <h1 class="pdg-title">Vers des constructions plus sobres et durables</h1>
      <div class="pdg-lines">
        <div class="pdg-line"><span class="pdg-line-label">Portfolio :</span> ${countLine}</div>
      </div>
    </div>

    <div class="pdg-photo-frame">
      <img class="pdg-photo" src="${photoUrl}" alt="" />
    </div>

    <div class="pdg-footer">
      <span class="pdg-footer-addr">137 rue d'Aboukir, 75002 Paris</span> – contact@assemblage.net
    </div>
  </article>`;

  return { body, css: CSS };
}
