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
  const all = [
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
  const visible = Math.max(1, Math.ceil((pct / 100) * all.length));
  return all.slice(0, visible);
}

type ArtFmt = 'adapter' | 'merged' | 'gguf' | 'gptq' | 'awq';

export function getMockArtifacts(job: MockJob) {
  const fmt = job.outputFormat;
  const base: { id: string; format: ArtFmt; fileSizeGb: number; status: 'ready' }[] = [
    { id: 'art-adapter', format: 'adapter', fileSizeGb: 0.03, status: 'ready' },
    { id: 'art-merged',  format: 'merged',  fileSizeGb: 7.2,  status: 'ready' },
  ];
  if (fmt === 'gguf' || fmt === 'adapter') base.push({ id: 'art-gguf', format: 'gguf', fileSizeGb: 4.1, status: 'ready' });
  if (fmt === 'gptq')                      base.push({ id: 'art-gptq', format: 'gptq', fileSizeGb: 3.8, status: 'ready' });
  return base.map((a) => ({ ...a, jobId: job.id, modelName: job.modelName, quantBits: a.format === 'adapter' ? undefined : 4, downloadUrl: '#', createdAt: job.createdAt }));
}
