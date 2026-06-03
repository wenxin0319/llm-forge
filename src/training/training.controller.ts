import { Controller, Post, Body, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TrainingService } from './training.service';
import { TrainingConfigDto } from './training.dto';

@ApiTags('training')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post('launch')
  @ApiOperation({ summary: 'Launch a new training job' })
  launch(@Request() req, @Body() config: TrainingConfigDto) {
    return this.trainingService.launch(req.user.id, config);
  }

  @Get('estimate')
  @ApiOperation({ summary: 'Estimate training cost before launching' })
  @ApiQuery({ name: 'recordCount', type: Number, required: true })
  estimate(@Request() req, @Body() config: TrainingConfigDto, @Query('recordCount') recordCount: string) {
    return this.trainingService.estimateCost(config, parseInt(recordCount, 10));
  }
}
