'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { XCircle, Package, RefreshCw, Zap, Cpu, TrendingDown, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import Link from 'next/link';
import api from '@/api/client';
import { getMockJob, getMockProgress, getMockMetrics, getMockLogs } from '@/lib/mockStore';
import type { TrainingJob } from '@/types';

interface MetricPoint {
  step: number; epoch: number; timestampMs?: number;
  trainLoss: number; valLoss: number | null;
  learningRate: number; tokensPerSec: number; stepsPerSec?: number;
  gpuUtilPct?: number[]; gpuMemUsedGb?: number[];
}

interface MetricsSummary {
  totalSteps: number; totalEpochs: number;
  totalTrainingSec: number | null; peakGpuMemGb: number | null;
  avgTokensPerSec: number | null; ttftMs: number | null;
  finalTrainLoss: number | null; finalValLoss: number | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { completed: 'badge-green', training: 'badge-blue', queued: 'badge-yellow', failed: 'badge-red', cancelled: 'badge-gray', preprocessing: 'badge-cyan', packaging: 'badge-purple' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

function elapsed(start?: string) {
  if (!start) return '—';
  const s = Math.floor((Date.now() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function fmtSec(sec: number | null) {
  if (!sec) return '—';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

const CHART_STYLE = { background: '#131929', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 };

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [timeSeries, setTimeSeries] = useState<MetricPoint[]>([]);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const isMock = id?.startsWith('mock-');

  useEffect(() => {
    if (isMock) {
      const mockCfg = getMockJob(id);
      if (!mockCfg) { setLoading(false); return; }

      const refresh = () => {
        const { pct, status, epoch, trainLoss, valLoss, done } = getMockProgress(mockCfg);
        setJob({
          id, modelId: id, modelName: mockCfg.modelName, baseModelId: id,
          datasetId: 'mock-ds', datasetName: mockCfg.datasetName,
          status, progress: pct, currentEpoch: epoch, totalEpochs: mockCfg.totalEpochs,
          trainLoss, valLoss,
          gpuVramGb: mockCfg.gpuVramGb, gpuTflops: mockCfg.gpuTflops,
          estimatedHours: 1.2, estimatedCostUsd: mockCfg.estimatedCostUsd,
          actualCostUsd: done ? +(mockCfg.estimatedCostUsd * 0.96).toFixed(2) : undefined,
          logs: getMockLogs(mockCfg),
          startedAt: mockCfg.startedAt,
          completedAt: done ? new Date(new Date(mockCfg.startedAt).getTime() + 40_000).toISOString() : undefined,
          createdAt: mockCfg.createdAt,
        });
        const raw = getMockMetrics(mockCfg) as MetricPoint[];
        setTimeSeries(raw);
        if (done && raw.length) {
          const tpsVals = raw.map((m) => m.tokensPerSec);
          setSummary({
            totalSteps: raw.length,
            totalEpochs: mockCfg.totalEpochs,
            totalTrainingSec: 38,
            peakGpuMemGb: 61.4,
            avgTokensPerSec: +(tpsVals.reduce((a, b) => a + b, 0) / tpsVals.length).toFixed(1),
            ttftMs: 240,
            finalTrainLoss: raw.at(-1)?.trainLoss ?? null,
            finalValLoss: raw.filter((m) => m.valLoss != null).at(-1)?.valLoss ?? null,
          });
        }
        setTick((p) => p + 1);
        if (done) clearInterval(timer);
      };

      setLoading(false);
      refresh();
      const timer = setInterval(refresh, 1500);
      return () => clearInterval(timer);
    }

    const load = async () => {
      try {
        const [jobRes, metricsRes] = await Promise.all([api.get(`/jobs/${id}`), api.get(`/jobs/${id}/metrics`)]);
        setJob(jobRes.data);
        const m = metricsRes.data;
        if (m && 'timeSeries' in m) {
          setTimeSeries(m.timeSeries);
          setSummary(m.summary);
        } else {
          setTimeSeries(Array.isArray(m) ? m : []);
        }
        setLoading(false);
      } catch { setLoading(false); }
    };
    load();
    const t = setInterval(() => { load(); setTick((p) => p + 1); }, 3000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.logs, tick]);

  const handleCancel = async () => {
    if (!confirm('Cancel this job?')) return;
    if (!isMock) await api.post(`/jobs/${id}/cancel`);
    setJob((j) => j ? { ...j, status: 'cancelled' } : j);
  };

  const isActive = job && ['queued', 'preprocessing', 'training', 'packaging'].includes(job.status);

  // Build GPU util data: average across GPUs per step
  const gpuData = timeSeries
    .filter((m) => m.gpuUtilPct?.length)
    .map((m) => ({
      step: m.step,
      avgUtil: Math.round((m.gpuUtilPct!.reduce((a, b) => a + b, 0) / m.gpuUtilPct!.length)),
      avgMem: +(m.gpuMemUsedGb!.reduce((a, b) => a + b, 0) / m.gpuMemUsedGb!.length).toFixed(1),
    }));

  const lrData = timeSeries.map((m) => ({ step: m.step, lr: +(m.learningRate * 1e4).toFixed(3) }));

  if (loading) return (
    <div>
      <div className="page-header"><div className="page-title">Training Job</div></div>
      <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
    </div>
  );

  if (!job) return (
    <div>
      <div className="page-header"><div className="page-title">Job not found</div></div>
      <div className="page-content"><Link href="/training" className="btn btn-secondary">← Back to jobs</Link></div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div className="page-title">{job.modelName}</div>
            <StatusBadge status={job.status} />
            {isActive && <div className="pulse-dot" />}
          </div>
          <div className="page-subtitle">
            Dataset: {job.datasetName} · Elapsed: {elapsed(job.startedAt)} · GPU VRAM: {job.gpuVramGb} GB · TFLOPs: {job.gpuTflops}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {job.status === 'completed' && (
            <Link href={`/jobs/${id}/artifacts`} className="btn btn-primary"><Package size={14} /> View Artifacts</Link>
          )}
          {isActive && (
            <button className="btn btn-danger" onClick={handleCancel}><XCircle size={14} /> Cancel</button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Completed banner */}
        {job.status === 'completed' && (
          <div style={{ background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>Training complete!</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Actual cost: <strong>${job.actualCostUsd?.toFixed(2)}</strong> · Final train loss: <strong>{summary?.finalTrainLoss ?? job.trainLoss}</strong>
                {summary?.ttftMs && <> · TTFT: <strong>{summary.ttftMs} ms</strong></>}
              </div>
            </div>
            <Link href={`/jobs/${id}/artifacts`} className="btn btn-primary"><Package size={14} /> Download Model</Link>
          </div>
        )}

        {/* Summary stat cards (only after training completes) */}
        {summary && job.status === 'completed' && (
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              { label: 'Avg Tok/s', value: summary.avgTokensPerSec ? `${summary.avgTokensPerSec.toLocaleString()}` : '—', icon: Zap, color: 'var(--accent)' },
              { label: 'Peak GPU Mem', value: summary.peakGpuMemGb ? `${summary.peakGpuMemGb} GB` : '—', icon: Cpu, color: 'var(--purple)' },
              { label: 'Train Time', value: fmtSec(summary.totalTrainingSec), icon: Activity, color: 'var(--warning)' },
              { label: 'TTFT', value: summary.ttftMs ? `${summary.ttftMs} ms` : '—', icon: TrendingDown, color: 'var(--success)' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="stat-label">{label}</div>
                  <Icon size={16} style={{ color, opacity: 0.8 }} />
                </div>
                <div className="stat-value" style={{ fontSize: 24 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <div className="card mb-4">
          <div className="card-header">
            <div className="card-title">Progress</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Epoch {job.currentEpoch} / {job.totalEpochs}</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div className="progress-bar" style={{ flex: 1, height: 10 }}>
                <div className="progress-fill" style={{ width: `${job.progress}%` }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', minWidth: 40 }}>{job.progress}%</span>
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-secondary)' }}>
              {job.trainLoss != null && <span>Train loss: <strong style={{ color: 'var(--text-primary)' }}>{job.trainLoss}</strong></span>}
              {job.valLoss != null && <span>Val loss: <strong style={{ color: 'var(--text-primary)' }}>{job.valLoss}</strong></span>}
              <span>Est. cost: <strong style={{ color: 'var(--text-primary)' }}>${job.estimatedCostUsd.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>

        {/* Charts grid */}
        <div className="grid-2 mb-4">
          {/* Loss curves */}
          <div className="card">
            <div className="card-header"><div className="card-title"><TrendingDown size={14} /> Loss Curves</div></div>
            <div className="card-body">
              {timeSeries.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <RefreshCw size={14} /> Waiting for first epoch...
                  </div>
                </div>
              ) : (
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                      <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={CHART_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="trainLoss" stroke="#4f8ef7" strokeWidth={2} dot={false} name="Train Loss" />
                      <Line type="monotone" dataKey="valLoss" stroke="#a78bfa" strokeWidth={2} dot={false} name="Val Loss" connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Throughput */}
          <div className="card">
            <div className="card-header"><div className="card-title"><Zap size={14} /> Throughput (tok/s)</div></div>
            <div className="card-body">
              {timeSeries.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <RefreshCw size={14} /> Waiting for training to start...
                  </div>
                </div>
              ) : (
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                      <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={CHART_STYLE} formatter={(v) => [`${Number(v).toLocaleString()} tok/s`, 'Throughput']} />
                      <Area type="monotone" dataKey="tokensPerSec" stroke="#22d3ee" strokeWidth={2} fill="url(#tpsGrad)" name="Tok/s" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* GPU Utilization */}
          <div className="card">
            <div className="card-header"><div className="card-title"><Cpu size={14} /> GPU Utilization (%)</div></div>
            <div className="card-body">
              {gpuData.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <RefreshCw size={14} /> Waiting for GPU data...
                  </div>
                </div>
              ) : (
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={gpuData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                      <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                      <Tooltip contentStyle={CHART_STYLE} formatter={(v) => [`${Number(v)}%`, 'Avg GPU Util']} />
                      <Area type="monotone" dataKey="avgUtil" stroke="#a78bfa" strokeWidth={2} fill="url(#utilGrad)" name="GPU Util %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* LR Schedule */}
          <div className="card">
            <div className="card-header"><div className="card-title"><Activity size={14} /> Learning Rate Schedule (×10⁻⁴)</div></div>
            <div className="card-body">
              {lrData.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <RefreshCw size={14} /> Waiting for training to start...
                  </div>
                </div>
              ) : (
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lrData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                      <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={CHART_STYLE} formatter={(v) => [`${Number(v)} ×10⁻⁴`, 'LR']} />
                      <Line type="monotone" dataKey="lr" stroke="#f59e0b" strokeWidth={2} dot={false} name="LR ×10⁻⁴" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Training Logs</div>
            {isActive && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success)' }}><div className="pulse-dot" /> Live</div>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div ref={logRef} className="log-viewer" style={{ borderRadius: 0, border: 'none', maxHeight: 320 }}>
              {job.logs.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
