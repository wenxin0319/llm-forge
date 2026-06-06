import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray, Matches } from 'class-validator';

export enum DatasetType {
  TEXT = 'text',
  JSONL = 'jsonl',
  CSV = 'csv',
  PARQUET = 'parquet',
}

export class CreateDatasetDto {
  @ApiProperty({ example: 'Customer Support Conversations' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Anonymized support tickets for fine-tuning' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DatasetType })
  @IsEnum(DatasetType)
  type: DatasetType;

  @ApiPropertyOptional({ type: [String], example: ['support', 'customer-service'] })
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class ImportHuggingFaceDto {
  @ApiProperty({ example: 'tatsu-lab/alpaca', description: 'HuggingFace dataset repo ID (owner/dataset-name)' })
  @IsString()
  @Matches(/^[\w.-]+\/[\w.-]+$/, { message: 'repoId must be in the format owner/dataset-name' })
  repoId: string;

  @ApiPropertyOptional({ example: 'Alpaca instruction dataset' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
