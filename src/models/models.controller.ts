import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ModelsService } from './models.service';
import { CreateModelDto } from './models.dto';

@ApiTags('models')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new model configuration' })
  create(@Request() req, @Body() dto: CreateModelDto) {
    return this.modelsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all models' })
  findAll(@Request() req) {
    return this.modelsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single model' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.modelsService.findOne(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a model' })
  remove(@Param('id') id: string, @Request() req) {
    this.modelsService.remove(id, req.user.id);
    return { message: 'Model deleted' };
  }
}
