'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ChevronRight, ChevronLeft, Zap, DollarSign, Cpu, Settings2 } from 'lucide-react';
import api from '@/api/client';
import { saveMockJob } from '@/lib/mockStore';

interface SelectedModel { id: string; name: string; params: string; vramRequiredGb: { qlora: number; lora: number; full: number }; supportedMethods: string[] }

const METHODS = [
  { id: 'qlora', label: 'QLoRA', badge: 'Recommended', desc: '~75% less VRAM, 80-90% quality of full fine-tune', color: 'var(--success)' },
  { id: 'lora', label: 'LoRA', badge: null, desc: '10-20x VRAM reduction, 90-95% quality', color: 'var(--accent)' },
  { id: 'full', label: 'Full Fine-tune', badge: null, desc: 'Maximum quality, requires large GPU cluster', color: 'var(--purple)' },
  { id: 'dpo', label: 'DPO', badge: null, desc: 'Alignment training — needs preference pairs dataset', color: 'var(--cyan)' },
];

const GPU_TIERS = [
  { id: 'rtx-4090', label: 'RTX 4090', vram: 24, tflops: 82.6, costPerHr: 0.74 },
  { id: 'a100-40gb', label: 'A100 40GB', vram: 40, tflops: 312, costPerHr: 2.10 },
  { id: 'a100-80gb', label: 'A100 80GB', vram: 80, tflops: 312, costPerHr: 3.20 },
  { id: 'h100-80gb', label: 'H100 80GB', vram: 80, tflops: 989, costPerHr: 5.89 },
];

const OUTPUT_FORMATS = [
  { id: 'adapter', label: 'Adapter only', desc: '~30 MB — LoRA weights, requires base model to run' },
  { id: 'merged', label: 'Merged FP16', desc: '~4-70 GB — ready to serve, no base model needed' },
  { id: 'gguf', label: 'Merged + GGUF Q4', desc: '~1-20 GB — optimized for Ollama / llama.cpp' },
  { id: 'gptq', label: 'Merged + GPTQ', desc: '~1-20 GB — optimized for vLLM server inference' },
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
    if (obj.text) return 'JSONL Raw Text';
    return 'JSONL';
  } catch {
    if (content.includes(',')) return 'CSV';
    return 'Plain Text';
  }
}

export default function FinetunePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [model, setModel] = useState<SelectedModel | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dataset state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [detectedFormat, setDetectedFormat] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [trainSplit, setTrainSplit] = useState(85);
  const [instrField, setInstrField] = useState('instruction');
  const [outputField, setOutputField] = useState('output');

  // Config state
  const [method, setMethod] = useState('qlora');
  const [gpuType, setGpuType] = useState('a100-80gb');
  const [gpuCount, setGpuCount] = useState(1);
  const [epochs, setEpochs] = useState(3);
  const [batchSize, setBatchSize] = useState(8);
  const [lr, setLr] = useState(0.0002);
  const [loraRank, setLoraRank] = useState(16);
  const [maxSeqLen, setMaxSeqLen] = useState(2048);
  const [outputFormat, setOutputFormat] = useState('gguf');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [launching, setLaunching] = useState(false);
  const [uploadedDatasetId, setUploadedDatasetId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('selectedModel');
    if (stored) { try { setModel(JSON.parse(stored)); } catch {} }
  }, []);

  const handleFile = (f: File) => {
    setFile(f);
    setDatasetName(f.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      setDetectedFormat(detectFormat(content));
      setPreview(content.split('\n').filter((l) => l.trim()).slice(0, 8));
    };
    reader.readAsText(f.slice(0, 50000));
  };

  const gpu = GPU_TIERS.find((g) => g.id === gpuType)!;
  const estimatedHrs = parseFloat(((epochs * 1000000) / (gpu.tflops * 1e12 * 0.4 * 3600) * 1e9).toFixed(2));
  const estimatedCost = parseFloat((estimatedHrs * gpu.costPerHr * gpuCount).toFixed(2));

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      let dsId = uploadedDatasetId;
      if (!dsId && file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('name', datasetName);
        fd.append('type', detectedFormat.toLowerCase().includes('jsonl') ? 'jsonl' : 'text');
        const dsRes = await api.post('/datasets', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        dsId = dsRes.data.id;
        setUploadedDatasetId(dsId);
      }
      const res = await api.post('/training/launch', {
        modelId: model?.id || 'custom', baseModelId: model?.id, datasetId: dsId,
        method, gpuType, gpuCount, epochs, batchSize, learningRate: lr,
        loraRank, maxSeqLength: maxSeqLen, outputFormat,
        useFlashAttention: true, useGradientCheckpointing: true,
      });
      router.push(`/jobs/${res.data.id}`);
    } catch {
      // No backend — run in demo mode
      const g = GPU_TIERS.find((x) => x.id === gpuType)!;
      const mockId = `mock-${Date.now()}`;
      saveMockJob({
        id: mockId,
        modelName: model?.name || 'My Fine-tuned Model',
        datasetName: datasetName || file?.name || 'training-data',
        method, outputFormat, gpuType,
        gpuVramGb: g.vram, gpuTflops: g.tflops,
        estimatedCostUsd: estimatedCost,
        totalEpochs: epochs,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      router.push(`/jobs/${mockId}`);
    }
  };

  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {['Dataset', 'Configure', 'Launch'].map((label, i) => {
        const s = i + 1;
        const active = step === s;
        const done = step > s;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-card)', color: done || active ? '#fff' : 'var(--text-muted)', border: `2px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}` }}>
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
          <div className="page-title">Fine-tune Wizard</div>
          {model && <div className="page-subtitle">Base model: <strong style={{ color: 'var(--accent)' }}>{model.name}</strong> — <span style={{ cursor: 'pointer', color: 'var(--text-muted)', textDecoration: 'underline' }} onClick={() => router.push('/catalog')}>change</span></div>}
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 760 }}>
        <StepIndicator />

        {/* Step 1: Dataset */}
        {step === 1 && (
          <div>
            <div className="card mb-4">
              <div className="card-header"><div className="card-title"><Upload size={14} /> Upload Training Data</div></div>
              <div className="card-body">
                <div className={`upload-zone mb-4${dragOver ? ' drag-over' : ''}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
                  {file ? (
                    <><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{file.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{formatBytes(file.size)} — {detectedFormat}</div></>
                  ) : (
                    <><Upload size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} /><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Drop your dataset here</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>JSONL, CSV, Parquet, plain text — up to 5 GB</div></>
                  )}
                </div>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

                {file && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Dataset Name</label>
                      <input className="form-input" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
                    </div>
                    {detectedFormat && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: 'var(--success-dim)', borderRadius: 8, border: '1px solid var(--success)', fontSize: 13 }}>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Detected format:</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{detectedFormat}</span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Instruction field</label>
                        <input className="form-input" value={instrField} onChange={(e) => setInstrField(e.target.value)} placeholder="instruction" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Output field</label>
                        <input className="form-input" value={outputField} onChange={(e) => setOutputField(e.target.value)} placeholder="output" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Train / Validation split — {trainSplit}% train</label>
                      <input type="range" min={70} max={95} value={trainSplit} onChange={(e) => setTrainSplit(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                      <div className="form-hint">{trainSplit}% training data, {100 - trainSplit}% validation</div>
                    </div>

                    {preview.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Preview (first {preview.length} rows)</div>
                        <div className="log-viewer" style={{ color: '#a5f3fc' }}>
                          {preview.map((line, i) => <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.length > 200 ? line.slice(0, 200) + '…' : line}</div>)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" disabled={!file} onClick={() => setStep(2)}>
                Next: Configure <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <div>
            <div className="card mb-4">
              <div className="card-header"><div className="card-title"><Settings2 size={14} /> Training Method</div></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {METHODS.map((m) => (
                    <div key={m.id} onClick={() => setMethod(m.id)}
                      style={{ padding: '12px 14px', borderRadius: 10, border: `2px solid ${method === m.id ? m.color : 'var(--border)'}`, cursor: 'pointer', background: method === m.id ? `rgba(${m.color === 'var(--success)' ? '34,197,94' : m.color === 'var(--accent)' ? '79,142,247' : m.color === 'var(--purple)' ? '167,139,250' : '34,211,238'},0.08)` : 'var(--bg-secondary)', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{m.label}</div>
                        {m.badge && <span className="badge badge-green" style={{ fontSize: 9 }}>{m.badge}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header"><div className="card-title"><Cpu size={14} /> GPU Configuration</div></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">GPU Type</label>
                    <select className="form-select" value={gpuType} onChange={(e) => setGpuType(e.target.value)}>
                      {GPU_TIERS.map((g) => <option key={g.id} value={g.id}>{g.label} — {g.vram}GB VRAM</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">GPU Count</label>
                    <select className="form-select" value={gpuCount} onChange={(e) => setGpuCount(Number(e.target.value))}>
                      {[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n}×</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Epochs</label>
                    <input type="number" className="form-input" min={1} max={50} value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Output Format</label>
                    <select className="form-select" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
                      {OUTPUT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <DollarSign size={13} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Cost Estimate</span>
                  </div>
                  <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>~{estimatedHrs}h training</span>
                    <span>${gpu.costPerHr.toFixed(2)}/hr × {gpuCount} GPU{gpuCount > 1 ? 's' : ''}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>≈ ${estimatedCost}</span>
                  </div>
                </div>

                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setShowAdvanced((p) => !p)}>
                  <Settings2 size={12} /> {showAdvanced ? 'Hide' : 'Show'} advanced options
                </button>

                {showAdvanced && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Batch Size</label>
                      <input type="number" className="form-input" min={1} max={128} value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Learning Rate</label>
                      <input type="number" className="form-input" step="0.00001" value={lr} onChange={(e) => setLr(Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">LoRA Rank</label>
                      <select className="form-select" value={loraRank} onChange={(e) => setLoraRank(Number(e.target.value))}>
                        {[8, 16, 32, 64, 128].map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Max Seq Length</label>
                      <select className="form-select" value={maxSeqLen} onChange={(e) => setMaxSeqLen(Number(e.target.value))}>
                        {[512, 1024, 2048, 4096, 8192].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}><ChevronLeft size={14} /> Back</button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>Review & Launch <ChevronRight size={14} /></button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Launch */}
        {step === 3 && (
          <div>
            <div className="card mb-4">
              <div className="card-header"><div className="card-title">Review Configuration</div></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {[
                    { label: 'Base Model', value: model?.name || 'Not selected' },
                    { label: 'Dataset', value: file?.name || 'None' },
                    { label: 'Method', value: METHODS.find((m) => m.id === method)?.label || method },
                    { label: 'GPU', value: `${GPU_TIERS.find((g) => g.id === gpuType)?.label} × ${gpuCount}` },
                    { label: 'Epochs', value: String(epochs) },
                    { label: 'Output Format', value: OUTPUT_FORMATS.find((f) => f.id === outputFormat)?.label || outputFormat },
                    { label: 'Learning Rate', value: lr.toExponential(1) },
                    { label: 'LoRA Rank', value: String(loraRank) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                {launching ? 'Launching...' : <><Zap size={14} /> Launch Fine-tune</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
