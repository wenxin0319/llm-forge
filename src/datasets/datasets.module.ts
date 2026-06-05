import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { DatasetsService } from './datasets.service';
import { DatasetsController } from './datasets.controller';
import { Dataset } from './dataset.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dataset]),
    MulterModule.register({ dest: './uploads' }),
  ],
  providers: [DatasetsService],
  controllers: [DatasetsController],
  exports: [DatasetsService],
})
export class DatasetsModule {}
