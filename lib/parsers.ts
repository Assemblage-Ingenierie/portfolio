export function parseChiffresCles(raw: string | undefined): { label: string; valeur: string }[] {
  if (!raw?.trim()) return [];
  return raw
    .split('|')
    .map((part) => {
      const idx = part.lastIndexOf(':');
      if (idx === -1) {
        // Format "Valeur Label" without colon — treat whole part as valeur
        const trimmed = part.trim();
        return trimmed ? { label: trimmed, valeur: '' } : null;
      }
      return {
        label: part.slice(0, idx).trim(),
        valeur: part.slice(idx + 1).trim(),
      };
    })
    .filter((x): x is { label: string; valeur: string } => x !== null && x.label !== '');
}

export function parseTagsSiteWeb(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split('|')
    .map((t) => {
      // Strip subcategory prefix "Category>Tag" → "Tag"
      const parts = t.split('>');
      return parts[parts.length - 1].trim();
    })
    .filter(Boolean);
}

export function formatBudget(raw: number | string | undefined): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^\d.]/g, ''));
  if (isNaN(n)) return String(raw);
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M€ HT`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k€ HT`;
  return `${n.toLocaleString('fr-FR')} €`;
}
