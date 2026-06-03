import { Module } from '@nestjs/common';
import { GpuMetricsService } from './gpu-metrics.service';
import { GpuMetricsController } from './gpu-metrics.controller';

@Module({
  providers: [GpuMetricsService],
  controllers: [GpuMetricsController],
  exports: [GpuMetricsService],
})
export class GpuMetricsModule {}
