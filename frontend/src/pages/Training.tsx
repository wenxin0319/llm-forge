import { useState, useEffect } from 'react';
import { Zap, RefreshCw, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/client';
import type { TrainingJob, Dataset, LlmModel } from '../types';

function StatusBadge({ status }: { status: TrainingJob['status'] }) {
  const map: Record<string, string> = {
    completed: 'badge-green', running: 'badge-blue', queued: 'badge-yellow',
    failed: 'badge-red', cancelled: 'badge-gray', initializing: 'badge-cyan',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

function JobRow({ job, onCancel }: { job: TrainingJob; onCancel: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = job.status === 'running' || job.status === 'initializing';

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded((p) => !p)}>
        <td>
          <div className="flex items-center gap-2">
            {isActive && <div className="pulse-dot" />}
            <strong>{job.modelName}</strong>
          </div>
        </td>
        <td>{job.datasetName}</td>
        <td><StatusBadge status={job.status} /></td>
        <td>
          <div className="flex items-center gap-2">
            <div className="progress-bar" style={{ width: 80 }}>
              <div className="progress-fill" style={{ width: `${job.progress}%` }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 32 }}>{job.progress}%</span>
          </div>
        </td>
        <td className="font-mono" style={{ fontSize: 12 }}>
          {job.currentEpoch}/{job.totalEpochs}
          {job.trainLoss != null && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>loss={job.trainLoss}</span>}
        </td>
        <td>${(job.actualCostUsd || job.estimatedCostUsd).toFixed(2)}</td>
        <td>
          <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
            {isActive && (
              <button className="btn btn-danger btn-sm" onClick={() => onCancel(job.id)}><XCircle size={12} /></button>
            )}
            {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: '0 16px 16px', background: 'var(--bg-secondary)' }}>
            <div style={{ paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Training Logs</div>
              <div className="log-viewer">
                {job.logs.map((line, i) => <div key={i}>{line}</div>)}
              </div>
              <div className="flex gap-4 mt-3" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>GPU VRAM: <strong>{job.gpuVramGb} GB</strong></span>
                <span>TFLOPs: <strong>{job.gpuTflops}</strong></span>
                <span>Est. hours: <strong>{job.estimatedHours}h</strong></span>
                {job.startedAt && <span>Started: <strong>{new Date(job.startedAt).toLocaleString()}</strong></span>}
                {job.completedAt && <span>Completed: <strong>{new Date(job.completedAt).toLocaleString()}</strong></span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const GPU_TYPES = ['h100-80gb', 'a100-80gb', 'a100-40gb', 'rtx-4090'];
const METHODS = ['qlora', 'lora', 'full_fine_tune', 'prefix_tuning'];

export default function Training() {
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [form, setForm] = useState({
    modelId: '', datasetId: '', method: 'qlora', gpuType: 'a100-80gb',
    gpuCount: 1, epochs: 3, batchSize: 8, learningRate: 0.0002,
    useFlashAttention: true, useGradientCheckpointing: true,
  });

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/jobs'), api.get('/datasets'), api.get('/models')])
      .then(([j, d, m]) => { setJobs(j.data); setDatasets(d.data); setModels(m.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(() => api.get('/jobs').then((r) => setJobs(r.data)).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      await api.post('/training/launch', form);
      setShowModal(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to launch job');
    } finally {
      setLaunching(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this training job?')) return;
    await api.post(`/jobs/${id}/cancel`);
    load();
  };

  const readyDatasets = datasets.filter((d) => d.status === 'ready');
  // draftModels removed (unused)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Training Jobs</div>
          <div className="page-subtitle">Launch and monitor GPU-accelerated training runs</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Zap size={14} /> Launch Job</button>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : jobs.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon"><Zap size={36} /></div>
              <div className="empty-state-text">No training jobs yet</div>
              <div className="empty-state-sub">You need at least one dataset and one model to launch a job</div>
              <button className="btn btn-primary mt-3" onClick={() => setShowModal(true)}><Zap size={14} /> Launch Training</button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Zap size={14} /> {jobs.length} Job{jobs.length !== 1 ? 's' : ''}</div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Model</th><th>Dataset</th><th>Status</th><th>Progress</th>
                  <th>Epoch</th><th>Cost</th><th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => <JobRow key={j.id} job={j} onCancel={handleCancel} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Launch Training Job</div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Model *</label>
                <select className="form-select" value={form.modelId} onChange={(e) => setForm((p) => ({ ...p, modelId: e.target.value }))}>
                  <option value="">Select model...</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.parameterCount})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dataset *</label>
                <select className="form-select" value={form.datasetId} onChange={(e) => setForm((p) => ({ ...p, datasetId: e.target.value }))}>
                  <option value="">Select dataset...</option>
                  {readyDatasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {readyDatasets.length === 0 && <div className="form-hint text-warning">No ready datasets — upload and wait for processing</div>}
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Training Method</label>
                <select className="form-select" value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))}>
                  {METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">GPU Type</label>
                <select className="form-select" value={form.gpuType} onChange={(e) => setForm((p) => ({ ...p, gpuType: e.target.value }))}>
                  {GPU_TYPES.map((g) => <option key={g} value={g}>{g.toUpperCase()}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">GPU Count</label>
                <select className="form-select" value={form.gpuCount} onChange={(e) => setForm((p) => ({ ...p, gpuCount: Number(e.target.value) }))}>
                  {[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n}× GPU{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Epochs</label>
                <input type="number" className="form-input" min={1} max={100} value={form.epochs} onChange={(e) => setForm((p) => ({ ...p, epochs: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Batch Size</label>
                <input type="number" className="form-input" min={1} max={256} value={form.batchSize} onChange={(e) => setForm((p) => ({ ...p, batchSize: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Learning Rate</label>
              <input type="number" className="form-input" step="0.00001" value={form.learningRate} onChange={(e) => setForm((p) => ({ ...p, learningRate: Number(e.target.value) }))} />
            </div>

            <div className="flex gap-4 mb-3">
              {[
                { key: 'useFlashAttention', label: 'Flash Attention 2.0' },
                { key: 'useGradientCheckpointing', label: 'Gradient Checkpointing' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={(form as any)[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleLaunch} disabled={!form.modelId || !form.datasetId || launching}>
                {launching ? 'Launching...' : <><Zap size={14} /> Launch</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
