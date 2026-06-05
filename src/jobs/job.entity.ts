import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('training_jobs')
export class TrainingJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column()
  modelId: string;

  @Column()
  modelName: string;

  @Column({ nullable: true })
  baseModelId: string;

  @Column()
  datasetId: string;

  @Column()
  datasetName: string;

  @Column({ type: 'jsonb', default: '{}' })
  config: object;

  @Column({ default: 'queued' })
  status: string;

  @Column({ type: 'float', default: 0 })
  gpuVramGb: number;

  @Column({ type: 'float', default: 0 })
  gpuTflops: number;

  @Column({ type: 'float', default: 0 })
  estimatedHours: number;

  @Column({ type: 'float', default: 0 })
  estimatedCostUsd: number;

  @Column({ type: 'float', nullable: true })
  actualCostUsd: number;

  @Column({ default: 0 })
  progress: number;

  @Column({ default: 0 })
  currentEpoch: number;

  @Column({ default: 3 })
  totalEpochs: number;

  @Column({ type: 'float', nullable: true })
  trainLoss: number;

  @Column({ type: 'float', nullable: true })
  valLoss: number;

  @Column({ type: 'jsonb', default: '[]' })
  metrics: object[];

  @Column({ type: 'jsonb', default: '[]' })
  logs: string[];

  @Column({ type: 'float', nullable: true })
  peakGpuMemGb: number;

  @Column({ type: 'float', nullable: true })
  avgTokensPerSec: number;

  @Column({ nullable: true })
  totalTrainingSec: number;

  @Column({ nullable: true })
  ttftMs: number;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
