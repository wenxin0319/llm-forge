import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('artifacts')
export class Artifact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column()
  jobId: string;

  @Column()
  modelName: string;

  @Column()
  baseModelId: string;

  @Column()
  format: string;

  @Column({ default: 'ready' })
  status: 'ready' | 'quantizing' | 'error';

  @Column({ type: 'float', default: 0 })
  fileSizeGb: number;

  @Column({ nullable: true })
  quantBits: number;

  @Column({ nullable: true })
  downloadUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
