import { Module } from '@nestjs/common';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';
import { JobsModule } from '../jobs/jobs.module';
import { ModelsModule } from '../models/models.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { ModelCatalogModule } from '../model-catalog/model-catalog.module';

@Module({
  imports: [JobsModule, ModelsModule, DatasetsModule, ModelCatalogModule],
  providers: [TrainingService],
  controllers: [TrainingController],
})
export class TrainingModule {}
