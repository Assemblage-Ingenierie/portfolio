'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/useAuth';
import { getSupabaseClient } from '@/lib/supabase/client';
import AdminTable from './AdminTable';
import TemplateDefaultsPanel from './TemplateDefaultsPanel';
import styles from './admin.module.css';

interface Profile {
  id: string;
  email: string;
  role: string;
  is_approved: boolean;
  created_at: string;
}

export default function AdminPage() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    const sb = getSupabaseClient();
    sb.from('portfolio_profiles')
      .select('id, email, role, is_approved, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProfiles(data ?? []);
        setLoaded(true);
      });
  }, [profile]);

  if (!profile || profile.role !== 'admin') return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>← Portfolio</Link>
        <div className={styles.logo}>
          <span className={styles.logoText}>Assemblage ingénierie</span>
          <span className={styles.logoDot}>·A</span>
        </div>
        <h1 className={styles.title}>Gestion des accès</h1>
      </header>
      {loaded && <AdminTable profiles={profiles} />}
      <TemplateDefaultsPanel />
    </div>
  );
}
