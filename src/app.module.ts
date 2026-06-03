import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DatasetsModule } from './datasets/datasets.module';
import { ModelsModule } from './models/models.module';
import { TrainingModule } from './training/training.module';
import { JobsModule } from './jobs/jobs.module';
import { GpuMetricsModule } from './gpu-metrics/gpu-metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    DatasetsModule,
    ModelsModule,
    TrainingModule,
    JobsModule,
    GpuMetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
