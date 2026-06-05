import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DatasetsModule } from './datasets/datasets.module';
import { ModelsModule } from './models/models.module';
import { TrainingModule } from './training/training.module';
import { JobsModule } from './jobs/jobs.module';
import { GpuMetricsModule } from './gpu-metrics/gpu-metrics.module';
import { ModelCatalogModule } from './model-catalog/model-catalog.module';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { AdminModule } from './admin/admin.module';
import { User } from './users/user.entity';
import { Dataset } from './datasets/dataset.entity';
import { LlmModel } from './models/model.entity';
import { TrainingJob } from './jobs/job.entity';
import { Artifact } from './artifacts/artifact.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      // Fallback for local dev without DATABASE_URL
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'llmforge',
      entities: [User, Dataset, LlmModel, TrainingJob, Artifact],
      synchronize: true, // auto-creates tables — use migrations in production
      // Only enable SSL for remote databases (Railway/cloud), never for localhost
      ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : false,
      logging: process.env.NODE_ENV === 'development',
    }),

    AuthModule,
    UsersModule,
    DatasetsModule,
    ModelsModule,
    TrainingModule,
    JobsModule,
    GpuMetricsModule,
    ModelCatalogModule,
    ArtifactsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
