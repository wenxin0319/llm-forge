'use client';

import { useState, useEffect } from 'react';
import { Box, Plus, Trash2, RefreshCw, Cpu } from 'lucide-react';
import api from '@/api/client';
import type { LlmModel } from '@/types';

function StatusBadge({ status }: { status: LlmModel['status'] }) {
  const map = { ready: 'badge-green', training: 'badge-blue', draft: 'badge-gray', deployed: 'badge-cyan', failed: 'badge-red' };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

const BASE_MODELS = ['llama-3-8b', 'llama-3-70b', 'mistral-7b', 'phi-3-mini', 'gemma-2b', 'gemma-7b'];
const QUANT_MODES = ['none', 'int8', 'int4', 'gptq', 'gguf'];

export default function ModelsPage() {
  const [models, setModels] = useState<LlmModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', baseModel: 'llama-3-8b', quantization: 'int4', contextLength: 4096 });

  const load = () => { setLoading(true); api.get('/models').then((r) => setModels(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try { await api.post('/models', form); setShowModal(false); setForm({ name: '', description: '', baseModel: 'llama-3-8b', quantization: 'int4', contextLength: 4096 }); load(); }
    catch (e: unknown) { const err = e as { response?: { data?: { message?: string } } }; alert(err.response?.data?.message || 'Failed to create model'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this model?')) return;
    await api.delete(`/models/${id}`); load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Models</div>
          <div className="page-subtitle">Configure your LLM architecture and quantization</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New Model</button>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : models.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon"><Box size={36} /></div>
              <div className="empty-state-text">No models configured</div>
              <div className="empty-state-sub">Create a model to get started with training</div>
              <button className="btn btn-primary mt-3" onClick={() => setShowModal(true)}><Plus size={14} /> Create Model</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {models.map((m) => (
              <div key={m.id} className="card">
                <div style={{ padding: '18px 20px' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{m.name}</div>
                    <StatusBadge status={m.status} />
                  </div>
                  {m.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{m.description}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[{ label: 'Base Model', value: m.baseModel }, { label: 'Parameters', value: m.parameterCount }, { label: 'Quantization', value: m.quantization.toUpperCase() }, { label: 'Size', value: `${m.estimatedSizeGb} GB` }, { label: 'Context', value: `${(m.contextLength / 1024).toFixed(0)}k tokens` }].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }} className="font-mono">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">{m.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Create Model Configuration</div>
            <div className="form-group">
              <label className="form-label">Model Name *</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Support Bot v1" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What is this model for?" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Base Model *</label>
                <select className="form-select" value={form.baseModel} onChange={(e) => setForm((p) => ({ ...p, baseModel: e.target.value }))}>
                  {BASE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantization</label>
                <select className="form-select" value={form.quantization} onChange={(e) => setForm((p) => ({ ...p, quantization: e.target.value }))}>
                  {QUANT_MODES.map((q) => <option key={q} value={q}>{q === 'none' ? 'None (FP16)' : q.toUpperCase()}</option>)}
                </select>
                <div className="form-hint">INT4/GGUF gives smallest footprint</div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Context Length</label>
              <select className="form-select" value={form.contextLength} onChange={(e) => setForm((p) => ({ ...p, contextLength: Number(e.target.value) }))}>
                {[1024, 2048, 4096, 8192, 16384, 32768].map((n) => <option key={n} value={n}>{(n / 1024).toFixed(0)}k tokens</option>)}
              </select>
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Cpu size={13} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Estimated footprint</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>INT4 reduces memory ~4× vs FP16 with minimal quality loss.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name || saving}>{saving ? 'Creating...' : 'Create Model'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
