import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelCatalogService } from './model-catalog.service';
import { ModelCatalogController } from './model-catalog.controller';
import { CatalogUsageStat } from './catalog-stats.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogUsageStat])],
  providers: [ModelCatalogService],
  controllers: [ModelCatalogController],
  exports: [ModelCatalogService],
})
export class ModelCatalogModule {}
