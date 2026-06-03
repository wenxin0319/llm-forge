import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GpuMetricsService } from './gpu-metrics.service';

@ApiTags('gpu-metrics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('gpu-metrics')
export class GpuMetricsController {
  constructor(private readonly gpuMetricsService: GpuMetricsService) {}

  @Get('cluster')
  @ApiOperation({ summary: 'Get full cluster GPU metrics' })
  cluster() {
    return this.gpuMetricsService.getClusterMetrics();
  }

  @Get('node/:id')
  @ApiOperation({ summary: 'Get metrics for a specific GPU node' })
  node(@Param('id') id: string) {
    return this.gpuMetricsService.getNodeById(id);
  }
}
