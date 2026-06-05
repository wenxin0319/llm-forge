import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ModelCatalogService } from './model-catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class ModelCatalogController {
  constructor(private readonly catalogService: ModelCatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Browse the open-source model catalog' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'licenseType', required: false, enum: ['apache-2.0', 'mit', 'meta', 'llama4'] })
  @ApiQuery({ name: 'maxParamsB', required: false, type: Number })
  @ApiQuery({ name: 'minParamsB', required: false, type: Number })
  @ApiQuery({ name: 'tags', required: false, type: [String] })
  findAll(
    @Query('search') search?: string,
    @Query('licenseType') licenseType?: string,
    @Query('maxParamsB') maxParamsB?: string,
    @Query('minParamsB') minParamsB?: string,
    @Query('tags') tags?: string | string[],
  ) {
    const tagsArr = tags ? (Array.isArray(tags) ? tags : [tags]) : undefined;
    return this.catalogService.findAll(
      search,
      licenseType,
      maxParamsB ? Number(maxParamsB) : undefined,
      minParamsB ? Number(minParamsB) : undefined,
      tagsArr,
    );
  }

  @Get('usage/stats')
  @ApiOperation({ summary: 'Get model popularity and usage statistics' })
  getUsageStats() {
    return this.catalogService.getUsageStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a specific catalog model' })
  findOne(@Param('id') id: string) {
    return this.catalogService.findOne(id);
  }
}
