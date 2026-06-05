import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('datasets')
export class Dataset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  type: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ default: 'processing' })
  status: 'uploading' | 'processing' | 'ready' | 'error';

  @Column({ type: 'bigint', default: 0 })
  fileSize: number;

  @Column({ default: 0 })
  recordCount: number;

  @Column({ default: '' })
  filePath: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
