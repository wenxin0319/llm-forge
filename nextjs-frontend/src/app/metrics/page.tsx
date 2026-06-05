'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Zap, Cpu, TrendingDown, Activity, Box, Clock } from 'lucide-react';
import api from '@/api/client';

const MOCK_MODEL_POPULARITY = [
  { model: 'Mistral 7B', jobs: 142 },
  { model: 'Llama 3.1 8B', jobs: 118 },
  { model: 'Phi-4', jobs: 87 },
  { model: 'DeepSeek-R1-7B', jobs: 64 },
  { model: 'Gemma 4 26B', jobs: 51 },
  { model: 'Qwen2.5-7B', jobs: 43 },
  { model: 'Llama 3.1 70B', jobs: 29 },
  { model: 'Phi-4-reasoning', jobs: 22 },
];

const MOCK_METHOD_DIST = [
  { name: 'QLoRA', value: 61, color: '#4f8ef7' },
  { name: 'LoRA', value: 24, color: '#a78bfa' },
  { name: 'DPO', value: 10, color: '#22d3ee' },
  { name: 'Full FT', value: 5, color: '#f59e0b' },
];

const MOCK_PERF = Array.from({ length: 20 }, (_, i) => ({
  day: `Jun ${i + 1}`,
  avgTps: Math.round(1600 + i * 20 + Math.floor(Math.random() * 300)),
  jobs: Math.round(4 + Math.floor(Math.random() * 9)),
}));

const MOCK_LOSS_DIST = [
  { range: '< 0.5', count: 12 },
  { range: '0.5–0.8', count: 47 },
  { range: '0.8–1.2', count: 89 },
  { range: '1.2–1.8', count: 61 },
  { range: '1.8–2.5', count: 34 },
  { range: '> 2.5', count: 8 },
];

const CHART_STYLE = { background: '#131929', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 };
const TICK = { fontSize: 10, fill: '#4d6080' };

interface StatCardProps { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }
function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <div className="stat-label">{label}</div>
        <Icon size={16} style={{ color, opacity: 0.8 }} />
      </div>
      <div className="stat-value" style={{ fontSize: 26 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

interface UsageStat { catalogModelId: string; method: string; jobCount: number }

export default function MetricsPage() {
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [usingLive, setUsingLive] = useState(false);

  useEffect(() => {
    api.get('/catalog/usage/stats')
      .then((r) => { setUsageStats(r.data); setUsingLive(true); })
      .catch(() => setUsingLive(false));
  }, []);

  const liveModelPop = usageStats.length > 0
    ? Object.entries(
        usageStats.reduce<Record<string, number>>((acc, s) => {
          acc[s.catalogModelId] = (acc[s.catalogModelId] || 0) + s.jobCount;
          return acc;
        }, {})
      )
      .map(([id, jobs]) => ({
        model: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 20),
        jobs,
      }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 8)
    : null;

  const liveMethodDist = usageStats.length > 0
    ? Object.entries(
        usageStats.reduce<Record<string, number>>((acc, s) => {
          acc[s.method] = (acc[s.method] || 0) + s.jobCount;
          return acc;
        }, {})
      ).map(([name, value], i) => ({
        name: name.toUpperCase(),
        value,
        color: ['#4f8ef7', '#a78bfa', '#22d3ee', '#f59e0b'][i] ?? '#64748b',
      }))
    : null;

  const modelPop = liveModelPop ?? MOCK_MODEL_POPULARITY;
  const methodDist = liveMethodDist ?? MOCK_METHOD_DIST;
  const totalJobs = methodDist.reduce((s, m) => s + m.value, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Metrics</div>
          <div className="page-subtitle">
            Platform usage, model popularity, and training performance
            {!usingLive && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                (demo data — connect backend for live stats)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* Summary stat cards */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <StatCard label="Total Jobs" value={totalJobs.toLocaleString()} sub="all time" icon={Zap} color="var(--accent)" />
          <StatCard label="Models in Catalog" value={14} sub="open-source" icon={Box} color="var(--purple)" />
          <StatCard label="Avg Throughput" value="1,940 tok/s" sub="across completed jobs" icon={Activity} color="var(--success)" />
          <StatCard label="Avg Train Time" value="24 min" sub="per job" icon={Clock} color="var(--warning)" />
          <StatCard label="Avg Final Loss" value="0.84" sub="train loss at completion" icon={TrendingDown} color="var(--cyan, #22d3ee)" />
          <StatCard label="GPU Nodes" value={20} sub="H100 + A100 cluster" icon={Cpu} color="var(--accent)" />
        </div>

        {/* Model popularity + method pie */}
        <div className="grid-2 mb-4">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Box size={14} /> Base Model Popularity</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jobs launched per model</div>
            </div>
            <div className="card-body">
              <div style={{ height: 270 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelPop} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" horizontal={false} />
                    <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="model" tick={{ ...TICK, fontSize: 11 }} tickLine={false} axisLine={false} width={115} />
                    <Tooltip contentStyle={CHART_STYLE} cursor={{ fill: '#1e2d4a' }} />
                    <Bar dataKey="jobs" fill="#4f8ef7" radius={[0, 4, 4, 0]} name="Jobs launched" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title"><Activity size={14} /> Fine-tuning Method Mix</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Share of jobs by method</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ height: 210, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={methodDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {methodDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={CHART_STYLE} formatter={(v) => [`${Number(v)} jobs`, '']} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                {methodDist.map((m) => (
                  <div key={m.name} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>
                      {Math.round((m.value / totalJobs) * 100)}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Throughput trend + loss distribution */}
        <div className="grid-2 mb-4">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Zap size={14} /> Daily Avg Throughput</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tokens/sec across all jobs</div>
            </div>
            <div className="card-body">
              <div style={{ height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={MOCK_PERF} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                    <XAxis dataKey="day" tick={TICK} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={TICK} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={CHART_STYLE} formatter={(v) => [`${Number(v).toLocaleString()} tok/s`, 'Avg throughput']} />
                    <Line type="monotone" dataKey="avgTps" stroke="#22d3ee" strokeWidth={2} dot={false} name="Avg tok/s" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title"><TrendingDown size={14} /> Final Loss Distribution</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Train loss at job completion</div>
            </div>
            <div className="card-body">
              <div style={{ height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_LOSS_DIST} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                    <XAxis dataKey="range" tick={TICK} tickLine={false} axisLine={false} />
                    <YAxis tick={TICK} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={CHART_STYLE} cursor={{ fill: '#1e2d4a' }} />
                    <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Jobs" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Jobs per day */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Activity size={14} /> Jobs Launched Per Day</div>
          </div>
          <div className="card-body">
            <div style={{ height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_PERF} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                  <XAxis dataKey="day" tick={TICK} tickLine={false} axisLine={false} interval={3} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_STYLE} cursor={{ fill: '#1e2d4a' }} />
                  <Bar dataKey="jobs" fill="#4f8ef7" radius={[3, 3, 0, 0]} name="Jobs launched" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
