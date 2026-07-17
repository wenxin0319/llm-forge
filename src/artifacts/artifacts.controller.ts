import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ArtifactsService } from './artifacts.service';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class QuantizeDto {
  @ApiProperty({ enum: ['gguf', 'gptq', 'awq'] })
  @IsEnum(['gguf', 'gptq', 'awq'])
  format: 'gguf' | 'gptq' | 'awq';
}

@ApiTags('artifacts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('artifacts')
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Get()
  @ApiOperation({ summary: 'List all model artifacts' })
  @ApiQuery({ name: 'jobId', required: false })
  findAll(@Request() req, @Query('jobId') jobId?: string) {
    return this.artifactsService.findAll(req.user.id, jobId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get artifact details and download URL' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.artifactsService.findOne(id, req.user.id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download an authenticated local artifact' })
  async download(
    @Param('id') id: string,
    @Request() req,
    @Res() response: Response,
  ) {
    const file = await this.artifactsService.getDownload(id, req.user.id);
    return response.download(file.path, file.filename);
  }

  @Post(':id/quantize')
  @ApiOperation({
    summary: 'Trigger quantization of a merged artifact (GGUF/GPTQ/AWQ)',
  })
  quantize(@Param('id') id: string, @Body() dto: QuantizeDto, @Request() req) {
    return this.artifactsService.scheduleQuantization(
      id,
      req.user.id,
      dto.format,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an artifact' })
  remove(@Param('id') id: string, @Request() req) {
    this.artifactsService.remove(id, req.user.id);
    return { message: 'Artifact deleted' };
  }
}
