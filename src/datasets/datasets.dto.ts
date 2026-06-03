import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';

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
