'use client';

// Error boundary brandée pour l'ensemble de l'app (segment racine).
// Capture toute exception de rendu non gérée dans les routes enfants et
// affiche un écran Assemblage plutôt que la page d'erreur par défaut de Next.

import { useEffect } from 'react';
import styles from './error-screen.module.css';

const LOGO_URL =
  'https://hhkofvbptnrtwbazftlm.supabase.co/storage/v1/object/public/Branding/logo/logo_Ai_rouge.svg';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app-error]', error);
  }, [error]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.logoImg} src={LOGO_URL} alt="Assemblage ingénierie" />
        <p className={styles.code}>Erreur</p>
        <h1 className={styles.title}>Une erreur est survenue</h1>
        <p className={styles.message}>
          Quelque chose s&apos;est mal passé de notre côté. Vous pouvez réessayer ou
          revenir au portfolio.
        </p>
        {error.digest && <p className={styles.digest}>Réf. : {error.digest}</p>}
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={() => reset()}>
            Réessayer
          </button>
          <a className={styles.secondaryBtn} href="/">
            Retour au portfolio
          </a>
        </div>
      </div>
    </div>
  );
}
