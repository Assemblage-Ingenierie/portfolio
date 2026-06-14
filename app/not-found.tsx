// Page 404 brandée Assemblage ingénierie. Rendue par Next quand une route
// ou un appel à notFound() ne résout aucune page (ex. fiche projet inexistante).

import styles from './error-screen.module.css';

const LOGO_URL =
  'https://hhkofvbptnrtwbazftlm.supabase.co/storage/v1/object/public/Branding/logo/logo_Ai_rouge.svg';

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.logoImg} src={LOGO_URL} alt="Assemblage ingénierie" />
        <p className={styles.code}>Erreur 404</p>
        <h1 className={styles.title}>Page introuvable</h1>
        <p className={styles.message}>
          La page ou la fiche que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <div className={styles.actions}>
          <a className={styles.primaryBtn} href="/">
            Retour au portfolio
          </a>
        </div>
      </div>
    </div>
  );
}
