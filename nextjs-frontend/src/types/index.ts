export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro' | 'enterprise';
  gpuQuotaHours: number;
  usedGpuHours: number;
  createdAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  type: string;
  tags: string[];
  status: 'uploading' | 'processing' | 'ready' | 'error';
  fileSize: number;
  recordCount: number;
  createdAt: string;
}

export interface LlmModel {
  id: string;
  name: string;
  description?: string;
  baseModel: string;
  quantization: string;
  contextLength: number;
  tags: string[];
  status: 'draft' | 'training' | 'ready' | 'deployed' | 'failed';
  parameterCount: string;
  estimatedSizeGb: number;
  trainingJobId?: string;
  createdAt: string;
}

export interface TrainingJob {
  id: string;
  modelId: string;
  modelName: string;
  baseModelId?: string;
  datasetId: string;
  datasetName: string;
  status: 'queued' | 'preprocessing' | 'training' | 'packaging' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  trainLoss?: number;
  valLoss?: number;
  gpuVramGb: number;
  gpuTflops: number;
  estimatedHours: number;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  logs: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface GpuNode {
  id: string;
  name: string;
  type: string;
  utilizationPct: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  temperatureC: number;
  powerWatts: number;
  powerLimitWatts: number;
  smClockMhz: number;
  nvlinkBandwidthGbps?: number;
  status: 'idle' | 'active' | 'hot' | 'offline';
}

export interface ClusterMetrics {
  totalGpus: number;
  activeGpus: number;
  idleGpus: number;
  avgUtilizationPct: number;
  totalMemoryGb: number;
  usedMemoryGb: number;
  totalPowerKw: number;
  efficiencyScore: number;
  nodes: GpuNode[];
}

// ── Medical / EMR ──────────────────────────────────────────────────────────────

export type EmrEntityType =
  | 'diagnosis'
  | 'medication'
  | 'procedure'
  | 'symptom'
  | 'lab_result'
  | 'vital_sign'
  | 'allergy'
  | 'patient_info'
  | 'date'
  | 'provider';

export interface EmrAnnotation {
  id: string;
  start: number;
  end: number;
  text: string;
  entityType: EmrEntityType;
  /** 0–1 AI confidence; undefined = human-created */
  confidence?: number;
  confirmed: boolean;
}

export interface EmrDocument {
  id: string;
  title: string;
  patientId: string;
  documentType:
    | 'admission_note'
    | 'discharge_summary'
    | 'progress_note'
    | 'lab_report'
    | 'radiology'
    | 'prescription'
    | 'other';
  status: 'pending' | 'annotating' | 'review' | 'completed';
  annotationCount: number;
  confirmedCount: number;
  createdAt: string;
}

export interface CaseLabResult {
  name: string;
  value: string;
  flag?: 'high' | 'low' | 'normal';
}

export interface ExtractedCase {
  id: string;
  patientId: string;
  visitDate: string;
  diagnoses: string[];
  medications: string[];
  procedures: string[];
  symptoms: string[];
  labResults: CaseLabResult[];
  extractionStatus: 'ai_extracted' | 'human_reviewed' | 'verified';
  documentId: string;
  createdAt: string;
}
