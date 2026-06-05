import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column()
  passwordHash: string;

  @Column({ default: 'user' })
  role: 'user' | 'admin';

  @Column({ default: 'free' })
  plan: 'free' | 'pro' | 'enterprise';

  @Column({ type: 'float', default: 10 })
  gpuQuotaHours: number;

  @Column({ type: 'float', default: 0 })
  usedGpuHours: number;

  @CreateDateColumn()
  createdAt: Date;
}
