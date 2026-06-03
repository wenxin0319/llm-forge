'use client';

import { useState } from 'react';
import { Stethoscope, Tag, ClipboardList, Upload, RefreshCw, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { EmrDocument } from '@/types';

const DOC_TYPE_LABELS: Record<EmrDocument['documentType'], string> = {
  admission_note: 'Admission Note',
  discharge_summary: 'Discharge Summary',
  progress_note: 'Progress Note',
  lab_report: 'Lab Report',
  radiology: 'Radiology',
  prescription: 'Prescription',
  other: 'Other',
};

const MOCK_DOCS: EmrDocument[] = [
  { id: 'emr-001', title: 'Admission Note — Acute Heart Failure', patientId: 'P-10042', documentType: 'admission_note', status: 'annotating', annotationCount: 21, confirmedCount: 14, createdAt: '2026-05-15' },
  { id: 'emr-002', title: 'Discharge Summary — Community-Acquired Pneumonia', patientId: 'P-10087', documentType: 'discharge_summary', status: 'completed', annotationCount: 18, confirmedCount: 18, createdAt: '2026-05-14' },
  { id: 'emr-003', title: 'Progress Note — Type 2 Diabetes Follow-up', patientId: 'P-10031', documentType: 'progress_note', status: 'review', annotationCount: 12, confirmedCount: 9, createdAt: '2026-05-13' },
  { id: 'emr-004', title: 'Lab Report — Comprehensive Metabolic Panel', patientId: 'P-10156', documentType: 'lab_report', status: 'pending', annotationCount: 0, confirmedCount: 0, createdAt: '2026-05-12' },
  { id: 'emr-005', title: 'Radiology Report — Chest CT with Contrast', patientId: 'P-10042', documentType: 'radiology', status: 'pending', annotationCount: 0, confirmedCount: 0, createdAt: '2026-05-12' },
  { id: 'emr-006', title: 'Admission Note — Acute Myocardial Infarction', patientId: 'P-10203', documentType: 'admission_note', status: 'completed', annotationCount: 24, confirmedCount: 24, createdAt: '2026-05-10' },
  { id: 'emr-007', title: 'Progress Note — Post-operative Day 3', patientId: 'P-10077', documentType: 'progress_note', status: 'review', annotationCount: 15, confirmedCount: 11, createdAt: '2026-05-10' },
  { id: 'emr-008', title: 'Discharge Summary — Sepsis Secondary to UTI', patientId: 'P-10128', documentType: 'discharge_summary', status: 'pending', annotationCount: 0, confirmedCount: 0, createdAt: '2026-05-09' },
  { id: 'emr-009', title: 'Admission Note — Stroke, Ischemic', patientId: 'P-10311', documentType: 'admission_note', status: 'completed', annotationCount: 19, confirmedCount: 19, createdAt: '2026-05-08' },
  { id: 'emr-010', title: 'Progress Note — Chronic Kidney Disease Stage 3', patientId: 'P-10055', documentType: 'progress_note', status: 'annotating', annotationCount: 8, confirmedCount: 3, createdAt: '2026-05-07' },
];

function StatusBadge({ status }: { status: EmrDocument['status'] }) {
  const map: Record<EmrDocument['status'], string> = {
    completed: 'badge-green',
    annotating: 'badge-blue',
    review: 'badge-yellow',
    pending: 'badge-gray',
  };
  const icons: Record<EmrDocument['status'], React.ReactNode> = {
    completed: <CheckCircle size={10} />,
    annotating: <Tag size={10} />,
    review: <AlertCircle size={10} />,
    pending: <Clock size={10} />,
  };
  return (
    <span className={`badge ${map[status]}`}>
      {icons[status]} {status}
    </span>
  );
}

export default function EmrPage() {
  const [filter, setFilter] = useState<EmrDocument['status'] | 'all'>('all');

  const filtered = filter === 'all' ? MOCK_DOCS : MOCK_DOCS.filter((d) => d.status === filter);

  const stats = {
    total: MOCK_DOCS.length,
    pending: MOCK_DOCS.filter((d) => d.status === 'pending').length,
    inProgress: MOCK_DOCS.filter((d) => d.status === 'annotating' || d.status === 'review').length,
    completed: MOCK_DOCS.filter((d) => d.status === 'completed').length,
    entities: MOCK_DOCS.reduce((s, d) => s + d.confirmedCount, 0),
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">EMR Workspace</div>
          <div className="page-subtitle">Human–AI cooperative extraction from electronic medical records</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm"><RefreshCw size={13} /></button>
          <button className="btn btn-primary btn-sm"><Upload size={13} /> Import Records</button>
        </div>
      </div>

      <div className="page-content">
        {/* Hero */}
        <div className="hero-gradient" style={{ marginBottom: 28 }}>
          <div>
            <div className="hero-title">Case Information Extraction</div>
            <div className="hero-sub" style={{ maxWidth: 520 }}>
              Upload EMR documents, let the AI pre-annotate clinical entities, then review and confirm with domain expertise.
              Extracted cases are structured and ready for downstream fine-tuning or analytics.
            </div>
            <div className="flex gap-2 mt-3">
              <Link href="/emr/annotate" className="btn btn-primary btn-sm"><Tag size={13} /> Open Annotation Workspace</Link>
              <Link href="/emr/cases" className="btn btn-secondary btn-sm"><ClipboardList size={13} /> Browse Cases</Link>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            {[
              { label: 'EMR Records', value: stats.total, color: 'var(--accent)' },
              { label: 'Verified Entities', value: stats.entities, color: 'var(--success)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', minWidth: 110 }}>
                <Stethoscope size={18} style={{ color, margin: '0 auto 8px' }} />
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          {[
            { label: 'Total Records', value: stats.total, icon: FileText, color: 'var(--accent)' },
            { label: 'Pending Annotation', value: stats.pending, icon: Clock, color: 'var(--warning)' },
            { label: 'In Progress', value: stats.inProgress, icon: Tag, color: 'var(--purple)' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'var(--success)' },
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

        {/* Workflow steps */}
        <div className="card mb-4">
          <div className="card-header"><div className="card-title"><Stethoscope size={14} /> Extraction Workflow</div></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                { step: '01', label: 'Import', desc: 'Upload EMR documents in PDF, DOCX, or plain text format', color: 'var(--accent)' },
                { step: '02', label: 'AI Pre-annotation', desc: 'Model identifies diagnoses, medications, symptoms, labs, and more', color: 'var(--purple)' },
                { step: '03', label: 'Human Review', desc: 'Clinicians confirm, correct, or add annotations in the workspace', color: 'var(--warning)' },
                { step: '04', label: 'Case Export', desc: 'Structured cases exported as datasets for fine-tuning or analytics', color: 'var(--success)' },
              ].map(({ step, label, desc, color }, i, arr) => (
                <div key={step} style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>{step}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, paddingLeft: 42 }}>{desc}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ padding: '14px 8px 0', color: 'var(--text-muted)', fontSize: 18, flexShrink: 0 }}>→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Document list */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><FileText size={14} /> EMR Documents</div>
            <div className="flex gap-2">
              {(['all', 'pending', 'annotating', 'review', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '3px 10px', textTransform: 'capitalize' }}
                  onClick={() => setFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Patient</th>
                <th>Status</th>
                <th>Annotations</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <strong>{doc.title}</strong>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{doc.id}</div>
                  </td>
                  <td><span className="tag">{DOC_TYPE_LABELS[doc.documentType]}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{doc.patientId}</td>
                  <td><StatusBadge status={doc.status} /></td>
                  <td>
                    {doc.annotationCount > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 64 }}>
                          <div className="progress-fill" style={{ width: `${doc.annotationCount > 0 ? Math.round((doc.confirmedCount / doc.annotationCount) * 100) : 0}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.confirmedCount}/{doc.annotationCount}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{doc.createdAt}</td>
                  <td>
                    <div className="flex gap-2">
                      <Link href="/emr/annotate" className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}><Tag size={11} /> Annotate</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
