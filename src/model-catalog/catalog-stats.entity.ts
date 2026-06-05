import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('catalog_usage_stats')
export class CatalogUsageStat {
  @PrimaryColumn()
  catalogModelId: string;

  @PrimaryColumn()
  method: string;

  @Column({ default: 0 })
  jobCount: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
