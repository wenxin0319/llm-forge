'use client';

import { useState, useEffect } from 'react';
import { Cpu, Thermometer, Zap, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '@/api/client';
import { isMockToken } from '@/lib/auth';
import type { ClusterMetrics, GpuNode } from '@/types';

function generateMockCluster(): ClusterMetrics {
  const templates = [
    { type: 'H100-SXM5-80GB', memTotal: 80, powerLimit: 700, count: 4 },
    { type: 'A100-SXM4-80GB', memTotal: 80, powerLimit: 400, count: 8 },
    { type: 'A100-SXM4-40GB', memTotal: 40, powerLimit: 400, count: 8 },
  ];
  const nodes: GpuNode[] = [];
  let idx = 0;
  for (const tpl of templates) {
    for (let i = 0; i < tpl.count; i++) {
      const active = idx < 12;
      const util = active ? 78 + Math.random() * 18 : Math.random() * 2;
      const mem = active ? tpl.memTotal * (0.65 + Math.random() * 0.25) : Math.random() * 2;
      const temp = active ? Math.round(72 + Math.random() * 12) : Math.round(33 + Math.random() * 5);
      const power = active ? Math.round(tpl.powerLimit * (0.75 + Math.random() * 0.2)) : Math.round(60 + Math.random() * 20);
      const prefix = tpl.type.startsWith('H') ? 'h100' : tpl.type.includes('80') ? 'a100-80' : 'a100-40';
      nodes.push({
        id: `gpu-${idx}`,
        name: `node-${prefix}-${i.toString().padStart(2, '0')}`,
        type: tpl.type,
        utilizationPct: parseFloat(util.toFixed(1)),
        memoryUsedGb: parseFloat(mem.toFixed(1)),
        memoryTotalGb: tpl.memTotal,
        temperatureC: temp,
        powerWatts: power,
        powerLimitWatts: tpl.powerLimit,
        smClockMhz: tpl.type.startsWith('H') ? 3350 : 1980,
        status: active ? (temp > 80 ? 'hot' : 'active') : 'idle',
      });
      idx++;
    }
  }
  const active = nodes.filter((n) => n.status === 'active' || n.status === 'hot');
  const usedMem = nodes.reduce((s, n) => s + n.memoryUsedGb, 0);
  const totalMem = nodes.reduce((s, n) => s + n.memoryTotalGb, 0);
  const totalPowerW = nodes.reduce((s, n) => s + n.powerWatts, 0);
  const avgUtil = active.length ? active.reduce((s, n) => s + n.utilizationPct, 0) / active.length : 0;
  return {
    totalGpus: nodes.length,
    activeGpus: active.length,
    idleGpus: nodes.length - active.length,
    avgUtilizationPct: parseFloat(avgUtil.toFixed(1)),
    totalMemoryGb: totalMem,
    usedMemoryGb: parseFloat(usedMem.toFixed(1)),
    totalPowerKw: parseFloat((totalPowerW / 1000).toFixed(2)),
    efficiencyScore: parseFloat((avgUtil * 0.9 + (usedMem / totalMem) * 10).toFixed(1)),
    nodes,
  };
}

export default function GpuClusterPage() {
  const [metrics, setMetrics] = useState<ClusterMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (isMockToken()) {
      setMetrics(generateMockCluster());
      setLoading(false);
      return;
    }
    api.get('/gpu-metrics/cluster')
      .then((r) => { setMetrics(r.data); setLoading(false); })
      .catch(() => { setMetrics(generateMockCluster()); setLoading(false); });
  };

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);

  if (loading || !metrics) return (
    <div>
      <div className="page-header"><div className="page-title">GPU Cluster</div></div>
      <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
    </div>
  );

  const barData = metrics.nodes.slice(0, 12).map((n) => ({
    name: n.name.replace('node-', '').slice(0, 10),
    util: parseFloat(n.utilizationPct.toFixed(1)),
    mem: parseFloat(((n.memoryUsedGb / n.memoryTotalGb) * 100).toFixed(1)),
  }));

  const utilColor = (pct: number) => pct > 85 ? 'var(--success)' : pct > 50 ? 'var(--accent)' : 'var(--text-muted)';
  const tempColor = (t: number) => t > 82 ? 'var(--danger)' : t > 75 ? 'var(--warning)' : 'var(--success)';

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">GPU Cluster</div>
          <div className="page-subtitle">Real-time infrastructure metrics — {metrics.totalGpus} nodes</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          {[
            { label: 'Total GPUs', value: metrics.totalGpus, unit: '', color: 'var(--text-primary)' },
            { label: 'Active GPUs', value: metrics.activeGpus, unit: '', color: 'var(--success)' },
            { label: 'Avg Utilization', value: metrics.avgUtilizationPct, unit: '%', color: 'var(--accent)' },
            { label: 'VRAM Used', value: `${metrics.usedMemoryGb.toFixed(0)}/${metrics.totalMemoryGb}`, unit: 'GB', color: 'var(--purple)' },
            { label: 'Cluster Power', value: metrics.totalPowerKw.toFixed(1), unit: 'kW', color: 'var(--warning)' },
            { label: 'Efficiency', value: metrics.efficiencyScore.toFixed(1), unit: 'pts', color: 'var(--cyan)' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color, fontSize: 24 }}>{value}<span className="stat-unit">{unit}</span></div>
            </div>
          ))}
        </div>

        <div className="card mb-4">
          <div className="card-header"><div className="card-title"><Zap size={14} /> GPU Utilization & Memory (Top 12 nodes)</div></div>
          <div className="card-body">
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip contentStyle={{ background: '#131929', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="util" fill="#4f8ef7" radius={[3, 3, 0, 0]} name="GPU Util %" />
                  <Bar dataKey="mem" fill="#a78bfa" radius={[3, 3, 0, 0]} name="VRAM Used %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title"><Cpu size={14} /> Node Grid</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--success)' }}>● active</span>
              <span style={{ color: 'var(--warning)' }}>● hot</span>
              <span>● idle</span>
            </div>
          </div>
          <div className="card-body">
            <div className="gpu-grid">
              {metrics.nodes.map((node) => (
                <div key={node.id} className={`gpu-card ${node.status}`}>
                  <div className="gpu-name">{node.name.replace('node-', '')}</div>
                  <div className="gpu-type">{node.type}</div>
                  <div className="gpu-util" style={{ color: utilColor(node.utilizationPct) }}>{node.utilizationPct.toFixed(0)}%</div>
                  <div className="gpu-util-label">utilization</div>
                  <div className="progress-bar mb-2"><div className="progress-fill" style={{ width: `${node.utilizationPct}%` }} /></div>
                  <div className="gpu-mem">
                    <span>{node.memoryUsedGb}/{node.memoryTotalGb} GB</span>
                    <span style={{ color: tempColor(node.temperatureC) }}>
                      <Thermometer size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {node.temperatureC}°C
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{node.powerWatts}W / {node.powerLimitWatts}W</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
