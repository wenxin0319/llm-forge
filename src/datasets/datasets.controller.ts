import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Request,
  UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DatasetsService } from './datasets.service';
import { CreateDatasetDto, ImportHuggingFaceDto } from './datasets.dto';

@ApiTags('datasets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('datasets')
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a new dataset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, name: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Request() req,
    @Body() dto: CreateDatasetDto,
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 * 1024 })] }))
    file: Express.Multer.File,
  ) {
    return this.datasetsService.create(req.user.id, dto, file);
  }

  @Post('import-hf')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Import a dataset from a HuggingFace repo ID' })
  importFromHuggingFace(@Request() req, @Body() dto: ImportHuggingFaceDto) {
    return this.datasetsService.importFromHuggingFace(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all datasets for the current user' })
  findAll(@Request() req) {
    return this.datasetsService.findAll(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dataset usage statistics' })
  stats(@Request() req) {
    return this.datasetsService.stats(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single dataset' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.datasetsService.findOne(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a dataset' })
  remove(@Param('id') id: string, @Request() req) {
    this.datasetsService.remove(id, req.user.id);
    return { message: 'Dataset deleted' };
  }
}
