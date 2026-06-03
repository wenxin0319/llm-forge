import { Module } from '@nestjs/common';
import { ModelCatalogService } from './model-catalog.service';
import { ModelCatalogController } from './model-catalog.controller';

@Module({
  providers: [ModelCatalogService],
  controllers: [ModelCatalogController],
  exports: [ModelCatalogService],
})
export class ModelCatalogModule {}
