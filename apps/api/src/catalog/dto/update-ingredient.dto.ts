import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateIngredientDto } from './create-ingredient.dto';

export class UpdateIngredientDto extends PartialType(CreateIngredientDto) {
  /** Permite inativar um item sem excluir (preserva historico de pedidos antigos). */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
