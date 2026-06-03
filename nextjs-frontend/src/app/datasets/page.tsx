'use client';

import { useState, useEffect, useRef } from 'react';
import { Database, Upload, Trash2, RefreshCw } from 'lucide-react';
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

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: '', description: '', type: 'jsonl' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const load = () => { setLoading(true); api.get('/datasets').then((r) => setDatasets(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

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
      setShowModal(false); setSelectedFile(null); setForm({ name: '', description: '', type: 'jsonl' }); load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
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
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Upload size={14} /> Upload Dataset</button>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : datasets.length === 0 ? (
          <div className="card">
            <div className="upload-zone" style={{ margin: 20 }} onClick={() => setShowModal(true)}>
              <Database size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Drop your dataset here</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Supports JSONL, CSV, Parquet, plain text — up to 5 GB</div>
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
                      <strong>{d.name}</strong>
                      {d.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.description}</div>}
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
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Upload Dataset</div>
            <div className={`upload-zone mb-4${dragOver ? ' drag-over' : ''}`} onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setSelectedFile(f); if (!form.name) setForm((p) => ({ ...p, name: f.name })); } }}>
              {selectedFile ? (
                <><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{selectedFile.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{formatBytes(selectedFile.size)}</div></>
              ) : (
                <><Upload size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} /><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click or drag file here</div></>
              )}
            </div>
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); if (!form.name) setForm((p) => ({ ...p, name: f.name })); } }} />
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
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={!selectedFile || uploading}>
                {uploading ? <><div className="spinner" />Uploading...</> : <><Upload size={14} />Upload</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
