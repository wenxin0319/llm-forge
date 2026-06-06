import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsNumber, IsOptional, IsEnum, Min, Max } from 'class-validator';

export enum TrainingMethod {
  FULL_FINE_TUNE = 'full_fine_tune',
  LORA = 'lora',
  QLORA = 'qlora',
  PREFIX_TUNING = 'prefix_tuning',
}

export enum GpuType {
  A100_40GB = 'a100-40gb',
  A100_80GB = 'a100-80gb',
  H100_80GB = 'h100-80gb',
  RTX_4090 = 'rtx-4090',
}

export class TrainingConfigDto {
  @ApiProperty({ example: 'model-id-here' })
  @IsString()
  modelId: string;

  @ApiProperty({ example: 'dataset-id-here' })
  @IsString()
  datasetId: string;

  @ApiProperty({ enum: TrainingMethod, default: TrainingMethod.QLORA })
  @IsEnum(TrainingMethod)
  method: TrainingMethod;

  @ApiProperty({ enum: GpuType, default: GpuType.A100_80GB })
  @IsEnum(GpuType)
  gpuType: GpuType;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 16 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  gpuCount?: number;

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  epochs?: number;

  @ApiPropertyOptional({ default: 2e-4 })
  @IsOptional()
  @IsNumber()
  learningRate?: number;

  @ApiPropertyOptional({ default: 8, minimum: 1, maximum: 256 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(256)
  batchSize?: number;

  @ApiPropertyOptional({ description: 'LoRA rank — lower = fewer params', default: 16 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(256)
  loraRank?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  useFlashAttention?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  useGradientCheckpointing?: boolean;

  @ApiPropertyOptional({ description: 'Compression mode for distill/prune jobs', example: 'quantize' })
  @IsOptional()
  @IsString()
  compressionMethod?: string;

  @ApiPropertyOptional({ description: 'Compression target (e.g. int8, 30, half-layers)', example: 'int8' })
  @IsOptional()
  @IsString()
  compressionTarget?: string;

  @ApiPropertyOptional({ description: 'Output format (gguf, gptq, fp8, merged)', example: 'gguf' })
  @IsOptional()
  @IsString()
  outputFormat?: string;
}
