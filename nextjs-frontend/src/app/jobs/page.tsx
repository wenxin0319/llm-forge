'use client';

import { useState, useEffect } from 'react';
import { Zap, Package, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import api from '@/api/client';
import { getAllMockJobs, getMockProgress, type MockJob } from '@/lib/mockStore';
import type { TrainingJob } from '@/types';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { completed: 'badge-green', training: 'badge-blue', queued: 'badge-yellow', failed: 'badge-red', cancelled: 'badge-gray', preprocessing: 'badge-cyan', packaging: 'badge-purple' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

interface Row {
  id: string;
  modelName: string;
  datasetName: string;
  status: string;
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  trainLoss?: number;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  startedAt?: string;
  isMock: boolean;
}

function toRow(j: TrainingJob): Row {
  return { id: j.id, modelName: j.modelName, datasetName: j.datasetName, status: j.status, progress: j.progress, currentEpoch: j.currentEpoch, totalEpochs: j.totalEpochs, trainLoss: j.trainLoss, estimatedCostUsd: j.estimatedCostUsd, actualCostUsd: j.actualCostUsd, startedAt: j.startedAt, isMock: false };
}

function mockToRow(m: MockJob): Row {
  const { pct, status, epoch, trainLoss } = getMockProgress(m);
  return { id: m.id, modelName: m.modelName, datasetName: m.datasetName, status, progress: pct, currentEpoch: epoch, totalEpochs: m.totalEpochs, trainLoss, estimatedCostUsd: m.estimatedCostUsd, actualCostUsd: pct >= 100 ? +(m.estimatedCostUsd * 0.96).toFixed(2) : undefined, startedAt: m.startedAt, isMock: true };
}

export default function JobsPage() {
  const [apiRows, setApiRows] = useState<Row[]>([]);
  const [mockRows, setMockRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshMock = () => {
    const mocks = getAllMockJobs();
    setMockRows(Object.values(mocks).map(mockToRow).sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? '')));
  };

  const load = () => {
    refreshMock();
    api.get('/jobs')
      .then((r) => setApiRows((r.data as TrainingJob[]).map(toRow)))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(refreshMock, 2000);
    return () => clearInterval(t);
  }, []);

  const rows = [...apiRows, ...mockRows].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Training Jobs</div>
          <div className="page-subtitle">All fine-tuning runs — click a row to see details and download</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>
          <Link href="/finetune" className="btn btn-primary btn-sm"><Zap size={13} /> New Fine-tune</Link>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'Total Jobs', value: rows.length, icon: Zap, color: 'var(--accent)' },
            { label: 'Completed', value: rows.filter((r) => r.status === 'completed').length, icon: CheckCircle, color: 'var(--success)' },
            { label: 'Running', value: rows.filter((r) => ['training', 'preprocessing', 'packaging'].includes(r.status)).length, icon: Clock, color: 'var(--warning)' },
            { label: 'Failed', value: rows.filter((r) => r.status === 'failed').length, icon: XCircle, color: 'var(--danger)' },
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

        <div className="card">
          <div className="card-header">
            <div className="card-title"><Zap size={14} /> All Jobs</div>
          </div>

          {loading && rows.length === 0 ? (
            <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Zap size={36} /></div>
              <div className="empty-state-text">No training jobs yet</div>
              <div className="empty-state-sub">Use the Fine-tune Wizard to launch your first run</div>
              <Link href="/finetune" className="btn btn-primary mt-3"><Zap size={14} /> Start Fine-tuning</Link>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Dataset</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Epoch</th>
                  <th>Cost</th>
                  <th>Started</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isActive = ['training', 'preprocessing', 'packaging', 'queued'].includes(row.status);
                  return (
                    <tr key={row.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isActive && <div className="pulse-dot" />}
                          <div>
                            <strong>{row.modelName}</strong>
                            {row.isMock && <span style={{ fontSize: 9, marginLeft: 6, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>DEMO</span>}
                          </div>
                        </div>
                      </td>
                      <td>{row.datasetName}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ width: 72 }}><div className="progress-fill" style={{ width: `${row.progress}%` }} /></div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.progress}%</span>
                        </div>
                      </td>
                      <td className="font-mono" style={{ fontSize: 12 }}>
                        {row.currentEpoch}/{row.totalEpochs}
                        {row.trainLoss != null && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>loss={row.trainLoss.toFixed(3)}</span>}
                      </td>
                      <td>${(row.actualCostUsd ?? row.estimatedCostUsd).toFixed(2)}</td>
                      <td style={{ fontSize: 12 }}>{row.startedAt ? new Date(row.startedAt).toLocaleString() : '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <Link href={`/jobs/${row.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>Details</Link>
                          {row.status === 'completed' && (
                            <Link href={`/jobs/${row.id}/artifacts`} className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>
                              <Package size={11} /> Download
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
