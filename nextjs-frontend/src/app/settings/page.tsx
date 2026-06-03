'use client';

import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null;
  const gpuPct = Math.round((user.usedGpuHours / user.gpuQuotaHours) * 100);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Account and plan management</div>
        </div>
      </div>
      <div className="page-content">
        <div className="grid-2 mb-4">
          <div className="card">
            <div className="card-header"><div className="card-title">Profile</div></div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{user.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Plan</span>
                <span className={`badge ${user.plan === 'enterprise' ? 'badge-purple' : user.plan === 'pro' ? 'badge-blue' : 'badge-gray'}`}>{user.plan.toUpperCase()}</span>
              </div>
              <div className="divider" />
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Member since {new Date(user.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">GPU Quota</div></div>
            <div className="card-body">
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Monthly GPU compute hours included in your plan</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Used</span>
                <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{user.usedGpuHours}h / {user.gpuQuotaHours}h</span>
              </div>
              <div className="progress-bar mb-2"><div className="progress-fill" style={{ width: `${gpuPct}%` }} /></div>
              <div style={{ fontSize: 11, color: gpuPct > 80 ? 'var(--warning)' : 'var(--text-muted)' }}>{gpuPct}% used — {user.gpuQuotaHours - user.usedGpuHours}h remaining</div>
              {user.plan === 'free' && <button className="btn btn-primary btn-sm mt-3">Upgrade to Pro</button>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">API Access</div></div>
          <div className="card-body">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Use the REST API to integrate LLM Forge into your pipelines. Swagger docs at{' '}
              <span className="font-mono" style={{ color: 'var(--accent)', fontSize: 12 }}>http://localhost:3001/api/docs</span>
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              Authorization: Bearer YOUR_JWT_TOKEN
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
