'use client';

import { useState } from 'react';
import { useAuth, mockLogin } from '@/lib/auth';
import api from '@/api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    setLoading(true);
    setError('');

    // Try mock credentials first — works without any backend
    if (mode === 'login') {
      const mock = mockLogin(form.email, form.password);
      if (mock) { login(mock.token, mock.user); setLoading(false); return; }
    }

    try {
      const url = mode === 'login' ? '/auth/login' : '/auth/register';
      const { data } = await api.post(url, form);
      login(data.token, data.user);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'No backend running — use the demo account below');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ width: 400, padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#4f8ef7,#a78bfa)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 20, fontWeight: 800, color: '#fff' }}>LF</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>LLM Forge</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Build your own AI models</div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 16, padding: 28 }}>
          <div className="flex mb-4" style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 4 }}>
            {(['login', 'register'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className="btn" style={{
                flex: 1, borderRadius: 6, fontSize: 13, padding: '7px 0',
                background: mode === m ? 'var(--bg-card)' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                border: mode === m ? '1px solid var(--border-light)' : '1px solid transparent',
              }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Alice Smith" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>

          <div className="form-group" style={{ marginBottom: error ? 12 : 20 }}>
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handle()} />
          </div>

          {error && (
            <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary w-full" onClick={handle} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {mode === 'login' && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Demo Accounts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { email: 'demo@llmforge.ai', password: 'demo1234', label: 'Demo User' },
                  { email: 'cwx0319@gmail.com', password: 'demo1234', label: 'Wenxin C.' },
                ].map((cred) => (
                  <button
                    key={cred.email}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, email: cred.email, password: cred.password }))}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-light)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-light)')}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{cred.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{cred.email}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                Password for all demo accounts: <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>demo1234</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Open-source GPU-accelerated LLM training platform
        </div>
      </div>
    </div>
  );
}
