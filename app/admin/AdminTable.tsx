'use client';

import { useState } from 'react';
import { authHeaders } from '@/lib/supabase/authHeaders';
import styles from './admin.module.css';

interface Profile {
  id: string;
  email: string;
  role: string;
  is_approved: boolean;
  created_at: string;
}

export default function AdminTable({ profiles: initial }: { profiles: Profile[] }) {
  const [profiles, setProfiles] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);

  async function update(id: string, patch: Partial<Profile>) {
    setLoading(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    }
    setLoading(null);
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Rôle</th>
            <th>Statut</th>
            <th>Inscrit le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map(p => (
            <tr key={p.id}>
              <td>{p.email}</td>
              <td>
                <span className={p.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}>
                  {p.role}
                </span>
              </td>
              <td>
                <span className={p.is_approved ? styles.badgeOk : styles.badgePending}>
                  {p.is_approved ? 'Approuvé' : 'En attente'}
                </span>
              </td>
              <td className={styles.date}>
                {new Date(p.created_at).toLocaleDateString('fr-FR')}
              </td>
              <td className={styles.actions}>
                {p.is_approved ? (
                  <button
                    className={styles.btnRevoke}
                    disabled={loading === p.id}
                    onClick={() => update(p.id, { is_approved: false })}
                  >Révoquer</button>
                ) : (
                  <button
                    className={styles.btnApprove}
                    disabled={loading === p.id}
                    onClick={() => update(p.id, { is_approved: true })}
                  >Approuver</button>
                )}
                {p.role === 'user' ? (
                  <button
                    className={styles.btnAdmin}
                    disabled={loading === p.id}
                    onClick={() => update(p.id, { role: 'admin' })}
                  >→ Admin</button>
                ) : (
                  <button
                    className={styles.btnAdmin}
                    disabled={loading === p.id}
                    onClick={() => update(p.id, { role: 'user' })}
                  >→ User</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
