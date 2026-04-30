import type { jsPDF } from 'jspdf';

type Doc = jsPDF;

const FONTS = [
  { file: 'Newsreader-Regular.ttf',  family: 'Newsreader',  style: 'normal' },
  { file: 'Newsreader-Italic.ttf',   family: 'Newsreader',  style: 'italic' },
  { file: 'Newsreader-SemiBold.ttf', family: 'Newsreader',  style: 'bold'   },
  { file: 'OpenSans-Regular.ttf',    family: 'OpenSans',    style: 'normal' },
  { file: 'OpenSans-SemiBold.ttf',   family: 'OpenSans',    style: 'bold'   },
] as const;

let _registered = false;

async function ttfToBase64(path: string): Promise<string> {
  const res = await fetch(path);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function registerFonts(doc: Doc): Promise<void> {
  if (_registered) return;
  await Promise.all(
    FONTS.map(async ({ file, family, style }) => {
      const b64 = await ttfToBase64(`/fonts/${file}`);
      doc.addFileToVFS(file, b64);
      doc.addFont(file, family, style);
    })
  );
  _registered = true;
}
