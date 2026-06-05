import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min, Max, IsArray } from 'class-validator';

export enum BaseModel {
  LLAMA_3_8B = 'llama-3-8b',
  LLAMA_3_70B = 'llama-3-70b',
  MISTRAL_7B = 'mistral-7b',
  PHI_3_MINI = 'phi-3-mini',
  GEMMA_2B = 'gemma-2b',
  GEMMA_7B = 'gemma-7b',
}

export enum QuantizationMode {
  NONE = 'none',
  INT8 = 'int8',
  INT4 = 'int4',
  GPTQ = 'gptq',
  GGUF = 'gguf',
  FP8 = 'fp8',
}

export class CreateModelDto {
  @ApiProperty({ example: 'My Support Bot v1' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: BaseModel })
  @IsEnum(BaseModel)
  baseModel: BaseModel;

  @ApiProperty({ enum: QuantizationMode, default: QuantizationMode.INT4 })
  @IsEnum(QuantizationMode)
  quantization: QuantizationMode;

  @ApiPropertyOptional({ minimum: 512, maximum: 32768, default: 4096 })
  @IsOptional()
  @IsInt()
  @Min(512)
  @Max(32768)
  contextLength?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];
}
