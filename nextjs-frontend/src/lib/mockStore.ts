// localStorage-based mock store for demo mode (no backend required)

export interface MockJob {
  id: string;
  modelName: string;
  datasetName: string;
  method: string;
  outputFormat: string;
  gpuType: string;
  gpuVramGb: number;
  gpuTflops: number;
  estimatedCostUsd: number;
  totalEpochs: number;
  startedAt: string;
  createdAt: string;
}

const KEY = 'llmforge_mock_jobs';

export function saveMockJob(job: MockJob): void {
  const all = getAllMockJobs();
  all[job.id] = job;
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(all));
}

export function getAllMockJobs(): Record<string, MockJob> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}

export function getMockJob(id: string): MockJob | null {
  return getAllMockJobs()[id] ?? null;
}

// ── Simulated progress (based on real elapsed wall time) ─────────────────────

const DEMO_DURATION_SECS = 40;

export function getMockProgress(job: MockJob) {
  const elapsed = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
  const pct = Math.min(100, Math.round((elapsed / DEMO_DURATION_SECS) * 100));
  type Status = 'queued' | 'preprocessing' | 'training' | 'packaging' | 'completed';
  const status: Status =
    pct === 0 ? 'queued' :
    pct < 12  ? 'preprocessing' :
    pct < 93  ? 'training' :
    pct < 100 ? 'packaging' : 'completed';
  const epoch = Math.min(job.totalEpochs, Math.max(1, Math.ceil((pct / 100) * job.totalEpochs)));
  const trainLoss = pct > 15 ? Math.max(0.42, 2.1 * Math.exp(-((pct - 15) / 55))) : undefined;
  const valLoss   = pct > 15 ? Math.max(0.51, 2.3 * Math.exp(-((pct - 15) / 52))) : undefined;
  return { pct, status, epoch, trainLoss, valLoss, done: pct >= 100 };
}

export function getMockMetrics(job: MockJob) {
  const { pct } = getMockProgress(job);
  const steps = Math.max(0, Math.round((pct / 100) * 80));
  return Array.from({ length: steps }, (_, i) => ({
    step: (i + 1) * 10,
    epoch: Math.floor((i / steps) * job.totalEpochs) + 1,
    trainLoss: +(Math.max(0.42, 2.1 * Math.exp(-i / 26) + (Math.random() - 0.5) * 0.04)).toFixed(4),
    valLoss:   +(Math.max(0.51, 2.3 * Math.exp(-i / 24) + (Math.random() - 0.5) * 0.06)).toFixed(4),
    tokensPerSec: Math.round(840 + Math.random() * 200),
  }));
}

export function getMockLogs(job: MockJob): string[] {
  const { pct } = getMockProgress(job);

  let all: string[];

  if (job.method === 'quantize') {
    all = [
      `[INFO] Loading teacher model: ${job.modelName}`,
      `[INFO] Loading calibration dataset: ${job.datasetName} (512 samples)`,
      `[INFO] Tokenizing calibration set...`,
      `[INFO] Running forward passes for activation statistics...`,
      `[QUANT] Collecting per-channel weight scales (layer 1/32)...`,
      `[QUANT] Collecting per-channel weight scales (layer 8/32)...`,
      `[QUANT] Collecting per-channel weight scales (layer 16/32)...`,
      `[QUANT] Collecting per-channel weight scales (layer 24/32)...`,
      `[QUANT] Collecting per-channel weight scales (layer 32/32)...`,
      `[QUANT] Applying quantization — converting weights to target dtype...`,
      `[QUANT] Packing weights into quantized format...`,
      `[EVAL]  Perplexity before: 8.42  |  after: 8.67  (Δ +0.25)`,
      `[INFO] Exporting to ${job.outputFormat.toUpperCase()} format...`,
      `[INFO] Artifacts ready — visit the Artifacts tab to download`,
    ];
  } else if (job.method === 'prune') {
    all = [
      `[INFO] Loading teacher model: ${job.modelName}`,
      `[INFO] Loading calibration dataset: ${job.datasetName}`,
      `[PRUNE] Analyzing attention head importance scores...`,
      `[PRUNE] Analyzing MLP neuron importance scores...`,
      `[PRUNE] Identified 842 prunable attention heads (top candidates)`,
      `[PRUNE] Removing low-importance heads — sparsity pass 1/3...`,
      `[PRUNE] Removing low-importance heads — sparsity pass 2/3...`,
      `[PRUNE] Removing low-importance heads — sparsity pass 3/3...`,
      `[INFO] Starting recovery fine-tuning (${job.totalEpochs} epoch${job.totalEpochs > 1 ? 's' : ''})...`,
      `[STEP 100] loss=1.921 | lr=2.0e-4 | tok/s=1124 | VRAM=${job.gpuVramGb - 4}/${job.gpuVramGb}GB`,
      `[STEP 300] loss=1.448 | lr=1.6e-4 | tok/s=1138`,
      `[STEP 500] loss=1.198 | lr=1.0e-4 | tok/s=1141`,
      `[EVAL]  Perplexity before: 8.42  |  after pruning: 9.14  |  after recovery: 8.63`,
      `[INFO] Exporting pruned model to ${job.outputFormat.toUpperCase()}...`,
      `[INFO] Artifacts ready — visit the Artifacts tab to download`,
    ];
  } else if (job.method === 'distill') {
    all = [
      `[INFO] Loading teacher model: ${job.modelName}`,
      `[INFO] Initializing student architecture (compressed config)`,
      `[INFO] Loading distillation dataset: ${job.datasetName}`,
      `[INFO] Tokenizing 12,847 samples...`,
      `[DISTILL] Teacher forward pass — computing soft labels (temperature=4.0)...`,
      `[DISTILL] Student initialized with weight copying from teacher layers`,
      `[INFO] Flash Attention 2 enabled on student`,
      `[INFO] Starting distillation epoch 1/${job.totalEpochs}...`,
      `[STEP 100] kl_loss=2.341 | ce_loss=1.827 | total=4.168 | tok/s=841`,
      `[STEP 300] kl_loss=1.614 | ce_loss=1.242 | total=2.856 | tok/s=863`,
      `[STEP 500] kl_loss=1.187 | ce_loss=0.934 | total=2.121 | tok/s=871`,
      `[STEP 700] kl_loss=0.964 | ce_loss=0.812 | total=1.776 | tok/s=878`,
      `[EVAL]  Student perplexity: 9.08  (teacher: 8.42)  gap: 0.66`,
      `[INFO] Distillation complete — student converged`,
      `[INFO] Exporting student model to ${job.outputFormat.toUpperCase()}...`,
      `[INFO] Artifacts ready — visit the Artifacts tab to download`,
    ];
  } else if (job.method === 'prune+distill') {
    all = [
      `[INFO] Loading teacher model: ${job.modelName}`,
      `[PRUNE] Analyzing layer importance — computing Taylor scores...`,
      `[PRUNE] Removing pruned heads and MLP neurons...`,
      `[INFO] Initializing distillation-based recovery...`,
      `[INFO] Loading dataset: ${job.datasetName} (${job.totalEpochs} recovery epoch${job.totalEpochs > 1 ? 's' : ''})`,
      `[DISTILL] Computing soft labels from unpruned teacher (temperature=3.0)`,
      `[STEP 100] kl_loss=2.614 | ce_loss=1.994 | tok/s=1089`,
      `[STEP 300] kl_loss=1.742 | ce_loss=1.318 | tok/s=1104`,
      `[STEP 500] kl_loss=1.243 | ce_loss=0.981 | tok/s=1118`,
      `[STEP 700] kl_loss=0.894 | ce_loss=0.774 | tok/s=1121`,
      `[EVAL]  Perplexity — teacher: 8.42 | after prune: 9.81 | after distill recovery: 8.79`,
      `[INFO] Exporting to ${job.outputFormat.toUpperCase()}...`,
      `[INFO] Artifacts ready — visit the Artifacts tab to download`,
    ];
  } else {
    all = [
      `[INFO] Initializing training job — ${job.modelName}`,
      `[INFO] Loading dataset: ${job.datasetName}`,
      `[INFO] Tokenizing 12,847 samples with tiktoken...`,
      `[INFO] Dataset split: 10,919 train / 1,928 eval`,
      `[INFO] Loading base model weights...`,
      `[INFO] Applying ${job.method.toUpperCase()} adapter (rank=16, alpha=32)`,
      `[INFO] Flash Attention 2 enabled`,
      `[INFO] Gradient checkpointing ON — VRAM reduced by ~40%`,
      `[INFO] Starting epoch 1/${job.totalEpochs}...`,
      `[STEP 100] loss=1.842 | lr=2.0e-4 | tok/s=914 | VRAM=${job.gpuVramGb - 3}/${job.gpuVramGb}GB`,
      `[STEP 200] loss=1.534 | lr=1.9e-4 | tok/s=927 | VRAM=${job.gpuVramGb - 2}/${job.gpuVramGb}GB`,
      `[STEP 300] loss=1.287 | lr=1.8e-4 | tok/s=918`,
      `[EVAL]  epoch 1 complete — train_loss=1.183 | val_loss=1.241`,
      `[INFO] Starting epoch 2/${job.totalEpochs}...`,
      `[STEP 400] loss=1.102 | lr=1.6e-4 | tok/s=931`,
      `[STEP 500] loss=0.964 | lr=1.4e-4 | tok/s=944`,
      `[STEP 600] loss=0.891 | lr=1.2e-4 | tok/s=928`,
      `[EVAL]  epoch 2 complete — train_loss=0.872 | val_loss=0.934`,
      `[INFO] Starting epoch 3/${job.totalEpochs}...`,
      `[STEP 700] loss=0.856 | lr=0.8e-4 | tok/s=939`,
      `[STEP 800] loss=0.847 | lr=0.4e-4 | tok/s=941`,
      `[EVAL]  epoch 3 complete — train_loss=0.847 | val_loss=0.923`,
      `[INFO] Training complete! Saving adapter weights...`,
      `[INFO] Merging LoRA weights into base model...`,
      `[INFO] Quantizing to ${job.outputFormat.toUpperCase()}...`,
      `[INFO] Artifacts ready — visit the Artifacts tab to download`,
    ];
  }

  const visible = Math.max(1, Math.ceil((pct / 100) * all.length));
  return all.slice(0, visible);
}

type ArtFmt = 'adapter' | 'merged' | 'gguf' | 'gptq' | 'awq' | 'fp8';

export function getMockArtifacts(job: MockJob) {
  const fmt = job.outputFormat;
  const base: { id: string; format: ArtFmt; fileSizeGb: number; quantBits?: number; status: 'ready' }[] = [
    { id: 'art-adapter', format: 'adapter', fileSizeGb: 0.03, status: 'ready' },
    { id: 'art-merged',  format: 'merged',  fileSizeGb: 7.2,  status: 'ready' },
  ];
  if (fmt === 'gguf' || fmt === 'adapter') base.push({ id: 'art-gguf', format: 'gguf', fileSizeGb: 4.1, quantBits: 4, status: 'ready' });
  if (fmt === 'gptq')                      base.push({ id: 'art-gptq', format: 'gptq', fileSizeGb: 3.8, quantBits: 4, status: 'ready' });
  if (fmt === 'fp8')                       base.push({ id: 'art-fp8',  format: 'fp8',  fileSizeGb: 3.6, quantBits: 8, status: 'ready' });
  return base.map((a) => ({ ...a, jobId: job.id, modelName: job.modelName, quantBits: a.quantBits, downloadUrl: '#', createdAt: job.createdAt }));
}
