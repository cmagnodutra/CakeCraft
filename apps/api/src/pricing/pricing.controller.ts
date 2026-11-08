import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CalculatePriceDto } from './dto/calculate-price.dto';
import { PriceCalculationResult, PricingService } from './pricing.service';

/**
 * Margem ampla para cotacoes em tempo real no Cake Builder (RF03 / RNF01):
 * o cliente experimenta multiplas combinacoes de insumos, andares e porcoes
 * seguidas sem esbarrar no limite global de 60 req/min da API.
 */
export const PRICING_THROTTLE_TTL_MS = 60_000;
export const PRICING_THROTTLE_LIMIT = 300;

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
  @Throttle({ default: { ttl: PRICING_THROTTLE_TTL_MS, limit: PRICING_THROTTLE_LIMIT } })
  @HttpCode(HttpStatus.OK)
  calculate(@Body() dto: CalculatePriceDto): Promise<PriceCalculationResult> {
    return this.pricingService.calculate(dto);
  }
}
