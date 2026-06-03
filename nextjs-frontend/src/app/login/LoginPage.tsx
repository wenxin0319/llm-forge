'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
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
    try {
      const url = mode === 'login' ? '/auth/login' : '/auth/register';
      const { data } = await api.post(url, form);
      login(data.token, data.user);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'Something went wrong');
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
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Open-source GPU-accelerated LLM training platform
        </div>
      </div>
    </div>
  );
}
