'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { XCircle, Package, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Link from 'next/link';
import api from '@/api/client';
import { getMockJob, getMockProgress, getMockMetrics, getMockLogs } from '@/lib/mockStore';
import type { TrainingJob } from '@/types';

interface MetricPoint { step: number; epoch: number; trainLoss: number; valLoss: number; tokensPerSec: number }

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

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const isMock = id?.startsWith('mock-');

  useEffect(() => {
    if (isMock) {
      // Mock mode: build job state from local store + elapsed time
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
        setMetrics(getMockMetrics(mockCfg) as MetricPoint[]);
        setTick((p) => p + 1);
        if (done) clearInterval(timer);
      };

      setLoading(false);
      refresh();
      const timer = setInterval(refresh, 1500);
      return () => clearInterval(timer);
    }

    // Real API mode
    const load = async () => {
      try {
        const [jobRes, metricsRes] = await Promise.all([api.get(`/jobs/${id}`), api.get(`/jobs/${id}/metrics`)]);
        setJob(jobRes.data);
        setMetrics(metricsRes.data);
        setLoading(false);
      } catch { setLoading(false); }
    };
    load();
    const t = setInterval(() => { load(); setTick((p) => p + 1); }, 3000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.logs]);

  const handleCancel = async () => {
    if (!confirm('Cancel this job?')) return;
    if (!isMock) await api.post(`/jobs/${id}/cancel`);
    setJob((j) => j ? { ...j, status: 'cancelled' } : j);
  };

  const isActive = job && ['queued', 'preprocessing', 'training', 'packaging'].includes(job.status);

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
            <Link href={`/jobs/${id}/artifacts`} className="btn btn-primary">
              <Package size={14} /> View Artifacts
            </Link>
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
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Actual cost: <strong>${job.actualCostUsd?.toFixed(2)}</strong> · Final train loss: <strong>{job.trainLoss}</strong></div>
            </div>
            <Link href={`/jobs/${id}/artifacts`} className="btn btn-primary"><Package size={14} /> Download Model</Link>
          </div>
        )}

        {/* Progress */}
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

        <div className="grid-2 mb-4">
          {/* Loss chart */}
          <div className="card">
            <div className="card-header"><div className="card-title">Loss Curves</div></div>
            <div className="card-body">
              {metrics.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <RefreshCw size={14} /> Waiting for first epoch...
                  </div>
                </div>
              ) : (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                      <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: '#131929', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="trainLoss" stroke="#4f8ef7" strokeWidth={2} dot={false} name="Train Loss" />
                      <Line type="monotone" dataKey="valLoss" stroke="#a78bfa" strokeWidth={2} dot={false} name="Val Loss" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Throughput chart */}
          <div className="card">
            <div className="card-header"><div className="card-title">Tokens / Second</div></div>
            <div className="card-body">
              {metrics.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <RefreshCw size={14} /> Waiting for training to start...
                  </div>
                </div>
              ) : (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                      <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#4d6080' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#131929', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="tokensPerSec" stroke="#22d3ee" strokeWidth={2} dot={false} name="Tok/s" />
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
