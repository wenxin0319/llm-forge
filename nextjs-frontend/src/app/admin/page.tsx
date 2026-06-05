'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Shield, RefreshCw, Crown, Clock, Cpu } from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/lib/auth';
import type { User } from '@/types';

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = { enterprise: 'badge-purple', pro: 'badge-blue', free: 'badge-gray' };
  return <span className={`badge ${map[plan] || 'badge-gray'}`}>{plan}</span>;
}

function RoleBadge({ role }: { role: string }) {
  return role === 'admin'
    ? <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Crown size={10} /> Admin</span>
    : <span className="badge badge-gray">User</span>;
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<(User & { role: string })[]>([]);
  const [stats, setStats] = useState<{ totalUsers: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Redirect non-admins immediately
    if (currentUser && (currentUser as any).role !== 'admin') {
      router.replace('/');
    }
  }, [currentUser, router]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats'),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string }; status?: number } };
      if (err.response?.status === 403) {
        setError('Access denied — admin only');
      } else {
        setError('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.name.toLowerCase().includes(search.toLowerCase())
  );

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const proCount = users.filter((u) => u.plan !== 'free').length;

  if (error) {
    return (
      <div>
        <div className="page-header"><div className="page-title">Admin</div></div>
        <div className="page-content">
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Shield size={40} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>{error}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Only admin accounts can access this page.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="page-title">Admin Panel</div>
            <span className="badge badge-yellow"><Crown size={11} /> Admin</span>
          </div>
          <div className="page-subtitle">Manage all registered users and platform activity</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="page-content">
        {/* Stats row */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {[
            { label: 'Total Users', value: stats?.totalUsers ?? '—', icon: Users, color: 'var(--accent)' },
            { label: 'Admins', value: adminCount, icon: Crown, color: 'var(--warning)' },
            { label: 'Paid Accounts', value: proCount, icon: Cpu, color: 'var(--success)' },
            { label: 'Free Accounts', value: users.length - proCount, icon: Clock, color: 'var(--text-muted)' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="stat-label">{label}</div>
                <Icon size={15} style={{ color, opacity: 0.8 }} />
              </div>
              <div className="stat-value" style={{ fontSize: 26 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Users size={14} /> Registered Users</div>
            <input
              className="form-input"
              style={{ width: 240, padding: '6px 12px', fontSize: 12 }}
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">No users found</div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Plan</th>
                  <th>GPU Quota</th>
                  <th>GPU Used</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} style={{ background: u.email === currentUser?.email ? 'rgba(79,142,247,0.04)' : undefined }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: u.role === 'admin' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#4f8ef7,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                            {u.name}
                            {u.email === currentUser?.email && (
                              <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6, fontWeight: 400 }}>(you)</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {u.id.slice(0, 8)}…</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{u.email}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td><PlanBadge plan={u.plan} /></td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{u.gpuQuotaHours}h</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 60 }}>
                          <div className="progress-fill" style={{ width: `${Math.min(100, (u.usedGpuHours / u.gpuQuotaHours) * 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{u.usedGpuHours}h</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
              {filtered.length} user{filtered.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ' total'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
