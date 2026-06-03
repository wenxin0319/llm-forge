import { Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'List all training jobs' })
  findAll(@Request() req) {
    return this.jobsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job details and logs' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.jobsService.findOne(id, req.user.id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a running job' })
  cancel(@Param('id') id: string, @Request() req) {
    return this.jobsService.cancel(id, req.user.id);
  }
}
