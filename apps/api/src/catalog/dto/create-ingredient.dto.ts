import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IngredientType } from '@prisma/client';

export class CreateIngredientDto {
  @IsString()
  name!: string;

  @IsEnum(IngredientType)
  type!: IngredientType;

  @IsNumber()
  @Min(0)
  pricePerKg!: number;

  /** RN01 - massas aeradas (ex.: Pao de Lo) sao bloqueadas em bolos de +2 andares. */
  @IsOptional()
  @IsBoolean()
  isAerated?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];
}
