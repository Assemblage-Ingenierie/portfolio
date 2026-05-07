'use client';

import { useEffect, useRef, useState } from 'react';
import TurndownService from 'turndown';
import { Marked } from 'marked';

// Conversions HTML <-> Markdown.
// On préserve <u> (souligné, pas standard markdown mais supporté par Airtable
// via HTML inline) et on garde GFM (listes, liens, gras, italique).
const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
td.keep(['u']);
const md = new Marked({ gfm: true, breaks: true });

interface Props {
  value: string;          // markdown
  onChange: (md: string) => void;
  placeholder?: string;
  minRows?: number;
}

const TOOLBAR_BTN: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: '11pt', fontWeight: 500,
  padding: '4px 10px', border: '1px solid #DFE4E8', borderRadius: '2px',
  background: 'white', cursor: 'pointer', minWidth: '32px',
};

/**
 * Éditeur rich text simple basé sur contenteditable.
 * - Toolbar : gras / italique / souligné / liens / listes
 * - Stocke et expose la valeur en markdown
 * - Initialise le contenu depuis le markdown au mount uniquement
 *   (pas de re-render contrôlé pour ne pas casser la sélection)
 */
export default function RichTextEditor({ value, onChange, placeholder, minRows = 10 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // Init au mount : convertit le markdown initial en HTML
  useEffect(() => {
    if (ref.current && ref.current.innerHTML === '') {
      ref.current.innerHTML = md.parse(value || '', { async: false }) as string;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncToMarkdown() {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    onChange(td.turndown(html));
  }

  // exec via execCommand : déprécié officiellement mais supporté partout
  // et largement plus simple qu'une réimplémentation Selection/Range.
  function exec(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    syncToMarkdown();
  }

  function insertLink() {
    const url = window.prompt('URL du lien :');
    if (url) exec('createLink', url);
  }

  return (
    <div style={{ border: '1px solid #DFE4E8', borderRadius: '2px', background: 'white', boxShadow: focused ? '0 0 0 1px var(--ai-violet) inset' : 'none' }}>
      <div style={{ display: 'flex', gap: '4px', padding: '6px', borderBottom: '1px solid #DFE4E8', background: '#F8F9FA' }}>
        <button type="button" onClick={() => exec('bold')} style={{ ...TOOLBAR_BTN, fontWeight: 700 }} title="Gras (Ctrl+B)">B</button>
        <button type="button" onClick={() => exec('italic')} style={{ ...TOOLBAR_BTN, fontStyle: 'italic' }} title="Italique (Ctrl+I)">I</button>
        <button type="button" onClick={() => exec('underline')} style={{ ...TOOLBAR_BTN, textDecoration: 'underline' }} title="Souligné (Ctrl+U)">U</button>
        <span style={{ width: '1px', background: '#DFE4E8', margin: '2px 4px' }} />
        <button type="button" onClick={() => exec('insertUnorderedList')} style={TOOLBAR_BTN} title="Liste à puces">•</button>
        <button type="button" onClick={() => exec('insertOrderedList')} style={TOOLBAR_BTN} title="Liste numérotée">1.</button>
        <span style={{ width: '1px', background: '#DFE4E8', margin: '2px 4px' }} />
        <button type="button" onClick={insertLink} style={TOOLBAR_BTN} title="Insérer un lien">🔗</button>
        <button type="button" onClick={() => exec('removeFormat')} style={TOOLBAR_BTN} title="Effacer le formatage">⌫</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={syncToMarkdown}
        onBlur={() => { setFocused(false); syncToMarkdown(); }}
        onFocus={() => setFocused(true)}
        data-placeholder={placeholder}
        style={{
          padding: '10px 12px',
          minHeight: `${minRows * 1.5}em`,
          fontFamily: 'var(--sans)', fontSize: '10pt', lineHeight: 1.5,
          outline: 'none',
        }}
      />
      <style jsx>{`
        div[contenteditable]:empty::before {
          content: attr(data-placeholder);
          color: #999;
          pointer-events: none;
        }
        div[contenteditable] p { margin: 0 0 8px; }
        div[contenteditable] ul, div[contenteditable] ol { margin: 0 0 8px 20px; }
      `}</style>
    </div>
  );
}
