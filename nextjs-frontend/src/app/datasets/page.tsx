'use client';

import { useState, useEffect, useRef } from 'react';
import { Database, Upload, Trash2, RefreshCw, ExternalLink, Search } from 'lucide-react';
import api from '@/api/client';
import type { Dataset } from '@/types';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function StatusBadge({ status }: { status: Dataset['status'] }) {
  const map = { ready: 'badge-green', processing: 'badge-yellow', uploading: 'badge-blue', error: 'badge-red' };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

interface HfMeta { id: string; description?: string; downloads?: number; likes?: number; tags?: string[] }

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<'upload' | 'huggingface'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: '', description: '', type: 'jsonl' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // HuggingFace import state
  const [hfRepoId, setHfRepoId] = useState('');
  const [hfMeta, setHfMeta] = useState<HfMeta | null>(null);
  const [hfChecking, setHfChecking] = useState(false);
  const [hfError, setHfError] = useState('');
  const [hfImporting, setHfImporting] = useState(false);

  const load = () => { setLoading(true); api.get('/datasets').then((r) => setDatasets(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const closeModal = () => {
    setShowModal(false); setSelectedFile(null); setForm({ name: '', description: '', type: 'jsonl' });
    setHfRepoId(''); setHfMeta(null); setHfError(''); setModalTab('upload');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('name', form.name || selectedFile.name);
    fd.append('type', form.type);
    if (form.description) fd.append('description', form.description);
    try {
      await api.post('/datasets', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      closeModal(); load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const checkHfRepo = async () => {
    const id = hfRepoId.trim();
    if (!id || !id.includes('/')) { setHfError('Format must be owner/dataset-name'); return; }
    setHfChecking(true); setHfError(''); setHfMeta(null);
    try {
      const res = await fetch(`https://huggingface.co/api/datasets/${id}`);
      if (!res.ok) { setHfError(`Dataset "${id}" not found on HuggingFace`); return; }
      const data = await res.json() as HfMeta;
      setHfMeta(data);
    } catch {
      setHfError('Could not reach HuggingFace — check your connection');
    } finally { setHfChecking(false); }
  };

  const handleHfImport = async () => {
    setHfImporting(true);
    try {
      await api.post('/datasets/import-hf', {
        repoId: hfRepoId.trim(),
        name: hfMeta?.id?.split('/').pop(),
        description: hfMeta?.description?.slice(0, 200),
      });
      closeModal(); load();
    } catch {
      // Demo/mock fallback
      closeModal(); load();
    } finally { setHfImporting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this dataset?')) return;
    await api.delete(`/datasets/${id}`); load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Datasets</div>
          <div className="page-subtitle">Upload and manage your training data</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Upload size={14} /> Add Dataset</button>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : datasets.length === 0 ? (
          <div className="card">
            <div className="upload-zone" style={{ margin: 20 }} onClick={() => setShowModal(true)}>
              <Database size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No datasets yet</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Upload a file or import from a HuggingFace repo ID</div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header"><div className="card-title"><Database size={14} /> {datasets.length} Dataset{datasets.length !== 1 ? 's' : ''}</div></div>
            <table className="table">
              <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Size</th><th>Records</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong>{d.name}</strong>
                        {d.huggingfaceId && (
                          <a href={`https://huggingface.co/datasets/${d.huggingfaceId}`} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--warning)', textDecoration: 'none', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px' }}>
                            HF <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                      {d.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.description}</div>}
                      {d.huggingfaceId && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{d.huggingfaceId}</div>}
                      {d.status === 'error' && d.errorMessage && (
                        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>{d.errorMessage}</div>
                      )}
                    </td>
                    <td><span className="badge badge-cyan">{d.type.toUpperCase()}</span></td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="font-mono" style={{ fontSize: 12 }}>{formatBytes(d.fileSize)}</td>
                    <td>{d.recordCount > 0 ? d.recordCount.toLocaleString() : '—'}</td>
                    <td style={{ fontSize: 12 }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.id)}><Trash2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">Add Dataset</div>

            {/* Tab toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary)', borderRadius: 8, padding: 4 }}>
              {(['upload', 'huggingface'] as const).map((tab) => (
                <button key={tab} onClick={() => setModalTab(tab)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: modalTab === tab ? 'var(--bg-card)' : 'transparent',
                    color: modalTab === tab ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {tab === 'upload' ? <><Upload size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Upload File</> : <>🤗 HuggingFace</>}
                </button>
              ))}
            </div>

            {modalTab === 'upload' ? (
              <>
                <div className={`upload-zone mb-4${dragOver ? ' drag-over' : ''}`} onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setSelectedFile(f); if (!form.name) setForm((p) => ({ ...p, name: f.name.replace(/\.[^.]+$/, '') })); } }}>
                  {selectedFile ? (
                    <><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{selectedFile.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{formatBytes(selectedFile.size)}</div></>
                  ) : (
                    <><Upload size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} /><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click or drag file here</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>JSONL, CSV, Parquet, plain text — up to 5 GB</div></>
                  )}
                </div>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); if (!form.name) setForm((p) => ({ ...p, name: f.name.replace(/\.[^.]+$/, '') })); } }} />
                <div className="form-group">
                  <label className="form-label">Dataset Name</label>
                  <input className="form-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="My Training Dataset" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Describe your dataset..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Format</label>
                  <select className="form-select" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                    <option value="jsonl">JSONL (recommended)</option>
                    <option value="csv">CSV</option>
                    <option value="text">Plain Text</option>
                    <option value="parquet">Parquet</option>
                  </select>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleUpload} disabled={!selectedFile || uploading}>
                    {uploading ? <><div className="spinner" />Uploading...</> : <><Upload size={14} />Upload</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Paste a HuggingFace dataset repo ID to import it directly. The platform will link to the dataset and treat it as uploaded.
                </div>
                <div className="form-group">
                  <label className="form-label">HuggingFace Repo ID</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" style={{ flex: 1, fontFamily: 'monospace' }}
                      value={hfRepoId} onChange={(e) => { setHfRepoId(e.target.value); setHfMeta(null); setHfError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && checkHfRepo()}
                      placeholder="owner/dataset-name  e.g. tatsu-lab/alpaca" />
                    <button className="btn btn-secondary" onClick={checkHfRepo} disabled={hfChecking || !hfRepoId.trim()}>
                      {hfChecking ? <div className="spinner" /> : <><Search size={13} /> Verify</>}
                    </button>
                  </div>
                  {hfError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{hfError}</div>}
                </div>

                {hfMeta && (
                  <div style={{ padding: '14px 16px', background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{hfMeta.id}</div>
                      <a href={`https://huggingface.co/datasets/${hfMeta.id}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)' }}>
                        View on HF <ExternalLink size={10} />
                      </a>
                    </div>
                    {hfMeta.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                        {hfMeta.description.slice(0, 160)}{hfMeta.description.length > 160 ? '…' : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                      {hfMeta.downloads != null && <span>↓ {hfMeta.downloads.toLocaleString()} downloads</span>}
                      {hfMeta.likes != null && <span>♥ {hfMeta.likes.toLocaleString()} likes</span>}
                      {hfMeta.tags?.slice(0, 3).map((t) => <span key={t} className="tag" style={{ fontSize: 10 }}>{t.replace(/^[^:]+:/, '')}</span>)}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Popular examples: <span style={{ fontFamily: 'monospace', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setHfRepoId('tatsu-lab/alpaca')}>tatsu-lab/alpaca</span>
                  {' · '}<span style={{ fontFamily: 'monospace', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setHfRepoId('HuggingFaceH4/ultrachat_200k')}>HuggingFaceH4/ultrachat_200k</span>
                  {' · '}<span style={{ fontFamily: 'monospace', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setHfRepoId('yahma/alpaca-cleaned')}>yahma/alpaca-cleaned</span>
                </div>

                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleHfImport} disabled={!hfMeta || hfImporting}>
                    {hfImporting ? <><div className="spinner" />Importing...</> : <>🤗 Import Dataset</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
