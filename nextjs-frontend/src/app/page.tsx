'use client';

import { useState, useEffect } from 'react';
import { Database, Box, Zap, Cpu, TrendingUp, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Link from 'next/link';
import api from '@/api/client';
import { useAuth } from '@/lib/auth';
import type { TrainingJob } from '@/types';

const MOCK_THROUGHPUT = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  tokens: Math.round(1200 + Math.random() * 800 + (i > 6 && i < 22 ? 600 : 0)),
  gpuUtil: Math.round(55 + Math.random() * 30 + (i > 8 && i < 20 ? 15 : 0)),
}));

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { completed: 'badge-green', running: 'badge-blue', queued: 'badge-yellow', failed: 'badge-red', cancelled: 'badge-gray', initializing: 'badge-cyan' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<TrainingJob[]>([]);

  useEffect(() => { api.get('/jobs').then((r) => setJobs(r.data)).catch(() => {}); }, []);

  const activeJobs = jobs.filter((j) => j.status === 'training' || j.status === 'preprocessing');
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const totalSpent = jobs.reduce((s, j) => s + (j.actualCostUsd || j.estimatedCostUsd), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Platform overview and activity</div>
        </div>
      </div>

      <div className="page-content">
        <div className="hero-gradient">
          <div>
            <div className="hero-title">Welcome back, {user?.name?.split(' ')[0] || 'Developer'}</div>
            <div className="hero-sub">Your GPU-accelerated LLM training platform is ready. Upload datasets, configure models, and launch distributed training jobs with one click.</div>
            <div className="flex gap-2 mt-3">
              <Link href="/datasets" className="btn btn-primary btn-sm"><Database size={13} /> New Dataset</Link>
              <Link href="/models" className="btn btn-secondary btn-sm"><Box size={13} /> Create Model</Link>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            {[{ label: 'GPU Nodes', value: '20', icon: Cpu, color: 'var(--accent)' }, { label: 'Avg Util', value: '87%', icon: TrendingUp, color: 'var(--success)' }].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', minWidth: 100 }}>
                <Icon size={20} style={{ color, margin: '0 auto 8px' }} />
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-grid">
          {[
            { label: 'Active Jobs', value: activeJobs.length, icon: Zap, color: 'var(--accent)' },
            { label: 'Completed Runs', value: completedJobs.length, icon: TrendingUp, color: 'var(--success)' },
            { label: 'GPU Hours Used', value: user ? `${user.usedGpuHours}/${user.gpuQuotaHours}` : '—', icon: Clock, color: 'var(--warning)' },
            { label: 'Total Spend', value: `$${totalSpent.toFixed(2)}`, icon: Cpu, color: 'var(--purple)' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <div className="stat-label">{label}</div>
                <Icon size={16} style={{ color, opacity: 0.8 }} />
              </div>
              <div className="stat-value" style={{ fontSize: 26 }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid-2 mb-4">
          {[
            { title: 'Token Throughput (24h)', key: 'tokens', color: '#4f8ef7', grad: 'tokGrad', name: 'Tokens/s', yUnit: '' as const },
            { title: 'GPU Utilization (24h)', key: 'gpuUtil', color: '#a78bfa', grad: 'gpuGrad', name: 'GPU Util %', yUnit: '%' as const },
          ].map(({ title, key, color, grad, name, yUnit }) => (
            <div key={title} className="card">
              <div className="card-header"><div className="card-title"><TrendingUp size={14} /> {title}</div></div>
              <div className="card-body">
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_THROUGHPUT} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} interval={3} />
                      <YAxis tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} unit={yUnit} />
                      <Tooltip contentStyle={{ background: '#131929', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey={key} stroke={color} strokeWidth={2} fill={`url(#${grad})`} name={name} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title"><Zap size={14} /> Recent Training Jobs</div></div>
          {jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Zap size={36} /></div>
              <div className="empty-state-text">No training jobs yet</div>
              <div className="empty-state-sub">Go to Training to launch your first job</div>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Model</th><th>Dataset</th><th>Status</th><th>Progress</th><th>Cost</th><th>Started</th></tr></thead>
              <tbody>
                {jobs.slice(0, 8).map((j) => (
                  <tr key={j.id}>
                    <td><strong>{j.modelName}</strong></td>
                    <td>{j.datasetName}</td>
                    <td><StatusBadge status={j.status} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 80 }}><div className="progress-fill" style={{ width: `${j.progress}%` }} /></div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.progress}%</span>
                      </div>
                    </td>
                    <td>${(j.actualCostUsd || j.estimatedCostUsd).toFixed(2)}</td>
                    <td style={{ fontSize: 12 }}>{j.startedAt ? new Date(j.startedAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
