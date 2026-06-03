import { Module } from '@nestjs/common';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';
import { JobsModule } from '../jobs/jobs.module';
import { ModelsModule } from '../models/models.module';
import { DatasetsModule } from '../datasets/datasets.module';

@Module({
  imports: [JobsModule, ModelsModule, DatasetsModule],
  providers: [TrainingService],
  controllers: [TrainingController],
})
export class TrainingModule {}
