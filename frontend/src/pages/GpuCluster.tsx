import { useState, useEffect } from 'react';
import { Cpu, Thermometer, Zap, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client';
import type { ClusterMetrics } from '../types';

function UtilColor(pct: number): string {
  if (pct > 85) return 'var(--success)';
  if (pct > 50) return 'var(--accent)';
  return 'var(--text-muted)';
}

function TempColor(t: number): string {
  if (t > 82) return 'var(--danger)';
  if (t > 75) return 'var(--warning)';
  return 'var(--success)';
}

export default function GpuCluster() {
  const [metrics, setMetrics] = useState<ClusterMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/gpu-metrics/cluster').then((r) => {
      setMetrics(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  if (loading || !metrics) {
    return (
      <div>
        <div className="page-header"><div className="page-title">GPU Cluster</div></div>
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      </div>
    );
  }

  const barData = metrics.nodes.slice(0, 12).map((n) => ({
    name: n.name.replace('node-', '').slice(0, 10),
    util: parseFloat(n.utilizationPct.toFixed(1)),
    mem: parseFloat(((n.memoryUsedGb / n.memoryTotalGb) * 100).toFixed(1)),
  }));

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
              <div className="stat-value" style={{ color, fontSize: 24 }}>
                {value}<span className="stat-unit">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <div className="card-title"><Zap size={14} /> GPU Utilization & Memory (Top 12 nodes)</div>
          </div>
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
            <div className="flex gap-3" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
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
                  <div className="gpu-util" style={{ color: UtilColor(node.utilizationPct) }}>
                    {node.utilizationPct.toFixed(0)}%
                  </div>
                  <div className="gpu-util-label">utilization</div>
                  <div className="progress-bar mb-2">
                    <div className="progress-fill" style={{ width: `${node.utilizationPct}%` }} />
                  </div>
                  <div className="gpu-mem">
                    <span>{node.memoryUsedGb}/{node.memoryTotalGb} GB</span>
                    <span style={{ color: TempColor(node.temperatureC) }}>
                      <Thermometer size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                      {node.temperatureC}°C
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    {node.powerWatts}W / {node.powerLimitWatts}W
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
