'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Zap, DollarSign, Cpu, Upload, Search, ExternalLink, Minimize2 } from 'lucide-react';
import api from '@/api/client';
import { saveMockJob } from '@/lib/mockStore';

interface HfMeta { id: string; description?: string; downloads?: number; likes?: number; tags?: string[] }
interface SelectedModel { id: string; name: string; params: string }

const METHODS = [
  {
    id: 'quantize',
    label: 'Quantization',
    badge: 'Fastest',
    badgeColor: 'var(--success)',
    desc: 'Convert weight data type (FP16 → INT8 / INT4 / FP8). No architecture change. Calibration dataset improves accuracy.',
    sizeRange: '0.25–0.5× original',
  },
  {
    id: 'prune',
    label: 'Structured Pruning',
    badge: null,
    badgeColor: null,
    desc: 'Remove low-importance attention heads and MLP neurons, then fine-tune to recover accuracy.',
    sizeRange: '0.6–0.8× original',
  },
  {
    id: 'distill',
    label: 'Knowledge Distillation',
    badge: 'Best Quality',
    badgeColor: 'var(--accent)',
    desc: "Train a smaller student model to match the teacher's output logits — highest quality for the compressed size.",
    sizeRange: '0.25–0.55× original',
  },
  {
    id: 'prune+distill',
    label: 'Prune + Distill',
    badge: null,
    badgeColor: null,
    desc: 'Prune the model structure then use distillation-based recovery fine-tuning. Best quality/size tradeoff.',
    sizeRange: '0.4–0.6× original',
  },
];

const QUANT_TARGETS = [
  { id: 'int8', label: 'INT8',     factor: 0.50, desc: '2× smaller, <1% quality loss, widely supported' },
  { id: 'int4', label: 'INT4',     factor: 0.25, desc: '4× smaller, ~2% quality loss' },
  { id: 'fp8',  label: 'FP8 E4M3',factor: 0.50, desc: '2× smaller, native H100 throughput' },
  { id: 'nf4',  label: 'NF4',      factor: 0.25, desc: '4× smaller, normal-float optimized for LLMs' },
];

const PRUNE_RATIOS = [
  { id: '20', label: '20% pruned', factor: 0.80, desc: 'Conservative — minimal accuracy impact' },
  { id: '30', label: '30% pruned', factor: 0.70, desc: 'Balanced size/quality tradeoff' },
  { id: '40', label: '40% pruned', factor: 0.60, desc: 'Aggressive — requires longer recovery' },
];

const STUDENT_SIZES = [
  { id: 'half-layers',    label: 'Half depth',   factor: 0.55, desc: 'Remove half the transformer layers' },
  { id: 'half-width',     label: 'Half width',   factor: 0.65, desc: 'Reduce attention heads & FFN dimension' },
  { id: 'quarter-params', label: '¼ parameters', factor: 0.28, desc: 'Full architecture shrink — depth + width' },
];

const GPU_TIERS = [
  { id: 'rtx-4090',  label: 'RTX 4090',  vram: 24, tflops: 82.6, costPerHr: 0.74 },
  { id: 'a100-40gb', label: 'A100 40GB', vram: 40, tflops: 312,  costPerHr: 2.10 },
  { id: 'a100-80gb', label: 'A100 80GB', vram: 80, tflops: 312,  costPerHr: 3.20 },
  { id: 'h100-80gb', label: 'H100 80GB', vram: 80, tflops: 989,  costPerHr: 5.89 },
];

const OUTPUT_FORMATS = [
  { id: 'merged', label: 'FP16 Weights', desc: 'Full-precision, ready to serve' },
  { id: 'gguf',   label: 'GGUF (Q4)',    desc: 'Optimized for Ollama / llama.cpp' },
  { id: 'gptq',   label: 'GPTQ',         desc: 'Optimized for vLLM inference' },
  { id: 'fp8',    label: 'FP8 (E4M3)',   desc: 'Native H100 throughput' },
];

function formatBytes(b: number) {
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function detectFormat(content: string): string {
  const line = content.split('\n').find((l) => l.trim());
  if (!line) return 'unknown';
  try {
    const obj = JSON.parse(line);
    if (obj.messages || obj.conversations) return 'JSONL Chat';
    if (obj.instruction || obj.output) return 'JSONL Alpaca';
    if (obj.prompt && obj.chosen) return 'JSONL DPO';
    return 'JSONL';
  } catch {
    if (content.includes(',')) return 'CSV';
    return 'Plain Text';
  }
}

function parseParamGb(params: string): number {
  const m = params.match(/([\d.]+)\s*([BM])/i);
  if (!m) return 14;
  const n = parseFloat(m[1]);
  const billions = m[2].toUpperCase() === 'B' ? n : n / 1000;
  return parseFloat((billions * 2).toFixed(1));
}

export default function DistillPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [teacherModel, setTeacherModel] = useState<SelectedModel | null>(null);
  const [teacherInput, setTeacherInput] = useState('');

  const [datasetTab, setDatasetTab] = useState<'upload' | 'huggingface'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [hfRepoId, setHfRepoId] = useState('');
  const [hfMeta, setHfMeta] = useState<HfMeta | null>(null);
  const [hfChecking, setHfChecking] = useState(false);
  const [hfError, setHfError] = useState('');

  const [method, setMethod] = useState('quantize');
  const [quantTarget, setQuantTarget] = useState('int8');
  const [pruneRatio, setPruneRatio] = useState('20');
  const [studentSize, setStudentSize] = useState('half-layers');
  const [gpuType, setGpuType] = useState('a100-80gb');
  const [gpuCount, setGpuCount] = useState(1);
  const [outputFormat, setOutputFormat] = useState('gguf');
  const [epochs, setEpochs] = useState(1);

  const [launching, setLaunching] = useState(false);
  const [uploadedDatasetId, setUploadedDatasetId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('selectedModel');
    if (stored) {
      try {
        const m = JSON.parse(stored) as SelectedModel;
        setTeacherModel(m);
        setTeacherInput(m.name);
      } catch {}
    }
  }, []);

  const handleFile = (f: File) => {
    setFile(f);
    setDatasetName(f.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      setDetectedFormat(detectFormat(content));
    };
    reader.readAsText(f.slice(0, 50000));
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
      setDatasetName(id.split('/').pop() || id);
    } catch {
      setHfError('Could not reach HuggingFace — check your connection');
    } finally { setHfChecking(false); }
  };

  const gpu = GPU_TIERS.find((g) => g.id === gpuType)!;
  const teacherGb = teacherModel ? parseParamGb(teacherModel.params) : 14;

  const compressionFactor = (() => {
    const qf = QUANT_TARGETS.find((q) => q.id === quantTarget)?.factor ?? 0.5;
    const pf = PRUNE_RATIOS.find((r) => r.id === pruneRatio)?.factor ?? 0.7;
    const sf = STUDENT_SIZES.find((s) => s.id === studentSize)?.factor ?? 0.55;
    if (method === 'quantize') return qf;
    if (method === 'prune') return pf;
    if (method === 'distill') return sf;
    return parseFloat((pf * sf).toFixed(3));
  })();

  const outputGb = parseFloat((teacherGb * compressionFactor).toFixed(1));
  const estimatedHrs = method === 'quantize'
    ? 0.5
    : parseFloat(((epochs * 500000) / (gpu.tflops * 1e12 * 0.4 * 3600) * 1e9).toFixed(2));
  const estimatedCost = parseFloat((estimatedHrs * gpu.costPerHr * gpuCount).toFixed(2));
  const datasetReady = datasetTab === 'upload' ? !!file : !!hfMeta;

  const handleLaunch = async () => {
    setLaunching(true);
    const effectiveName = datasetTab === 'huggingface'
      ? (hfMeta?.id?.split('/').pop() || hfRepoId)
      : (datasetName || file?.name || 'dataset');
    try {
      let dsId = uploadedDatasetId;
      if (!dsId && datasetTab === 'huggingface' && hfMeta) {
        const r = await api.post('/datasets/import-hf', { repoId: hfRepoId.trim(), name: hfMeta.id.split('/').pop(), description: hfMeta.description?.slice(0, 200) });
        dsId = r.data.id; setUploadedDatasetId(dsId);
      } else if (!dsId && file) {
        const fd = new FormData();
        fd.append('file', file); fd.append('name', datasetName); fd.append('type', 'jsonl');
        const r = await api.post('/datasets', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        dsId = r.data.id; setUploadedDatasetId(dsId);
      }
      const res = await api.post('/training/launch', {
        modelId: teacherModel?.id || 'custom',
        baseModelId: teacherModel?.id,
        datasetId: dsId,
        method: 'qlora',
        compressionMethod: method,
        compressionTarget: method === 'quantize' ? quantTarget : method === 'prune' ? pruneRatio : studentSize,
        gpuType, gpuCount, epochs, outputFormat,
        useFlashAttention: true, useGradientCheckpointing: true,
      });
      router.push(`/jobs/${res.data.id}`);
    } catch {
      const mockId = `mock-${Date.now()}`;
      saveMockJob({
        id: mockId,
        modelName: teacherModel?.name || teacherInput || 'Teacher Model',
        datasetName: effectiveName,
        method,
        outputFormat,
        gpuType,
        gpuVramGb: gpu.vram,
        gpuTflops: gpu.tflops,
        estimatedCostUsd: estimatedCost,
        totalEpochs: epochs,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      router.push(`/jobs/${mockId}`);
    }
  };

  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
      {['Teacher + Data', 'Compression', 'Review'].map((label, i) => {
        const s = i + 1; const active = step === s; const done = step > s;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-card)',
                color: done || active ? '#fff' : 'var(--text-muted)',
                border: `2px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}` }}>
                {done ? '✓' : s}
              </div>
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
            </div>
            {i < 2 && <div style={{ width: 40, height: 1, background: done ? 'var(--success)' : 'var(--border)', margin: '0 12px' }} />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Distill & Compress</div>
          <div className="page-subtitle">Reduce model size via quantization, pruning, or knowledge distillation — output always smaller than the teacher</div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 760 }}>
        <StepIndicator />

        {/* ── Step 1 ─────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="card mb-4">
              <div className="card-header"><div className="card-title">Teacher Model</div></div>
              <div className="card-body">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Model name or HuggingFace path</label>
                  <input className="form-input" style={{ fontFamily: 'monospace' }}
                    value={teacherInput}
                    onChange={(e) => setTeacherInput(e.target.value)}
                    placeholder="e.g. meta-llama/Llama-3-8B  or  mistralai/Mistral-7B-v0.1" />
                  {teacherModel && teacherInput === teacherModel.name && (
                    <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 6 }}>
                      Pre-filled from Model Catalog — {teacherModel.params} parameters (~{parseParamGb(teacherModel.params)} GB FP16)
                    </div>
                  )}
                  <div className="form-hint">
                    Select a model from <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => router.push('/catalog')}>Model Catalog</span> to auto-fill
                  </div>
                </div>
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header"><div className="card-title"><Upload size={14} /> Calibration / Distillation Dataset</div></div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary)', borderRadius: 8, padding: 4 }}>
                  {(['upload', 'huggingface'] as const).map((tab) => (
                    <button key={tab} onClick={() => setDatasetTab(tab)}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: datasetTab === tab ? 'var(--bg-card)' : 'transparent',
                        color: datasetTab === tab ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {tab === 'upload'
                        ? <><Upload size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Upload File</>
                        : <>🤗 HuggingFace</>}
                    </button>
                  ))}
                </div>

                {datasetTab === 'upload' ? (
                  <>
                    <div className={`upload-zone${dragOver ? ' drag-over' : ''}`}
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
                      {file ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{file.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{formatBytes(file.size)} — {detectedFormat}</div>
                        </>
                      ) : (
                        <>
                          <Upload size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Drop calibration dataset</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>JSONL, CSV, Parquet — 512–5 000 samples is enough for calibration</div>
                        </>
                      )}
                    </div>
                    <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                      Paste a HuggingFace dataset repo ID to use as the calibration / distillation dataset.
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">HuggingFace Repo ID</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="form-input" style={{ flex: 1, fontFamily: 'monospace' }}
                          value={hfRepoId}
                          onChange={(e) => { setHfRepoId(e.target.value); setHfMeta(null); setHfError(''); }}
                          onKeyDown={(e) => e.key === 'Enter' && checkHfRepo()}
                          placeholder="owner/dataset-name" />
                        <button className="btn btn-secondary" onClick={checkHfRepo} disabled={hfChecking || !hfRepoId.trim()}>
                          {hfChecking ? <div className="spinner" /> : <><Search size={13} /> Verify</>}
                        </button>
                      </div>
                      {hfError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{hfError}</div>}
                    </div>
                    {hfMeta && (
                      <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{hfMeta.id}</div>
                          <a href={`https://huggingface.co/datasets/${hfMeta.id}`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            View <ExternalLink size={10} />
                          </a>
                        </div>
                        {hfMeta.downloads != null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>↓ {hfMeta.downloads.toLocaleString()} downloads</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                      Popular:{' '}
                      {['tatsu-lab/alpaca', 'HuggingFaceH4/ultrachat_200k', 'allenai/c4'].map((ex, i) => (
                        <span key={ex}>
                          {i > 0 && ' · '}
                          <span style={{ fontFamily: 'monospace', color: 'var(--accent)', cursor: 'pointer' }}
                            onClick={() => { setHfRepoId(ex); setHfMeta(null); setHfError(''); }}>{ex}
                          </span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" disabled={!teacherInput.trim() || !datasetReady} onClick={() => setStep(2)}>
                Next: Compression <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2 ─────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div className="card mb-4">
              <div className="card-header"><div className="card-title"><Minimize2 size={14} /> Compression Method</div></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {METHODS.map((m) => (
                    <div key={m.id} onClick={() => setMethod(m.id)}
                      style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                        border: `2px solid ${method === m.id ? 'var(--accent)' : 'var(--border)'}`,
                        background: method === m.id ? 'var(--accent-dim)' : 'var(--bg-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{m.label}</div>
                        {m.badge && (
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                            background: m.badgeColor + '22', color: m.badgeColor!, border: `1px solid ${m.badgeColor}` }}>
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>{m.desc}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{m.sizeRange}</div>
                    </div>
                  ))}
                </div>

                {method === 'quantize' && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Target dtype</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {QUANT_TARGETS.map((q) => (
                        <div key={q.id} onClick={() => setQuantTarget(q.id)}
                          style={{ padding: '10px 12px', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                            border: `2px solid ${quantTarget === q.id ? 'var(--cyan)' : 'var(--border)'}`,
                            background: quantTarget === q.id ? 'rgba(34,211,238,0.08)' : 'var(--bg-secondary)' }}>
                          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, color: quantTarget === q.id ? 'var(--cyan)' : 'var(--text-primary)' }}>{q.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{q.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(method === 'prune' || method === 'prune+distill') && (
                  <div style={{ marginBottom: method === 'prune+distill' ? 20 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Pruning ratio</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {PRUNE_RATIOS.map((r) => (
                        <div key={r.id} onClick={() => setPruneRatio(r.id)}
                          style={{ padding: '10px 12px', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                            border: `2px solid ${pruneRatio === r.id ? 'var(--warning)' : 'var(--border)'}`,
                            background: pruneRatio === r.id ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)' }}>
                          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, color: pruneRatio === r.id ? 'var(--warning)' : 'var(--text-primary)' }}>{r.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(method === 'distill' || method === 'prune+distill') && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Student architecture</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {STUDENT_SIZES.map((s) => (
                        <div key={s.id} onClick={() => setStudentSize(s.id)}
                          style={{ padding: '10px 12px', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                            border: `2px solid ${studentSize === s.id ? 'var(--purple)' : 'var(--border)'}`,
                            background: studentSize === s.id ? 'rgba(167,139,250,0.08)' : 'var(--bg-secondary)' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: studentSize === s.id ? 'var(--purple)' : 'var(--text-primary)' }}>{s.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{s.desc}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{(s.factor * 100).toFixed(0)}% size</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header"><div className="card-title"><Cpu size={14} /> GPU + Output</div></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / 3' }}>
                    <label className="form-label">GPU Type</label>
                    <select className="form-select" value={gpuType} onChange={(e) => setGpuType(e.target.value)}>
                      {GPU_TIERS.map((g) => <option key={g.id} value={g.id}>{g.label} — {g.vram}GB</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Count</label>
                    <select className="form-select" value={gpuCount} onChange={(e) => setGpuCount(Number(e.target.value))}>
                      {[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n}×</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Output</label>
                    <select className="form-select" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
                      {OUTPUT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                </div>

                {method !== 'quantize' && (
                  <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                    <label className="form-label">Recovery epochs</label>
                    <input type="number" className="form-input" style={{ width: 100 }} min={1} max={20} value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} />
                    <div className="form-hint">Fine-tuning epochs after compression to recover accuracy</div>
                  </div>
                )}

                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <DollarSign size={13} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Cost Estimate</span>
                  </div>
                  <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>~{estimatedHrs}h</span>
                    <span>${gpu.costPerHr.toFixed(2)}/hr × {gpuCount} GPU</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>≈ ${estimatedCost}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}><ChevronLeft size={14} /> Back</button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>Review <ChevronRight size={14} /></button>
            </div>
          </div>
        )}

        {/* ── Step 3 ─────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div className="card mb-4">
              <div className="card-header"><div className="card-title">Review Configuration</div></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  {([
                    { label: 'Teacher Model', value: teacherModel?.name || teacherInput },
                    { label: 'Dataset', value: datasetTab === 'huggingface' ? (hfMeta?.id || hfRepoId) : (file?.name || '') },
                    { label: 'Method', value: METHODS.find((m) => m.id === method)?.label || method },
                    { label: 'GPU', value: `${GPU_TIERS.find((g) => g.id === gpuType)?.label} × ${gpuCount}` },
                    { label: 'Output Format', value: OUTPUT_FORMATS.find((f) => f.id === outputFormat)?.label || outputFormat },
                    method !== 'quantize' ? { label: 'Recovery Epochs', value: String(epochs) } : null,
                  ] as ({ label: string; value: string } | null)[]).filter((row): row is { label: string; value: string } => row !== null).map(({ label, value }) => (
                    <div key={label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '20px 24px', background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Teacher size</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{teacherGb} GB</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>FP16</div>
                  </div>
                  <div style={{ fontSize: 28, color: 'var(--success)', fontWeight: 300, padding: '0 20px' }}>→</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Output size</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--success)', lineHeight: 1 }}>{outputGb} GB</div>
                    <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>{(compressionFactor * 100).toFixed(0)}% of original</div>
                  </div>
                  <div style={{ width: 1, height: 60, background: 'var(--border)', margin: '0 24px' }} />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Reduction</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--cyan)', lineHeight: 1 }}>{((1 - compressionFactor) * 100).toFixed(0)}%</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>smaller</div>
                  </div>
                </div>

                <div style={{ padding: '12px 16px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 2 }}>Estimated Cost</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>~{estimatedHrs}h × ${gpu.costPerHr.toFixed(2)}/hr × {gpuCount} GPU</div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>${estimatedCost}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}><ChevronLeft size={14} /> Back</button>
              <button className="btn btn-primary" onClick={handleLaunch} disabled={launching}>
                {launching ? 'Launching...' : <><Zap size={14} /> Launch Compression</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
