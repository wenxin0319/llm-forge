'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Tag, CheckCircle, XCircle, Trash2, Plus, ChevronDown, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { EmrAnnotation, EmrEntityType } from '@/types';

// ── Entity metadata ─────────────────────────────────────────────────────────

const ENTITY_COLORS: Record<EmrEntityType, { bg: string; text: string; border: string }> = {
  diagnosis:    { bg: 'rgba(239,68,68,0.18)',    text: '#ef4444', border: 'rgba(239,68,68,0.5)'    },
  medication:   { bg: 'rgba(79,142,247,0.18)',   text: '#4f8ef7', border: 'rgba(79,142,247,0.5)'   },
  procedure:    { bg: 'rgba(167,139,250,0.18)',  text: '#a78bfa', border: 'rgba(167,139,250,0.5)'  },
  symptom:      { bg: 'rgba(245,158,11,0.18)',   text: '#f59e0b', border: 'rgba(245,158,11,0.5)'   },
  lab_result:   { bg: 'rgba(34,211,238,0.18)',   text: '#22d3ee', border: 'rgba(34,211,238,0.5)'   },
  vital_sign:   { bg: 'rgba(34,197,94,0.18)',    text: '#22c55e', border: 'rgba(34,197,94,0.5)'    },
  allergy:      { bg: 'rgba(251,146,60,0.18)',   text: '#fb923c', border: 'rgba(251,146,60,0.5)'   },
  patient_info: { bg: 'rgba(136,153,187,0.18)',  text: '#8899bb', border: 'rgba(136,153,187,0.5)'  },
  date:         { bg: 'rgba(96,165,250,0.18)',   text: '#60a5fa', border: 'rgba(96,165,250,0.5)'   },
  provider:     { bg: 'rgba(74,222,128,0.18)',   text: '#4ade80', border: 'rgba(74,222,128,0.5)'   },
};

const ENTITY_TYPES = Object.keys(ENTITY_COLORS) as EmrEntityType[];

// ── Sample EMR document ─────────────────────────────────────────────────────

const SAMPLE_TEXT = `PATIENT: John D., 67M   |   VISIT DATE: 2026-05-15   |   ATTENDING: Dr. Sarah Chen, MD

CHIEF COMPLAINT
Shortness of breath and chest pain, progressively worsening over 2 days.

HISTORY OF PRESENT ILLNESS
The patient is a 67-year-old male with a known history of Type 2 Diabetes Mellitus, Hypertension, and Coronary Artery Disease. He presents with progressive shortness of breath and bilateral lower extremity edema for the past 2 days. He also reports chest tightness and reduced exercise tolerance.

CURRENT MEDICATIONS
· Metformin 1000mg PO twice daily
· Lisinopril 10mg PO once daily
· Atorvastatin 40mg PO nightly
· Aspirin 81mg PO daily
· Furosemide 40mg PO daily

PHYSICAL EXAMINATION
Vital Signs: BP 158/92 mmHg  ·  HR 88 bpm  ·  RR 18/min  ·  SpO2 94% room air  ·  Temp 37.1°C
Cardiovascular: Regular rate and rhythm, S3 gallop present, +2 pitting edema bilateral lower extremities
Respiratory: Bilateral basal crackles noted

LABORATORY RESULTS
BNP: 1250 pg/mL (HIGH)  ·  Troponin I: 0.04 ng/mL  ·  eGFR: 52 mL/min/1.73m²  ·  HbA1c: 7.8%

ASSESSMENT AND PLAN
1. Acute Decompensated Heart Failure — IV Furosemide 80mg, strict fluid restriction 1.5 L/day
2. Type 2 Diabetes Mellitus — Continue Metformin 1000mg BID, endocrine consult
3. Hypertension — Uptitrate Lisinopril to 20mg, low-sodium diet
4. Coronary Artery Disease — Continue Aspirin 81mg, cardiology follow-up`;

const SAMPLE_DOCS = [
  { id: 'emr-001', label: 'emr-001 — Admission Note: Heart Failure (P-10042)' },
  { id: 'emr-002', label: 'emr-002 — Discharge Summary: Pneumonia (P-10087)' },
  { id: 'emr-003', label: 'emr-003 — Progress Note: Diabetes Follow-up (P-10031)' },
];

// ── Build initial AI annotations ────────────────────────────────────────────

function buildInitialAnnotations(doc: string): EmrAnnotation[] {
  const defs: { text: string; type: EmrEntityType; confidence: number; confirmed?: boolean }[] = [
    { text: 'John D., 67M',                    type: 'patient_info', confidence: 0.99, confirmed: true  },
    { text: '2026-05-15',                       type: 'date',         confidence: 1.00, confirmed: true  },
    { text: 'Dr. Sarah Chen',                   type: 'provider',     confidence: 0.96, confirmed: true  },
    { text: 'Type 2 Diabetes Mellitus',         type: 'diagnosis',    confidence: 0.97, confirmed: true  },
    { text: 'Hypertension',                     type: 'diagnosis',    confidence: 0.95, confirmed: true  },
    { text: 'Coronary Artery Disease',          type: 'diagnosis',    confidence: 0.92, confirmed: true  },
    { text: 'Acute Decompensated Heart Failure',type: 'diagnosis',    confidence: 0.91, confirmed: false },
    { text: 'Shortness of breath',              type: 'symptom',      confidence: 0.94, confirmed: true  },
    { text: 'chest pain',                       type: 'symptom',      confidence: 0.93, confirmed: true  },
    { text: 'bilateral lower extremity edema',  type: 'symptom',      confidence: 0.91, confirmed: false },
    { text: 'chest tightness',                  type: 'symptom',      confidence: 0.88, confirmed: false },
    { text: 'Metformin 1000mg',                 type: 'medication',   confidence: 0.99, confirmed: true  },
    { text: 'Lisinopril 10mg',                  type: 'medication',   confidence: 0.99, confirmed: true  },
    { text: 'Atorvastatin 40mg',                type: 'medication',   confidence: 0.98, confirmed: true  },
    { text: 'Aspirin 81mg',                     type: 'medication',   confidence: 0.99, confirmed: true  },
    { text: 'Furosemide 40mg',                  type: 'medication',   confidence: 0.97, confirmed: true  },
    { text: 'IV Furosemide 80mg',               type: 'medication',   confidence: 0.96, confirmed: false },
    { text: 'BP 158/92 mmHg',                   type: 'vital_sign',   confidence: 0.99, confirmed: true  },
    { text: 'HR 88 bpm',                        type: 'vital_sign',   confidence: 0.99, confirmed: false },
    { text: 'SpO2 94% room air',                type: 'vital_sign',   confidence: 0.99, confirmed: false },
    { text: 'BNP: 1250 pg/mL',                  type: 'lab_result',   confidence: 0.98, confirmed: false },
    { text: 'Troponin I: 0.04 ng/mL',           type: 'lab_result',   confidence: 0.97, confirmed: false },
    { text: 'HbA1c: 7.8%',                      type: 'lab_result',   confidence: 0.98, confirmed: false },
  ];

  const anns: EmrAnnotation[] = [];
  let id = 1;
  for (const d of defs) {
    const idx = doc.indexOf(d.text);
    if (idx !== -1) {
      anns.push({ id: `ai-${id++}`, start: idx, end: idx + d.text.length, text: d.text, entityType: d.type, confidence: d.confidence, confirmed: d.confirmed ?? false });
    }
  }
  return anns;
}

// ── Render annotated text ───────────────────────────────────────────────────

function renderAnnotatedText(
  text: string,
  annotations: EmrAnnotation[],
  selectedId: string | null,
  onSelect: (id: string) => void,
): React.ReactNode[] {
  const sorted = [...annotations].sort((a, b) => a.start - b.start);
  const noOverlap: EmrAnnotation[] = [];
  let cursor = 0;
  for (const ann of sorted) {
    if (ann.start >= cursor) { noOverlap.push(ann); cursor = ann.end; }
  }

  const nodes: React.ReactNode[] = [];
  let pos = 0;
  for (const ann of noOverlap) {
    if (pos < ann.start) nodes.push(<span key={`t-${pos}`}>{text.slice(pos, ann.start)}</span>);
    const c = ENTITY_COLORS[ann.entityType];
    const isSelected = selectedId === ann.id;
    nodes.push(
      <mark
        key={ann.id}
        onClick={() => onSelect(ann.id)}
        title={`${ann.entityType.replace('_', ' ')}${ann.confidence != null ? ` · ${Math.round(ann.confidence * 100)}% confidence` : ''}`}
        style={{
          background: ann.confirmed ? c.bg : `${c.bg.replace('0.18', '0.09')}`,
          color: c.text,
          borderRadius: 3,
          padding: '1px 3px',
          cursor: 'pointer',
          border: `1px solid ${isSelected ? c.text : ann.confirmed ? c.border : c.border.replace('0.5', '0.25')}`,
          outline: isSelected ? `2px solid ${c.text}` : 'none',
          outlineOffset: 1,
          fontWeight: ann.confirmed ? 600 : 400,
          textDecoration: ann.confidence == null ? 'underline dotted' : 'none',
          transition: 'all 0.1s',
        }}
      >
        {ann.text}
      </mark>,
    );
    pos = ann.end;
  }
  if (pos < text.length) nodes.push(<span key={`t-end`}>{text.slice(pos)}</span>);
  return nodes;
}

// ── Page component ──────────────────────────────────────────────────────────

export default function AnnotatePage() {
  const [docId, setDocId] = useState('emr-001');
  const [annotations, setAnnotations] = useState<EmrAnnotation[]>(() => buildInitialAnnotations(SAMPLE_TEXT));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<EmrEntityType | 'all'>('all');
  const [saved, setSaved] = useState(false);
  const [pendingSel, setPendingSel] = useState<{ start: number; end: number; text: string; x: number; y: number } | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  let nextId = useRef(100);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textRef.current) return;
    const range = sel.getRangeAt(0);
    if (!textRef.current.contains(range.commonAncestorContainer)) return;
    const preRange = document.createRange();
    preRange.selectNodeContents(textRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const selectedText = sel.toString().trim();
    if (!selectedText || selectedText.length < 2) return;
    const rect = range.getBoundingClientRect();
    setPendingSel({ start, end: start + selectedText.length, text: selectedText, x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  const addAnnotation = useCallback((type: EmrEntityType) => {
    if (!pendingSel) return;
    setAnnotations((prev) => [
      ...prev,
      { id: `h-${nextId.current++}`, start: pendingSel.start, end: pendingSel.end, text: pendingSel.text, entityType: type, confirmed: true },
    ]);
    setPendingSel(null);
    window.getSelection()?.removeAllRanges();
  }, [pendingSel]);

  const confirm = useCallback((id: string) => setAnnotations((prev) => prev.map((a) => a.id === id ? { ...a, confirmed: true } : a)), []);
  const reject = useCallback((id: string) => setAnnotations((prev) => prev.filter((a) => a.id !== id)), []);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const visibleAnns = useMemo(
    () => annotations.filter((a) => typeFilter === 'all' || a.entityType === typeFilter).sort((a, b) => a.start - b.start),
    [annotations, typeFilter],
  );

  const confirmedCount = annotations.filter((a) => a.confirmed).length;
  const pendingCount = annotations.filter((a) => !a.confirmed).length;

  const renderedText = useMemo(
    () => renderAnnotatedText(SAMPLE_TEXT, annotations, selectedId, (id) => { setSelectedId((p) => p === id ? null : id); }),
    [annotations, selectedId],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/emr" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="page-title">Annotation Workspace</div>
            <div className="page-subtitle">Select text to annotate · click a highlight to review</div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div style={{ position: 'relative' }}>
            <select
              className="form-select"
              style={{ width: 300, paddingRight: 28, fontSize: 12 }}
              value={docId}
              onChange={(e) => { setDocId(e.target.value); setAnnotations(buildInitialAnnotations(SAMPLE_TEXT)); setSelectedId(null); }}
            >
              {SAMPLE_DOCS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--success)' }}>{confirmedCount} confirmed</span> · <span style={{ color: 'var(--warning)' }}>{pendingCount} pending</span>
          </span>
          <button className={`btn btn-sm ${saved ? 'btn-secondary' : 'btn-primary'}`} onClick={handleSave}>
            {saved ? <><CheckCircle size={12} /> Saved</> : <><Save size={12} /> Save</>}
          </button>
        </div>
      </div>

      {/* Body: doc viewer + annotation panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Document viewer */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', position: 'relative', background: 'var(--bg-primary)' }}
          onMouseUp={handleMouseUp}
        >
          <div
            ref={textRef}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 2, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', userSelect: 'text' }}
          >
            {renderedText}
          </div>
        </div>

        {/* Annotation panel */}
        <div style={{ width: 360, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
          {/* Filter tabs */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              className={`btn btn-sm ${typeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={() => setTypeFilter('all')}
            >
              All ({annotations.length})
            </button>
            {ENTITY_TYPES.map((t) => {
              const count = annotations.filter((a) => a.entityType === t).length;
              if (count === 0) return null;
              const c = ENTITY_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
                  style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, border: 'none',
                    background: typeFilter === t ? c.bg : 'transparent',
                    color: typeFilter === t ? c.text : 'var(--text-muted)',
                    outline: typeFilter === t ? `1px solid ${c.border}` : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {t.replace('_', ' ')} ({count})
                </button>
              );
            })}
          </div>

          {/* Annotation list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
            {visibleAnns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                No annotations yet.<br />
                <span style={{ fontSize: 11 }}>Select text in the document to add one.</span>
              </div>
            ) : (
              visibleAnns.map((ann) => {
                const c = ENTITY_COLORS[ann.entityType];
                const isSelected = selectedId === ann.id;
                return (
                  <div
                    key={ann.id}
                    onClick={() => setSelectedId((p) => p === ann.id ? null : ann.id)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                      background: isSelected ? c.bg : 'var(--bg-card)',
                      border: `1px solid ${isSelected ? c.border : 'var(--border)'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: c.text, background: c.bg, padding: '1px 6px', borderRadius: 3 }}>
                        {ann.entityType.replace('_', ' ')}
                      </span>
                      <div className="flex gap-2 items-center">
                        {ann.confidence != null && (
                          <span style={{ fontSize: 10, color: ann.confidence >= 0.95 ? 'var(--success)' : ann.confidence >= 0.85 ? 'var(--warning)' : 'var(--danger)', fontFamily: 'monospace' }}>
                            {Math.round(ann.confidence * 100)}%
                          </span>
                        )}
                        {ann.confirmed ? (
                          <CheckCircle size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                        ) : (
                          <span style={{ fontSize: 9, background: 'var(--warning-dim)', color: 'var(--warning)', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>AI</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: ann.confidence != null && !ann.confirmed ? 8 : 0 }}>
                      "{ann.text}"
                    </div>
                    {/* Action buttons for unconfirmed AI suggestions */}
                    {!ann.confirmed && (
                      <div className="flex gap-2" style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-sm"
                          style={{ flex: 1, fontSize: 11, background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}
                          onClick={() => confirm(ann.id)}
                        >
                          <CheckCircle size={11} /> Confirm
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ flex: 1, fontSize: 11, background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}
                          onClick={() => reject(ann.id)}
                        >
                          <XCircle size={11} /> Reject
                        </button>
                      </div>
                    )}
                    {ann.confirmed && ann.confidence == null && (
                      <div style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-sm btn-danger"
                          style={{ fontSize: 10, padding: '2px 8px' }}
                          onClick={() => reject(ann.id)}
                        >
                          <Trash2 size={10} /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add annotation shortcut */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              <Tag size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Select text in the document to annotate
            </div>
          </div>
        </div>
      </div>

      {/* Entity legend */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 20px', display: 'flex', gap: 14, flexWrap: 'wrap', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        {ENTITY_TYPES.map((t) => {
          const c = ENTITY_COLORS[t];
          return (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.border}` }} />
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'capitalize', letterSpacing: 0.3 }}>{t.replace('_', ' ')}</span>
            </div>
          );
        })}
      </div>

      {/* Selection popover */}
      {pendingSel && (
        <div
          style={{
            position: 'fixed',
            top: pendingSel.y - 10,
            left: pendingSel.x,
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 10,
            padding: '10px 12px',
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            minWidth: 280,
            maxWidth: 340,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            <Tag size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Annotate: <strong style={{ color: 'var(--text-primary)' }}>"{pendingSel.text.slice(0, 40)}{pendingSel.text.length > 40 ? '…' : ''}"</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ENTITY_TYPES.map((t) => {
              const c = ENTITY_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => addAnnotation(t)}
                  style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}`, transition: 'all 0.1s' }}
                >
                  {t.replace('_', ' ')}
                </button>
              );
            })}
            <button
              onClick={() => { setPendingSel(null); window.getSelection()?.removeAllRanges(); }}
              style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
