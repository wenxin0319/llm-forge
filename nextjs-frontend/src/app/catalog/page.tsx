'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Zap, ExternalLink, SlidersHorizontal, X, GitCompare } from 'lucide-react';
import api from '@/api/client';

interface CatalogModel {
  id: string;
  name: string;
  params: string;
  paramsB: number;
  contextWindow: number;
  license: string;
  licenseType: string;
  useCase: string;
  huggingfaceId: string;
  architecture: string;
  tags: string[];
  vramRequiredGb: { qlora: number; lora: number; full: number };
  supportedMethods: string[];
  isMoE: boolean;
  activeParams?: string;
  downloads: number;
  stars: number;
}

function formatContext(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

function formatDl(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

function LicenseBadge({ type }: { type: string }) {
  const map: Record<string, string> = { 'apache-2.0': 'badge-green', 'mit': 'badge-cyan', 'meta': 'badge-blue', 'llama4': 'badge-purple' };
  const label: Record<string, string> = { 'apache-2.0': 'Apache 2.0', 'mit': 'MIT', 'meta': 'Meta Community', 'llama4': 'Llama 4' };
  return <span className={`badge ${map[type] || 'badge-gray'}`}>{label[type] || type}</span>;
}

function ModelCard({ model, onSelect, onDetail, pinned, onPin }: {
  model: CatalogModel;
  onSelect: (m: CatalogModel) => void;
  onDetail: (m: CatalogModel) => void;
  pinned: boolean;
  onPin: (m: CatalogModel) => void;
}) {
  return (
    <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-light)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div onClick={() => onDetail(model)} style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{model.name}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 7px', borderRadius: 6 }}>
                {model.isMoE ? model.activeParams : model.params}
              </span>
              <LicenseBadge type={model.licenseType} />
              {model.isMoE && <span className="badge badge-yellow">MoE</span>}
            </div>
          </div>
          <button onClick={() => onPin(model)} style={{ background: pinned ? 'var(--accent-dim)' : 'none', border: pinned ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: pinned ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11 }}>
            <GitCompare size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }} onClick={() => onDetail(model)}>
          {model.useCase}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }} onClick={() => onDetail(model)}>
          {[
            { label: 'Context', value: formatContext(model.contextWindow) },
            { label: 'VRAM (QLoRA)', value: `${model.vramRequiredGb.qlora} GB` },
            { label: 'Downloads', value: formatDl(model.downloads) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 8px' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {model.tags.slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => onSelect(model)}>
            <Zap size={12} /> Fine-tune
          </button>
          <a href={`https://huggingface.co/${model.huggingfaceId}`} target="_blank" rel="noopener noreferrer"
            className="btn btn-secondary btn-sm" onClick={(e) => e.stopPropagation()}>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({ model, onClose, onSelect }: { model: CatalogModel; onClose: () => void; onSelect: (m: CatalogModel) => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={onClose}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 420, background: 'var(--bg-card)', borderLeft: '1px solid var(--border-light)', padding: 28, overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{model.name}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <LicenseBadge type={model.licenseType} />
              {model.isMoE && <span className="badge badge-yellow">MoE</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>{model.useCase}</div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Specifications</div>
          {[
            { label: 'Architecture', value: model.architecture },
            { label: 'Parameters', value: model.isMoE ? `${model.params} (${model.activeParams})` : model.params },
            { label: 'Context Window', value: `${formatContext(model.contextWindow)} tokens` },
            { label: 'HuggingFace ID', value: model.huggingfaceId },
            { label: 'License', value: model.license },
            { label: 'Downloads', value: formatDl(model.downloads) },
            { label: 'Stars', value: `★ ${formatDl(model.stars)}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: label === 'HuggingFace ID' ? 'JetBrains Mono, monospace' : undefined, fontSize: label === 'HuggingFace ID' ? 11 : 13 }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>VRAM Requirements</div>
          {[
            { method: 'QLoRA (recommended)', vram: model.vramRequiredGb.qlora },
            { method: 'LoRA', vram: model.vramRequiredGb.lora },
            { method: 'Full Fine-tune', vram: model.vramRequiredGb.full },
          ].map(({ method, vram }) => (
            <div key={method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{method}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{vram} GB</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSelect(model)}>
            <Zap size={14} /> Fine-tune this model
          </button>
          <a href={`https://huggingface.co/${model.huggingfaceId}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

const SIZE_TIERS = [
  { label: '≤ 7B', max: 7 },
  { label: '8–14B', min: 8, max: 14 },
  { label: '15–70B', min: 15, max: 70 },
  { label: '70B+', min: 71 },
];

export default function CatalogPage() {
  const router = useRouter();
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [licenseFilter, setLicenseFilter] = useState<string[]>([]);
  const [sizeTier, setSizeTier] = useState<string | null>(null);
  const [detailModel, setDetailModel] = useState<CatalogModel | null>(null);
  const [pinned, setPinned] = useState<CatalogModel[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    api.get('/catalog').then((r) => { setModels(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const tier = SIZE_TIERS.find((t) => t.label === sizeTier);
    return models.filter((m) => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.useCase.toLowerCase().includes(search.toLowerCase()) && !m.tags.some((t) => t.includes(search.toLowerCase()))) return false;
      if (licenseFilter.length && !licenseFilter.includes(m.licenseType)) return false;
      if (tier) {
        if (tier.min && m.paramsB < tier.min) return false;
        if (tier.max && m.paramsB > tier.max) return false;
      }
      return true;
    });
  }, [models, search, licenseFilter, sizeTier]);

  const handleSelect = (m: CatalogModel) => {
    localStorage.setItem('selectedModel', JSON.stringify(m));
    router.push('/finetune');
  };

  const togglePin = (m: CatalogModel) => {
    setPinned((p) => p.find((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : p.length < 3 ? [...p, m] : p);
  };

  const toggleLicense = (lt: string) => setLicenseFilter((p) => p.includes(lt) ? p.filter((x) => x !== lt) : [...p, lt]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Model Catalog</div>
          <div className="page-subtitle">{models.length} open-source models ready to fine-tune</div>
        </div>
        {pinned.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setShowCompare(true)}>
            <GitCompare size={14} /> Compare ({pinned.length})
          </button>
        )}
      </div>

      <div className="page-content">
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Filters sidebar */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ position: 'sticky', top: 80 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 10 }}>License</div>
                {[{ id: 'apache-2.0', label: 'Apache 2.0' }, { id: 'mit', label: 'MIT' }, { id: 'meta', label: 'Meta Community' }, { id: 'llama4', label: 'Llama 4' }].map(({ id, label }) => (
                  <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 13, color: licenseFilter.includes(id) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={licenseFilter.includes(id)} onChange={() => toggleLicense(id)} />
                    {label}
                  </label>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 10 }}>Parameter Size</div>
                {SIZE_TIERS.map((t) => (
                  <label key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 13, color: sizeTier === t.label ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    <input type="radio" name="size" checked={sizeTier === t.label} onChange={() => setSizeTier(sizeTier === t.label ? null : t.label)} />
                    {t.label}
                  </label>
                ))}
              </div>

              {(licenseFilter.length > 0 || sizeTier) && (
                <button className="btn btn-secondary btn-sm w-full" onClick={() => { setLicenseFilter([]); setSizeTier(null); }}>
                  <X size={12} /> Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1 }}>
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: 36 }}
                placeholder="Search models by name, use case, or tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">No models match your filters</div>
                <button className="btn btn-secondary btn-sm mt-3" onClick={() => { setSearch(''); setLicenseFilter([]); setSizeTier(null); }}>Clear all</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{filtered.length} model{filtered.length !== 1 ? 's' : ''}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {filtered.map((m) => (
                    <ModelCard key={m.id} model={m} onSelect={handleSelect} onDetail={setDetailModel} pinned={!!pinned.find((p) => p.id === m.id)} onPin={togglePin} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {detailModel && <DetailDrawer model={detailModel} onClose={() => setDetailModel(null)} onSelect={handleSelect} />}

      {showCompare && pinned.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowCompare(false)}>
          <div className="modal" style={{ width: 700, maxWidth: '95vw' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Compare Models</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pinned.length}, 1fr)`, gap: 16 }}>
              {pinned.map((m) => (
                <div key={m.id}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>{m.name}</div>
                  {[
                    { label: 'Params', value: m.isMoE ? m.activeParams! : m.params },
                    { label: 'Context', value: formatContext(m.contextWindow) },
                    { label: 'License', value: m.licenseType },
                    { label: 'Architecture', value: m.architecture },
                    { label: 'QLoRA VRAM', value: `${m.vramRequiredGb.qlora} GB` },
                    { label: 'LoRA VRAM', value: `${m.vramRequiredGb.lora} GB` },
                    { label: 'Downloads', value: formatDl(m.downloads) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ marginBottom: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{value}</div>
                    </div>
                  ))}
                  <button className="btn btn-primary btn-sm w-full mt-3" onClick={() => handleSelect(m)}>Select</button>
                </div>
              ))}
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowCompare(false)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
