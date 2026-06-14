'use client';

import { FICHE_STATUS_MESSAGES, type FicheStatus } from '@/lib/pdf/projectConfig';
import { color } from '@/lib/ui/tokens';

interface Props {
  status: FicheStatus;
  /** Appelé pour fermer le popup. Pour les statuts != "Prête pour publication"
   *  c'est juste un dismiss. */
  onClose: () => void;
  /** Appelé quand l'utilisateur choisit "Editer tout de même" sur une fiche
   *  verrouillée. Active l'édition (état contrôlé par ProjetView). */
  onForceEdit?: () => void;
}

export default function FicheStatusPopup({ status, onClose, onForceEdit }: Props) {
  const message = FICHE_STATUS_MESSAGES[status];
  const isLocked = status === 'Prête pour publication';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(48, 50, 62, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--sans)',
      }}
    >
      <div
        style={{
          background: 'white', borderRadius: 12, maxWidth: 460, width: 'calc(100% - 32px)',
          padding: '24px 28px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          borderTop: `4px solid ${isLocked ? color.rouge : 'var(--ai-violet)'}`,
        }}
      >
        <div style={{
          fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 8,
        }}>
          Statut de la fiche
        </div>
        <h2 style={{
          fontFamily: 'var(--sans)', fontSize: '18pt', fontWeight: 300,
          color: 'var(--ai-noir)', marginBottom: 12,
        }}>
          {status}
        </h2>
        <p style={{
          fontSize: '10pt', lineHeight: 1.5, color: 'var(--ai-noir70)',
          marginBottom: 20,
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {isLocked ? (
            <>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px', borderRadius: 2, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700,
                  background: 'var(--ai-violet)', color: 'white',
                }}
              >
                Lecture seule
              </button>
              <button
                onClick={() => { onForceEdit?.(); onClose(); }}
                style={{
                  padding: '8px 16px', borderRadius: 2, cursor: 'pointer',
                  fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700,
                  background: 'white', color: 'var(--ai-rouge)',
                  border: '1px solid var(--ai-rouge)',
                }}
              >
                Editer tout de même
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: 2, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700,
                background: 'var(--ai-violet)', color: 'white',
              }}
            >
              Continuer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
