'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/types';
import api from '@/api/client';

// ── Mock credentials (no backend required) ───────────────────────────────────

const MOCK_USERS: { email: string; password: string; user: User }[] = [
  {
    email: 'demo@llmforge.ai',
    password: 'demo1234',
    user: { id: 'mock-1', email: 'demo@llmforge.ai', name: 'Demo User', plan: 'pro', gpuQuotaHours: 100, usedGpuHours: 23, createdAt: '2026-01-01' },
  },
  {
    email: 'cwx0319@gmail.com',
    password: 'demo1234',
    user: { id: 'mock-2', email: 'cwx0319@gmail.com', name: 'Wenxin C.', plan: 'enterprise', gpuQuotaHours: 500, usedGpuHours: 47, createdAt: '2026-01-01' },
  },
];

export function mockLogin(email: string, password: string): { token: string; user: User } | null {
  const match = MOCK_USERS.find((u) => u.email === email && u.password === password);
  if (!match) return null;
  return { token: `mock_${match.user.id}`, user: match.user };
}

export const DEMO_CREDENTIALS = { email: 'demo@llmforge.ai', password: 'demo1234' };

// ── Auth context ─────────────────────────────────────────────────────────────

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    if (token.startsWith('mock_')) {
      try { setUser(JSON.parse(localStorage.getItem('mockUser') ?? '')); } catch {}
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    if (token.startsWith('mock_')) localStorage.setItem('mockUser', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('mockUser');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
