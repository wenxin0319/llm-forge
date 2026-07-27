import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { TrainingJob } from './job.entity';
import { ArtifactsModule } from '../artifacts/artifacts.module';
import { TrainingProcessRunner } from './training-process.runner';
import { GpuMetricsModule } from '../gpu-metrics/gpu-metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrainingJob]),
    forwardRef(() => ArtifactsModule),
    GpuMetricsModule,
  ],
  providers: [JobsService, TrainingProcessRunner],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
