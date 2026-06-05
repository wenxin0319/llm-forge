import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('llm_models')
export class LlmModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  baseModel: string;

  @Column()
  quantization: string;

  @Column({ default: 4096 })
  contextLength: number;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ default: 'draft' })
  status: 'draft' | 'training' | 'ready' | 'deployed' | 'failed';

  @Column({ default: '' })
  parameterCount: string;

  @Column({ type: 'float', default: 0 })
  estimatedSizeGb: number;

  @Column({ nullable: true })
  trainingJobId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
