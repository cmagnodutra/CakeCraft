import { Body, Controller, Post } from '@nestjs/common';

import { CalculatePriceDto } from './dto/calculate-price.dto';
import { PriceCalculationResult, PricingService } from './pricing.service';

/**
 * RF03 - calculo de preco em tempo real, consultado pelo Cake Builder a
 * cada alteracao de camada/ingrediente (RNF01: resposta abaixo de 500ms).
 *
 * Rota publica de proposito: o preview de preco no builder precisa
 * funcionar antes do cliente se autenticar (Tela 1 -> "Comecar a Montar"
 * em modo visitante, Secao 4.2 do RFC).
 */
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('calculate')
  calculate(@Body() dto: CalculatePriceDto): Promise<PriceCalculationResult> {
    return this.pricingService.calculate(dto);
  }
}
