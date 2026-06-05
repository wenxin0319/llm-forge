'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Download, Zap, Copy, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import api from '@/api/client';
import { getMockJob, getMockArtifacts, type MockJob } from '@/lib/mockStore';

interface Artifact {
  id: string;
  jobId: string;
  modelName: string;
  format: 'adapter' | 'merged' | 'gguf' | 'gptq' | 'awq' | 'fp8';
  status: 'ready' | 'quantizing' | 'error';
  fileSizeGb: number;
  quantBits?: number;
  downloadUrl?: string;
  createdAt: string;
}

interface Job { id: string; modelName: string; status: string; trainLoss?: number; actualCostUsd?: number }

const FORMAT_META: Record<string, { label: string; desc: string; icon: string; color: string }> = {
  adapter: { label: 'LoRA Adapter', desc: 'Lightweight weights only — requires base model to run', icon: '🔌', color: 'var(--accent)' },
  merged: { label: 'Merged FP16', desc: 'Full model in float16 — ready to serve immediately', icon: '🏗️', color: 'var(--purple)' },
  gguf: { label: 'GGUF Q4_K_M', desc: 'Quantized for Ollama / llama.cpp — runs on any hardware', icon: '⚡', color: 'var(--success)' },
  gptq: { label: 'GPTQ INT4', desc: 'Quantized for vLLM — optimal GPU server inference', icon: '🚀', color: 'var(--cyan)' },
  awq: { label: 'AWQ INT4', desc: 'Activation-aware quantization — best quality at 4-bit', icon: '🎯', color: 'var(--warning)' },
  fp8: { label: 'FP8 (E4M3)', desc: 'BF16→FP8 conversion — native H100 throughput, 8-bit float precision', icon: '🔥', color: 'var(--danger, #ef4444)' },
};

function formatSize(gb: number) {
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  return `${gb.toFixed(2)} GB`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button className="btn btn-secondary btn-sm" onClick={copy}>
      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> {label}</>}
    </button>
  );
}

function ArtifactCard({ artifact, onQuantize, mockCfg }: { artifact: Artifact; onQuantize: (id: string, fmt: string) => void; mockCfg?: MockJob | null }) {
  const meta = FORMAT_META[artifact.format] || { label: artifact.format, desc: '', icon: '📦', color: 'var(--text-muted)' };
  const isQuantizing = artifact.status === 'quantizing';

  return (
    <div className="card" style={{ borderColor: isQuantizing ? 'var(--warning)' : undefined }}>
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{meta.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{meta.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{meta.desc}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{formatSize(artifact.fileSizeGb)}</div>
            {artifact.quantBits && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{artifact.quantBits}-bit</div>}
          </div>
        </div>

        {isQuantizing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 8, fontSize: 13, color: 'var(--warning)' }}>
            <div className="spinner" style={{ borderTopColor: 'var(--warning)' }} /> Quantizing...
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {artifact.downloadUrl && (
              mockCfg ? (
                <button className="btn btn-primary btn-sm" onClick={() => downloadModelCard(artifact, mockCfg)}>
                  <Download size={12} /> Download (demo)
                </button>
              ) : (
                <a href={artifact.downloadUrl} className="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer">
                  <Download size={12} /> Download
                </a>
              )
            )}
            {artifact.format === 'merged' && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => onQuantize(artifact.id, 'gguf')}>→ GGUF Q4</button>
                <button className="btn btn-secondary btn-sm" onClick={() => onQuantize(artifact.id, 'gptq')}>→ GPTQ INT4</button>
                <button className="btn btn-secondary btn-sm" onClick={() => onQuantize(artifact.id, 'fp8')}>→ FP8</button>
              </>
            )}
            {artifact.format === 'gguf' && artifact.downloadUrl && (
              <CopyButton text={`ollama run ${artifact.downloadUrl}`} label="Copy Ollama cmd" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatWidget({ modelName }: { modelName: string }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const send = () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages((p) => [...p, userMsg]);
    setInput('');
    setThinking(true);
    setTimeout(() => {
      setMessages((p) => [...p, { role: 'assistant', content: `[${modelName}] This is a simulated response. Connect your serving endpoint to enable real inference.` }]);
      setThinking(false);
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 300 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>Send a message to test your fine-tuned model</div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <div style={{ display: 'inline-block', maxWidth: '80%', padding: '8px 12px', borderRadius: 10, background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-secondary)', color: m.role === 'user' ? '#fff' : 'var(--text-secondary)', fontSize: 13, textAlign: 'left' }}>
              {m.content}
            </div>
          </div>
        ))}
        {thinking && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>Thinking...</div>}
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input className="form-input" style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask your fine-tuned model..." />
        <button className="btn btn-primary btn-sm" onClick={send} disabled={thinking}>Send</button>
      </div>
    </div>
  );
}

function downloadModelCard(artifact: Artifact, mockCfg: MockJob) {
  const card = {
    model_name: mockCfg.modelName,
    base_model: 'llama-3-8b',
    training_method: mockCfg.method.toUpperCase(),
    format: artifact.format,
    size_gb: artifact.fileSizeGb,
    epochs: mockCfg.totalEpochs,
    train_loss: 0.847,
    val_loss: 0.923,
    dataset: mockCfg.datasetName,
    gpu: mockCfg.gpuType,
    cost_usd: +(mockCfg.estimatedCostUsd * 0.96).toFixed(2),
    created_at: new Date().toISOString(),
    demo_note: 'This is a model card demo. In production, this download would contain the actual model weights.',
    usage: artifact.format === 'gguf'
      ? `ollama run ${mockCfg.modelName.toLowerCase().replace(/\s+/g, '-')}`
      : `from transformers import AutoModelForCausalLM\nmodel = AutoModelForCausalLM.from_pretrained("./${mockCfg.modelName.replace(/\s+/g, '_')}")`,
  };
  const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${mockCfg.modelName.replace(/\s+/g, '_')}_${artifact.format}_model_card.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ArtifactsPage() {
  const { id } = useParams<{ id: string }>();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [mockCfg, setMockCfg] = useState<MockJob | null>(null);
  const isMock = id?.startsWith('mock-');

  const load = async () => {
    if (isMock) {
      const cfg = getMockJob(id);
      if (cfg) {
        setMockCfg(cfg);
        setJob({ id, modelName: cfg.modelName, status: 'completed', trainLoss: 0.847, actualCostUsd: +(cfg.estimatedCostUsd * 0.96).toFixed(2) });
        setArtifacts(getMockArtifacts(cfg) as Artifact[]);
      }
      setLoading(false);
      return;
    }
    try {
      const [jobRes, artRes] = await Promise.all([api.get(`/jobs/${id}`), api.get('/artifacts', { params: { jobId: id } })]);
      setJob(jobRes.data);
      setArtifacts(artRes.data);
      setLoading(false);
    } catch { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (!isMock) {
      const hasQuantizing = artifacts.some((a) => a.status === 'quantizing');
      if (hasQuantizing) {
        const t = setInterval(load, 3000);
        return () => clearInterval(t);
      }
    }
  }, [id]);

  const handleQuantize = async (artifactId: string, format: string) => {
    if (!isMock) await api.post(`/artifacts/${artifactId}/quantize`, { format });
    load();
  };

  if (loading) return (
    <div>
      <div className="page-header"><div className="page-title">Model Artifacts</div></div>
      <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{job?.modelName || 'Model'} — Artifacts</div>
          <div className="page-subtitle">
            Fine-tuning complete · Train loss: {job?.trainLoss ?? '—'} · Cost: ${job?.actualCostUsd?.toFixed(2) ?? '—'}
          </div>
        </div>
        <Link href={`/jobs/${id}`} className="btn btn-secondary btn-sm">← Job details</Link>
      </div>

      <div className="page-content">
        {artifacts.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-text">No artifacts yet</div>
              <div className="empty-state-sub">Artifacts are created when the training job completes</div>
              <Link href={`/jobs/${id}`} className="btn btn-secondary mt-3">View job progress</Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 28 }}>
              {artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} onQuantize={handleQuantize} mockCfg={mockCfg} />)}
            </div>

            <div className="card mb-4">
              <div className="card-header">
                <div className="card-title">API Access</div>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Use the OpenAI-compatible endpoint to call your model from any application.
                </div>
                <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#7dd3fc', border: '1px solid var(--border)', marginBottom: 12 }}>
                  {`POST https://api.llmforge.io/v1/endpoints/${id}/generate\nAuthorization: Bearer YOUR_API_KEY\nContent-Type: application/json`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <CopyButton text={`https://api.llmforge.io/v1/endpoints/${id}/generate`} label="Copy endpoint" />
                  <button className="btn btn-secondary btn-sm"><ExternalLink size={12} /> View docs</button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title"><Zap size={14} /> Try your model</div></div>
              <ChatWidget modelName={job?.modelName || 'Model'} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
