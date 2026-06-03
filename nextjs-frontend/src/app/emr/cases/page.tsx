'use client';

import { useState, useMemo } from 'react';
import { ClipboardList, ArrowLeft, Search, CheckCircle, Clock, Eye, X, FlaskConical, Pill, Stethoscope, Activity } from 'lucide-react';
import Link from 'next/link';
import type { ExtractedCase } from '@/types';

const MOCK_CASES: ExtractedCase[] = [
  {
    id: 'case-001', patientId: 'P-10042', visitDate: '2026-05-15',
    diagnoses: ['Acute Decompensated Heart Failure', 'Type 2 Diabetes Mellitus', 'Hypertension', 'Coronary Artery Disease'],
    medications: ['IV Furosemide 80mg', 'Metformin 1000mg BID', 'Lisinopril 10mg', 'Atorvastatin 40mg', 'Aspirin 81mg'],
    procedures: ['IV fluid restriction', 'Daily weight monitoring', 'BMP monitoring'],
    symptoms: ['Shortness of breath', 'Chest pain', 'Bilateral lower extremity edema', 'Chest tightness'],
    labResults: [
      { name: 'BNP', value: '1250 pg/mL', flag: 'high' },
      { name: 'Troponin I', value: '0.04 ng/mL', flag: 'high' },
      { name: 'HbA1c', value: '7.8%', flag: 'high' },
      { name: 'eGFR', value: '52 mL/min/1.73m²', flag: 'low' },
    ],
    extractionStatus: 'human_reviewed', documentId: 'emr-001', createdAt: '2026-05-15',
  },
  {
    id: 'case-002', patientId: 'P-10087', visitDate: '2026-05-14',
    diagnoses: ['Community-Acquired Pneumonia', 'Hypoxemic Respiratory Failure', 'Type 2 Diabetes Mellitus'],
    medications: ['Ceftriaxone 1g IV daily', 'Azithromycin 500mg PO daily', 'Supplemental O2', 'Insulin sliding scale'],
    procedures: ['Chest X-ray', 'Blood cultures', 'Sputum culture', 'Oxygen therapy'],
    symptoms: ['Productive cough', 'Fever 38.9°C', 'Dyspnea', 'Pleuritic chest pain'],
    labResults: [
      { name: 'WBC', value: '14.2 k/uL', flag: 'high' },
      { name: 'CRP', value: '142 mg/L', flag: 'high' },
      { name: 'SpO2', value: '91% on RA', flag: 'low' },
      { name: 'Procalcitonin', value: '2.1 ng/mL', flag: 'high' },
    ],
    extractionStatus: 'verified', documentId: 'emr-002', createdAt: '2026-05-14',
  },
  {
    id: 'case-003', patientId: 'P-10031', visitDate: '2026-05-13',
    diagnoses: ['Type 2 Diabetes Mellitus (poorly controlled)', 'Peripheral Neuropathy', 'Hypertension'],
    medications: ['Metformin 1000mg BID', 'Glipizide 5mg daily', 'Gabapentin 300mg TID', 'Amlodipine 5mg daily'],
    procedures: ['HbA1c monitoring', 'Foot examination', 'Blood pressure check'],
    symptoms: ['Tingling in feet', 'Blurred vision', 'Increased thirst', 'Fatigue'],
    labResults: [
      { name: 'HbA1c', value: '9.2%', flag: 'high' },
      { name: 'Fasting glucose', value: '198 mg/dL', flag: 'high' },
      { name: 'eGFR', value: '68 mL/min', flag: 'normal' },
      { name: 'LDL', value: '112 mg/dL', flag: 'high' },
    ],
    extractionStatus: 'human_reviewed', documentId: 'emr-003', createdAt: '2026-05-13',
  },
  {
    id: 'case-004', patientId: 'P-10203', visitDate: '2026-05-10',
    diagnoses: ['ST-Elevation Myocardial Infarction', 'Hypertension', 'Hyperlipidemia'],
    medications: ['Aspirin 325mg loading', 'Ticagrelor 180mg loading', 'Heparin IV', 'Metoprolol 25mg', 'Atorvastatin 80mg'],
    procedures: ['Emergency PCI — LAD stenting', 'Coronary angiography', 'Echocardiography', 'Continuous cardiac monitoring'],
    symptoms: ['Severe crushing chest pain', 'Diaphoresis', 'Nausea', 'Radiation to left arm'],
    labResults: [
      { name: 'Troponin I peak', value: '48.3 ng/mL', flag: 'high' },
      { name: 'CK-MB', value: '180 U/L', flag: 'high' },
      { name: 'LDL', value: '168 mg/dL', flag: 'high' },
      { name: 'EF (Echo)', value: '40%', flag: 'low' },
    ],
    extractionStatus: 'verified', documentId: 'emr-006', createdAt: '2026-05-10',
  },
  {
    id: 'case-005', patientId: 'P-10077', visitDate: '2026-05-10',
    diagnoses: ['Post-operative ileus', 'Laparoscopic appendectomy', 'Acute Appendicitis'],
    medications: ['Morphine PCA', 'Ketorolac 30mg IV q6h', 'Ondansetron 4mg IV PRN', 'Cefazolin 1g IV q8h'],
    procedures: ['Laparoscopic appendectomy', 'Wound care', 'Ambulation protocol', 'Nasogastric tube placement'],
    symptoms: ['Abdominal distension', 'Nausea and vomiting', 'Absence of flatus', 'Abdominal pain'],
    labResults: [
      { name: 'WBC', value: '11.4 k/uL', flag: 'high' },
      { name: 'CRP', value: '67 mg/L', flag: 'high' },
      { name: 'Hemoglobin', value: '10.8 g/dL', flag: 'low' },
      { name: 'Lactate', value: '1.2 mmol/L', flag: 'normal' },
    ],
    extractionStatus: 'human_reviewed', documentId: 'emr-007', createdAt: '2026-05-10',
  },
  {
    id: 'case-006', patientId: 'P-10311', visitDate: '2026-05-08',
    diagnoses: ['Ischemic Stroke — Left MCA Territory', 'Atrial Fibrillation', 'Hypertension'],
    medications: ['tPA 0.9 mg/kg IV', 'Aspirin 81mg', 'Warfarin (initiated)', 'Lisinopril 5mg', 'Atorvastatin 40mg'],
    procedures: ['IV tPA thrombolysis', 'CT head + angiography', 'MRI brain', 'Swallowing assessment', 'Physical therapy consult'],
    symptoms: ['Right-sided weakness', 'Facial droop', 'Aphasia', 'Sudden onset headache'],
    labResults: [
      { name: 'INR', value: '1.1', flag: 'normal' },
      { name: 'PT/aPTT', value: '12.4 / 28s', flag: 'normal' },
      { name: 'Glucose', value: '142 mg/dL', flag: 'high' },
      { name: 'NIHSS score', value: '14', flag: 'high' },
    ],
    extractionStatus: 'ai_extracted', documentId: 'emr-009', createdAt: '2026-05-08',
  },
];

const STATUS_LABEL: Record<ExtractedCase['extractionStatus'], string> = {
  ai_extracted: 'AI Extracted',
  human_reviewed: 'Human Reviewed',
  verified: 'Verified',
};

function StatusBadge({ status }: { status: ExtractedCase['extractionStatus'] }) {
  const map = { ai_extracted: 'badge-yellow', human_reviewed: 'badge-blue', verified: 'badge-green' };
  return <span className={`badge ${map[status]}`}>{STATUS_LABEL[status]}</span>;
}

function FlagBadge({ flag }: { flag?: 'high' | 'low' | 'normal' }) {
  if (!flag || flag === 'normal') return null;
  return (
    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, marginLeft: 4, fontWeight: 700,
      background: flag === 'high' ? 'var(--danger-dim)' : 'var(--accent-dim)',
      color: flag === 'high' ? 'var(--danger)' : 'var(--accent)' }}>
      {flag.toUpperCase()}
    </span>
  );
}

export default function CasesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExtractedCase['extractionStatus'] | 'all'>('all');
  const [selectedCase, setSelectedCase] = useState<ExtractedCase | null>(null);

  const filtered = useMemo(() => {
    return MOCK_CASES.filter((c) => {
      if (statusFilter !== 'all' && c.extractionStatus !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.patientId.toLowerCase().includes(q) ||
          c.diagnoses.some((d) => d.toLowerCase().includes(q)) ||
          c.medications.some((m) => m.toLowerCase().includes(q)) ||
          c.symptoms.some((s) => s.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [search, statusFilter]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/emr" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="page-title">Case Explorer</div>
            <div className="page-subtitle">Structured information extracted from EMR documents</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 30, width: 240, fontSize: 12 }}
              placeholder="Search diagnoses, meds, patients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'Total Cases', value: MOCK_CASES.length, icon: ClipboardList, color: 'var(--accent)' },
            { label: 'Verified', value: MOCK_CASES.filter((c) => c.extractionStatus === 'verified').length, icon: CheckCircle, color: 'var(--success)' },
            { label: 'Human Reviewed', value: MOCK_CASES.filter((c) => c.extractionStatus === 'human_reviewed').length, icon: Eye, color: 'var(--purple)' },
            { label: 'AI Extracted', value: MOCK_CASES.filter((c) => c.extractionStatus === 'ai_extracted').length, icon: Clock, color: 'var(--warning)' },
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

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {(['all', 'ai_extracted', 'human_reviewed', 'verified'] as const).map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 11 }}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All Statuses' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Case cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {filtered.map((c) => (
            <div key={c.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-light)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              onClick={() => setSelectedCase(c)}>
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <span className="font-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{c.patientId}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.visitDate}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <StatusBadge status={c.extractionStatus} />
                  <Eye size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
              <div className="card-body" style={{ paddingTop: 14, paddingBottom: 14 }}>
                {/* Diagnoses */}
                <div className="mb-3">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Stethoscope size={12} style={{ color: '#ef4444' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#ef4444', letterSpacing: 0.5 }}>Diagnoses</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.diagnoses.slice(0, 3).map((d) => (
                      <span key={d} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>{d}</span>
                    ))}
                    {c.diagnoses.length > 3 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{c.diagnoses.length - 3} more</span>}
                  </div>
                </div>

                {/* Medications */}
                <div className="mb-3">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Pill size={12} style={{ color: '#4f8ef7' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#4f8ef7', letterSpacing: 0.5 }}>Medications</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.medications.slice(0, 3).map((m) => (
                      <span key={m} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(79,142,247,0.1)', color: '#4f8ef7', border: '1px solid rgba(79,142,247,0.25)' }}>{m}</span>
                    ))}
                    {c.medications.length > 3 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{c.medications.length - 3} more</span>}
                  </div>
                </div>

                {/* Lab highlights */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <FlaskConical size={12} style={{ color: '#22d3ee' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#22d3ee', letterSpacing: 0.5 }}>Key Labs</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.labResults.filter((l) => l.flag && l.flag !== 'normal').slice(0, 3).map((l) => (
                      <span key={l.name} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)' }}>
                        {l.name}: {l.value} <FlagBadge flag={l.flag} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardList size={36} /></div>
            <div className="empty-state-text">No cases match your filters</div>
            <div className="empty-state-sub">Try adjusting the search or status filter</div>
          </div>
        )}
      </div>

      {/* Case detail modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedCase(null)}>
          <div className="modal" style={{ width: 700, maxWidth: '95vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div className="modal-title" style={{ marginBottom: 4 }}>
                  Case {selectedCase.id} — {selectedCase.patientId}
                </div>
                <div className="flex gap-2 items-center">
                  <StatusBadge status={selectedCase.extractionStatus} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Visit: {selectedCase.visitDate}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Doc: {selectedCase.documentId}</span>
                </div>
              </div>
              <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { icon: Stethoscope, label: 'Diagnoses', items: selectedCase.diagnoses, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
                { icon: Pill, label: 'Medications', items: selectedCase.medications, color: '#4f8ef7', bg: 'rgba(79,142,247,0.1)', border: 'rgba(79,142,247,0.25)' },
                { icon: Activity, label: 'Symptoms', items: selectedCase.symptoms, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
                { icon: ClipboardList, label: 'Procedures', items: selectedCase.procedures, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
              ].map(({ icon: Icon, label, items, color, bg, border }) => (
                <div key={label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Icon size={13} style={{ color }} />
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color, letterSpacing: 0.5 }}>{label}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {items.map((item) => (
                      <span key={item} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 5, background: bg, color, border: `1px solid ${border}` }}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <FlaskConical size={13} style={{ color: '#22d3ee' }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#22d3ee', letterSpacing: 0.5 }}>Laboratory Results</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {selectedCase.labResults.map((l) => (
                  <div key={l.name} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{l.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: l.flag === 'high' ? 'var(--danger)' : l.flag === 'low' ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {l.value} {l.flag && l.flag !== 'normal' && <FlagBadge flag={l.flag} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCase(null)}>Close</button>
              <Link href="/emr/annotate" className="btn btn-primary">Open in Annotation Workspace</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
