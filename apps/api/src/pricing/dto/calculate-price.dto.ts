import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** Um andar do bolo, conforme montado no Cake Builder (RF02). */
export class CakeLayerInputDto {
  @IsInt()
  @Min(1)
  floorNumber!: number;

  @IsString()
  doughIngredientId!: string;

  /** Cobertura escolhida para este andar (Chantilly, Pasta Americana etc.). */
  @IsString()
  coverageIngredientId!: string;

  /** No maximo 2 recheios por andar (UC01/Tela 2). */
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  fillingIngredientIds!: string[];

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  estimatedWeightKg!: number;
}

export class CalculatePriceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CakeLayerInputDto)
  floors!: CakeLayerInputDto[];
}
