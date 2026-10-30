import { CakeFormat } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CakeLayerInputDto } from '../../pricing/dto/calculate-price.dto';

export class CreateOrderDto {
  @IsEnum(CakeFormat)
  format!: CakeFormat;

  /** RF04 - paleta de cor HEX aplicada sobre a cobertura. */
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'colorHex deve estar no formato hexadecimal #RRGGBB.',
  })
  colorHex!: string;

  /** RF02 - estrutura modular de 1 a 4 andares. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CakeLayerInputDto)
  floors!: CakeLayerInputDto[];

  /** RF06 - flags de restricao alimentar declaradas pelo cliente. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryFlags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  toppingMessage?: string;

  /**
   * RF05 - aceita exclusivamente URLs internas geradas por POST /api/uploads/rice-paper,
   * bloqueando SSRF ou injecao de URLs externas arbitrarias.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\/api\/uploads\/rice-paper\/[0-9a-f-]{36}\.(png|jpg|webp)$/, {
    message: 'riceImageUrl deve apontar para um upload valido de papel de arroz.',
  })
  riceImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryAddress?: string;
}
