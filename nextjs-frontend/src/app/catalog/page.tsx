'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Zap, ExternalLink, X, GitCompare, Star, Download, ChevronRight, Cpu, Layers } from 'lucide-react';
import api from '@/api/client';
import { CATALOG, type CatalogModel } from '@/lib/catalogData';

function fmtCtx(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const LICENSE_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  'apache-2.0': { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', label: 'Apache 2.0' },
  'mit':        { bg: 'rgba(34,211,238,0.12)', text: '#22d3ee', label: 'MIT' },
  'meta':       { bg: 'rgba(79,142,247,0.12)', text: '#4f8ef7', label: 'Meta' },
  'llama4':     { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa', label: 'Llama 4' },
};

const ARCH_GRADIENT: Record<string, string> = {
  LLaMA:        'linear-gradient(135deg, #4f8ef7, #6366f1)',
  'LLaMA-MoE':  'linear-gradient(135deg, #4f8ef7, #a78bfa)',
  Mistral:      'linear-gradient(135deg, #f59e0b, #ef4444)',
  'Mistral-MoE':'linear-gradient(135deg, #f59e0b, #a78bfa)',
  Phi:          'linear-gradient(135deg, #22d3ee, #4f8ef7)',
  'Gemma-MoE':  'linear-gradient(135deg, #22c55e, #22d3ee)',
  Qwen:         'linear-gradient(135deg, #a78bfa, #ec4899)',
  'Qwen-MoE':   'linear-gradient(135deg, #a78bfa, #f59e0b)',
  'DeepSeek-MoE':'linear-gradient(135deg, #ef4444, #f59e0b)',
  Falcon:       'linear-gradient(135deg, #6366f1, #22d3ee)',
  Yi:           'linear-gradient(135deg, #22c55e, #4f8ef7)',
};

function ArchAvatar({ architecture, name }: { architecture: string; name: string }) {
  const gradient = ARCH_GRADIENT[architecture] || 'linear-gradient(135deg, #4f8ef7, #a78bfa)';
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div style={{ width: 48, height: 48, borderRadius: 12, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0, letterSpacing: -0.5 }}>
      {initials}
    </div>
  );
}

function ModelCard({ model, onSelect, onDetail, pinned, onPin }: {
  model: CatalogModel;
  onSelect: (m: CatalogModel) => void;
  onDetail: (m: CatalogModel) => void;
  pinned: boolean;
  onPin: (m: CatalogModel) => void;
}) {
  const lic = LICENSE_COLOR[model.licenseType] || { bg: 'rgba(100,120,150,0.15)', text: '#8899bb', label: model.licenseType };
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#16203a' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--border-light)' : 'var(--border)'}`,
        borderRadius: 16,
        padding: '20px 22px',
        cursor: 'pointer',
        transition: 'all 0.18s',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.25)' : 'none',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }} onClick={() => onDetail(model)}>
        <ArchAvatar architecture={model.architecture} name={model.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 5, lineHeight: 1.3 }}>{model.name}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(79,142,247,0.15)', color: '#4f8ef7', padding: '2px 7px', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              {model.isMoE ? model.activeParams : model.params}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, background: lic.bg, color: lic.text, padding: '2px 7px', borderRadius: 6 }}>
              {lic.label}
            </span>
            {model.isMoE && (
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Layers size={9} /> MoE
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onPin(model); }}
          style={{ background: pinned ? 'rgba(79,142,247,0.15)' : 'var(--bg-secondary)', border: `1px solid ${pinned ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 7px', cursor: 'pointer', color: pinned ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, transition: 'all 0.15s' }}
          title="Compare"
        >
          <GitCompare size={13} />
        </button>
      </div>

      {/* Use case */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, cursor: 'pointer' }} onClick={() => onDetail(model)}>
        {model.useCase}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }} onClick={() => onDetail(model)}>
        {[
          { icon: <Cpu size={11} />, label: 'Context', value: `${fmtCtx(model.contextWindow)} tok` },
          { icon: <Zap size={11} />, label: 'QLoRA VRAM', value: `${model.vramRequiredGb.qlora} GB` },
          { icon: <Download size={11} />, label: 'Downloads', value: fmtNum(model.downloads) },
        ].map(({ icon, label, value }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '7px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', marginBottom: 3 }}>
              {icon}
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onClick={() => onDetail(model)}>
        {model.tags.slice(0, 4).map((t) => (
          <span key={t} style={{ fontSize: 10, padding: '2px 7px', background: 'var(--border)', borderRadius: 20, color: 'var(--text-muted)', fontWeight: 500 }}>{t}</span>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, fontSize: 12, padding: '8px 12px', justifyContent: 'center' }}
          onClick={() => onSelect(model)}
        >
          <Zap size={13} /> Fine-tune this model
        </button>
        <a
          href={`https://huggingface.co/${model.huggingfaceId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ padding: '8px 11px' }}
          onClick={(e) => e.stopPropagation()}
          title="View on HuggingFace"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

function DetailDrawer({ model, onClose, onSelect }: { model: CatalogModel; onClose: () => void; onSelect: (m: CatalogModel) => void }) {
  const lic = LICENSE_COLOR[model.licenseType] || { bg: 'rgba(100,120,150,0.15)', text: '#8899bb', label: model.licenseType };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }} onClick={onClose}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
      <div
        style={{ width: 440, background: '#0f1525', borderLeft: '1px solid var(--border-light)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer hero */}
        <div style={{ padding: '28px 28px 20px', background: 'linear-gradient(135deg, rgba(79,142,247,0.08), rgba(167,139,250,0.08))', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <ArchAvatar architecture={model.architecture} name={model.name} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 8 }}>{model.name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, background: 'rgba(79,142,247,0.15)', color: '#4f8ef7', padding: '3px 9px', borderRadius: 7, fontFamily: 'JetBrains Mono, monospace' }}>
                  {model.isMoE ? model.params : model.params}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, background: lic.bg, color: lic.text, padding: '3px 9px', borderRadius: 7 }}>{lic.label}</span>
                {model.isMoE && <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '3px 8px', borderRadius: 7 }}>MoE</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star size={12} style={{ color: '#f59e0b' }} /> {fmtNum(model.stars)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Download size={12} /> {fmtNum(model.downloads)} downloads</span>
          </div>
        </div>

        <div style={{ padding: '20px 28px', flex: 1 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 24 }}>{model.useCase}</p>

          {/* Specs */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: 'var(--text-muted)', marginBottom: 12 }}>Specifications</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {[
                ['Architecture', model.architecture],
                ['Parameters', model.isMoE ? `${model.params} total · ${model.activeParams}` : model.params],
                ['Context Window', `${fmtCtx(model.contextWindow)} tokens`],
                ['HuggingFace ID', model.huggingfaceId],
                ['License', model.license],
              ].map(([label, value], i) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: label === 'HuggingFace ID' ? 'JetBrains Mono, monospace' : undefined, fontWeight: 500, maxWidth: 220, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* VRAM */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: 'var(--text-muted)', marginBottom: 12 }}>VRAM Requirements</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { method: 'QLoRA', vram: model.vramRequiredGb.qlora, badge: 'Recommended', barColor: '#22c55e' },
                { method: 'LoRA', vram: model.vramRequiredGb.lora, badge: null, barColor: '#4f8ef7' },
                { method: 'Full Fine-tune', vram: model.vramRequiredGb.full, badge: null, barColor: '#a78bfa' },
              ].map(({ method, vram, badge, barColor }) => (
                <div key={method} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{method}</span>
                      {badge && <span style={{ fontSize: 9, background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{badge}</span>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{vram} GB</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (vram / model.vramRequiredGb.full) * 100)}%`, background: barColor, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: 'var(--text-muted)', marginBottom: 10 }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {model.tags.map((t) => (
                <span key={t} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--border)', borderRadius: 20, color: 'var(--text-secondary)', fontWeight: 500 }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 14, padding: '11px 16px' }} onClick={() => onSelect(model)}>
            <Zap size={15} /> Fine-tune this model <ChevronRight size={14} />
          </button>
          <a href={`https://huggingface.co/${model.huggingfaceId}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '11px 14px' }} title="View on HuggingFace">
            <ExternalLink size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}

const SIZE_TIERS = [
  { label: '≤ 7B', min: 0, max: 7 },
  { label: '8–14B', min: 8, max: 14 },
  { label: '15–70B', min: 15, max: 70 },
  { label: '70B+', min: 71, max: Infinity },
];

export default function CatalogPage() {
  const router = useRouter();
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [licenseFilter, setLicenseFilter] = useState<string[]>([]);
  const [sizeTier, setSizeTier] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [detailModel, setDetailModel] = useState<CatalogModel | null>(null);
  const [pinned, setPinned] = useState<CatalogModel[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    api.get('/catalog')
      .then((r) => { setModels(r.data); setLoading(false); })
      .catch(() => {
        // Backend unavailable — use the built-in static catalog
        setModels(CATALOG);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const tier = SIZE_TIERS.find((t) => t.label === sizeTier);
    return models.filter((m) => {
      if (search) {
        const q = search.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.useCase.toLowerCase().includes(q) && !m.tags.some((t) => t.includes(q)) && !m.architecture.toLowerCase().includes(q)) return false;
      }
      if (licenseFilter.length && !licenseFilter.includes(m.licenseType)) return false;
      if (tier && (m.paramsB < tier.min || m.paramsB > tier.max)) return false;
      if (methodFilter && !m.supportedMethods.includes(methodFilter)) return false;
      return true;
    });
  }, [models, search, licenseFilter, sizeTier, methodFilter]);

  const handleSelect = (m: CatalogModel) => {
    localStorage.setItem('selectedModel', JSON.stringify(m));
    router.push('/finetune');
  };

  const toggleLicense = (lt: string) => setLicenseFilter((p) => p.includes(lt) ? p.filter((x) => x !== lt) : [...p, lt]);
  const togglePin = (m: CatalogModel) => setPinned((p) => p.find((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : p.length < 3 ? [...p, m] : p);
  const hasFilters = licenseFilter.length > 0 || sizeTier !== null || methodFilter !== null;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Model Catalog</div>
          <div className="page-subtitle">{models.length} open-source models ready to fine-tune on your data</div>
        </div>
        {pinned.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setShowCompare(true)}>
            <GitCompare size={14} /> Compare ({pinned.length}/3)
          </button>
        )}
      </div>

      <div className="page-content">
        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 42, fontSize: 14, padding: '11px 14px 11px 42px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
            placeholder="Search by name, architecture, use case, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={15} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          {/* Filter sidebar */}
          <div style={{ width: 192, flexShrink: 0 }}>
            <div style={{ position: 'sticky', top: 80 }}>
              {hasFilters && (
                <button className="btn btn-secondary btn-sm w-full" style={{ marginBottom: 16, justifyContent: 'center' }} onClick={() => { setLicenseFilter([]); setSizeTier(null); setMethodFilter(null); }}>
                  <X size={12} /> Clear all filters
                </button>
              )}

              {[
                {
                  title: 'License',
                  items: [
                    { id: 'apache-2.0', label: 'Apache 2.0', color: '#22c55e' },
                    { id: 'mit', label: 'MIT', color: '#22d3ee' },
                    { id: 'meta', label: 'Meta Community', color: '#4f8ef7' },
                    { id: 'llama4', label: 'Llama 4', color: '#a78bfa' },
                  ],
                  type: 'checkbox' as const,
                  active: licenseFilter,
                  toggle: toggleLicense,
                },
              ].map((section) => (
                <div key={section.title} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: 'var(--text-muted)', marginBottom: 10 }}>{section.title}</div>
                  {section.items.map(({ id, label, color }) => (
                    <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${section.active.includes(id) ? color : 'var(--border-light)'}`, background: section.active.includes(id) ? `rgba(${color === '#22c55e' ? '34,197,94' : color === '#22d3ee' ? '34,211,238' : color === '#4f8ef7' ? '79,142,247' : '167,139,250'},0.2)` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                        {section.active.includes(id) && <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />}
                      </div>
                      <input type="checkbox" checked={section.active.includes(id)} onChange={() => section.toggle(id)} style={{ display: 'none' }} />
                      <span style={{ fontSize: 12, color: section.active.includes(id) ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: section.active.includes(id) ? 600 : 400 }}>{label}</span>
                    </label>
                  ))}
                </div>
              ))}

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: 'var(--text-muted)', marginBottom: 10 }}>Parameter Size</div>
                {SIZE_TIERS.map((t) => (
                  <label key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${sizeTier === t.label ? 'var(--accent)' : 'var(--border-light)'}`, background: sizeTier === t.label ? 'var(--accent-dim)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                      {sizeTier === t.label && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />}
                    </div>
                    <input type="radio" name="size" checked={sizeTier === t.label} onChange={() => setSizeTier(sizeTier === t.label ? null : t.label)} style={{ display: 'none' }} />
                    <span style={{ fontSize: 12, color: sizeTier === t.label ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: sizeTier === t.label ? 600 : 400 }}>{t.label}</span>
                  </label>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: 'var(--text-muted)', marginBottom: 10 }}>Method Support</div>
                {['qlora', 'lora', 'full', 'dpo'].map((m) => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${methodFilter === m ? 'var(--purple)' : 'var(--border-light)'}`, background: methodFilter === m ? 'var(--purple-dim)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                      {methodFilter === m && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--purple)' }} />}
                    </div>
                    <input type="radio" name="method" checked={methodFilter === m} onChange={() => setMethodFilter(methodFilter === m ? null : m)} style={{ display: 'none' }} />
                    <span style={{ fontSize: 12, color: methodFilter === m ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: methodFilter === m ? 600 : 400, textTransform: 'uppercase' }}>{m}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Model grid */}
          <div style={{ flex: 1 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ height: 260, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', animation: 'pulse 1.5s ease infinite', opacity: 0.6 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No models match your filters</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Try adjusting your search or filters</div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setLicenseFilter([]); setSizeTier(null); setMethodFilter(null); }}>Clear all</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{filtered.length} model{filtered.length !== 1 ? 's' : ''}</span>
                  {hasFilters && <span style={{ color: 'var(--accent)' }}>· filtered</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {filtered.map((m) => (
                    <ModelCard
                      key={m.id}
                      model={m}
                      onSelect={handleSelect}
                      onDetail={setDetailModel}
                      pinned={!!pinned.find((p) => p.id === m.id)}
                      onPin={togglePin}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {detailModel && <DetailDrawer model={detailModel} onClose={() => setDetailModel(null)} onSelect={(m) => { setDetailModel(null); handleSelect(m); }} />}

      {/* Compare modal */}
      {showCompare && pinned.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowCompare(false)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 20, padding: 32, width: Math.min(300 * pinned.length + 64, 950), maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Model Comparison</div>
              <button onClick={() => setShowCompare(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pinned.length}, 1fr)`, gap: 16 }}>
              {pinned.map((m) => (
                <div key={m.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <ArchAvatar architecture={m.architecture} name={m.name} />
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{m.name}</div>
                  </div>
                  {[
                    { label: 'Parameters', value: m.isMoE ? m.activeParams! : m.params },
                    { label: 'Context', value: `${fmtCtx(m.contextWindow)} tokens` },
                    { label: 'License', value: LICENSE_COLOR[m.licenseType]?.label || m.licenseType },
                    { label: 'Architecture', value: m.architecture },
                    { label: 'QLoRA VRAM', value: `${m.vramRequiredGb.qlora} GB` },
                    { label: 'LoRA VRAM', value: `${m.vramRequiredGb.lora} GB` },
                    { label: 'Full FT VRAM', value: `${m.vramRequiredGb.full} GB` },
                    { label: 'Downloads', value: fmtNum(m.downloads) },
                    { label: 'Methods', value: m.supportedMethods.join(', ').toUpperCase() },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{value}</div>
                    </div>
                  ))}
                  <button className="btn btn-primary btn-sm w-full" style={{ marginTop: 14, justifyContent: 'center' }} onClick={() => { setShowCompare(false); handleSelect(m); }}>
                    <Zap size={12} /> Select
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
