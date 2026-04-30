import type { Projet } from '@/types/projet';
import type { jsPDF } from 'jspdf';

type Doc = jsPDF;

// Palette (RGB)
const RD: [number, number, number] = [227, 5, 19];   // --ai-rouge
const GR: [number, number, number] = [223, 228, 232]; // --ai-gris
const N70: [number, number, number] = [77, 77, 77];   // --ai-noir70
const BK: [number, number, number] = [0, 0, 0];

// Line height in mm for a given pt size
function lh(pt: number, factor = 1.35): number {
  return (pt / 72) * 25.4 * factor;
}

function imgFmt(b64: string): 'JPEG' | 'PNG' {
  return b64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

export function drawEditorial(doc: Doc, projet: Projet, images: Record<string, string>): void {
  const L = 18;  // left margin
  const R = 192; // right edge (210 - 18)
  const W = 174; // content width
  let y = 14;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont('OpenSans', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...N70);
  doc.text('Assemblage ingénierie · Référence Projet', L, y);
  doc.setFont('OpenSans', 'bold');
  doc.setTextColor(...RD);
  doc.text(`● ${projet.statut}`, R, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(...RD);
  doc.setLineWidth(0.4);
  doc.line(L, y, R, y);
  y += 5;

  // ── Surtitre (adresse) ──────────────────────────────────────────────────
  if (projet.adresse) {
    doc.setFont('OpenSans', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...N70);
    doc.text(projet.adresse.toUpperCase(), L, y);
    y += lh(9) + 1;
  }

  // ── H1 ──────────────────────────────────────────────────────────────────
  doc.setFont('Newsreader', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...BK);
  const h1Lines: string[] = doc.splitTextToSize(projet.nom, W);
  doc.text(h1Lines, L, y);
  y += h1Lines.length * lh(28) + 2;

  // ── Pitch ────────────────────────────────────────────────────────────────
  if (projet.pitch) {
    doc.setFont('Newsreader', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(...N70);
    const pitchLines: string[] = doc.splitTextToSize(projet.pitch, W * 0.82);
    doc.text(pitchLines, L, y);
    y += pitchLines.length * lh(11) + 4;
  }

  // ── Info-grid (4 colonnes) ───────────────────────────────────────────────
  const infoItems = [
    { label: "Maître d'ouvrage", value: projet.moa },
    { label: 'Architecte', value: projet.architecte },
    {
      label: 'Budget · Surface',
      value: projet.budgetHT,
      sub: projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined,
    },
    {
      label: 'Calendrier',
      value: projet.anneeLivraison?.toString(),
      sub: projet.missionAi ?? undefined,
    },
  ].filter(i => i.value);

  if (infoItems.length) {
    doc.setDrawColor(...BK);
    doc.setLineWidth(0.3);
    doc.line(L, y, R, y);
    y += 2.5;

    const colW = W / 4;
    const rowH = 13;

    for (let i = 0; i < infoItems.length; i++) {
      const item = infoItems[i];
      const cx = L + i * colW;

      doc.setFont('OpenSans', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...RD);
      doc.text((item.label ?? '').toUpperCase(), cx, y);

      doc.setFont('Newsreader', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...BK);
      doc.text(String(item.value ?? ''), cx, y + lh(7));

      if (item.sub) {
        doc.setFont('OpenSans', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...N70);
        doc.text(item.sub, cx, y + lh(7) + lh(10) + 0.5);
      }

      if (i < infoItems.length - 1) {
        doc.setDrawColor(...GR);
        doc.setLineWidth(0.2);
        doc.line(cx + colW - 1, y - 1, cx + colW - 1, y + rowH - 1);
      }
    }
    y += rowH;
    doc.setDrawColor(...BK);
    doc.setLineWidth(0.3);
    doc.line(L, y, R, y);
    y += 4;
  }

  // ── Info secondaire ──────────────────────────────────────────────────────
  const secItems = [
    ['Pôle', projet.pole], ['Département', projet.departement], ['Programme', projet.programme],
    ['Rehab / Neuf', projet.rehabNeuf], ['Mandataire', projet.mandataire],
    ['BET associés', projet.betAssocies], ['Entreprise', projet.entreprise], ['Bailleur', projet.bailleur],
  ].filter(([, v]) => v) as [string, string][];

  if (secItems.length) {
    const cols = Math.min(4, secItems.length);
    const secColW = W / cols;
    const rowCount = Math.ceil(secItems.length / cols);

    for (let i = 0; i < secItems.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = L + col * secColW;
      const cy = y + row * 10;

      doc.setFont('OpenSans', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...N70);
      doc.text(secItems[i][0].toUpperCase(), cx, cy);

      doc.setFont('OpenSans', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...BK);
      doc.text(secItems[i][1], cx, cy + lh(6.5));
    }
    y += rowCount * 10 + 3;
  }

  // ── Contenu : texte (gauche) + photos (droite) ───────────────────────────
  // Photos max height : 60 + 2 + 40 + 2 + 40 = 144mm. Plafond pour éviter le débordement sur le footer (285mm).
  const contentY = Math.min(y, 285 - 144 - 5); // 5mm de marge avant footer
  const textW = 72;
  const photoX = L + textW + 6;
  const photoW = W - textW - 6; // ≈ 96mm

  // Photos (4 slots : grande, 2×petite, grande)
  const allPhotos = [projet.photoCouverture, ...(projet.photosProjet ?? [])].filter(
    (p): p is { url: string; filename: string } => Boolean(p)
  );

  const halfW = (photoW - 2) / 2;
  const photoSlots = [
    { x: photoX, y: contentY, w: photoW, h: 60 },
    { x: photoX, y: contentY + 62, w: halfW, h: 40 },
    { x: photoX + halfW + 2, y: contentY + 62, w: halfW, h: 40 },
    { x: photoX, y: contentY + 104, w: photoW, h: 40 },
  ];

  for (let i = 0; i < Math.min(allPhotos.length, photoSlots.length); i++) {
    const slot = photoSlots[i];
    const b64 = images[allPhotos[i].url];
    if (b64) {
      doc.addImage(b64, imgFmt(b64), slot.x, slot.y, slot.w, slot.h, undefined, 'FAST');
    } else {
      doc.setFillColor(...GR);
      doc.rect(slot.x, slot.y, slot.w, slot.h, 'F');
    }
  }

  // Texte (colonne gauche)
  const paragraphs = projet.description.split(/\n\n+/).filter(Boolean);
  let ty = contentY;
  const maxTextY = 270;

  doc.setFont('OpenSans', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BK);

  for (const p of paragraphs) {
    const lines: string[] = doc.splitTextToSize(p, textW);
    if (ty + lines.length * lh(9) > maxTextY) break;
    doc.text(lines, L, ty);
    ty += lines.length * lh(9) + 2.5;
  }

  // Chiffres clés
  if (projet.chiffresCles?.length && ty < maxTextY - 20) {
    ty += 2;
    doc.setDrawColor(...RD);
    doc.setLineWidth(0.3);
    doc.line(L, ty, L + textW, ty);
    ty += 3;

    doc.setFont('OpenSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...RD);
    doc.text('CHIFFRES CLÉS', L, ty);
    ty += lh(8) + 1;

    for (const c of projet.chiffresCles) {
      if (ty > maxTextY) break;
      doc.setFont('OpenSans', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...BK);
      doc.text(String(c.label), L, ty);
      doc.setFont('Newsreader', 'bold');
      doc.text(String(c.valeur), L + textW, ty, { align: 'right' });
      ty += lh(8.5) + 0.5;
      doc.setDrawColor(...GR);
      doc.setLineWidth(0.15);
      doc.line(L, ty, L + textW, ty);
      ty += 0.5;
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const footerY = 285;
  doc.setDrawColor(...GR);
  doc.setLineWidth(0.3);
  doc.line(L, footerY, R, footerY);

  const fY = footerY + 3.5;
  doc.setFont('Newsreader', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...RD);
  doc.text('.A', L, fY);

  doc.setFont('OpenSans', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...N70);
  doc.text(
    "Assemblage ingénierie S.A.S · 137 rue d'Aboukir, 75002 Paris · contact@assemblage.net · assemblage.net",
    105,
    fY,
    { align: 'center' }
  );

  doc.setFont('OpenSans', 'bold');
  doc.text(projet.affaire, R, fY, { align: 'right' });
}
