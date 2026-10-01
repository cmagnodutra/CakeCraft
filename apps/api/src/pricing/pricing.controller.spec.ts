import { Test, TestingModule } from '@nestjs/testing';

import { CalculatePriceDto } from './dto/calculate-price.dto';
import { PriceCalculationResult, PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

describe('PricingController', () => {
  let controller: PricingController;

  const pricingServiceMock = {
    calculate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [{ provide: PricingService, useValue: pricingServiceMock }],
    }).compile();

    controller = module.get<PricingController>(PricingController);
  });

  it('delega para PricingService.calculate() com o DTO recebido e devolve o resultado sem transformar', async () => {
    const dto: CalculatePriceDto = {
      floors: [
        {
          floorNumber: 1,
          doughIngredientId: 'massa-1',
          coverageIngredientId: 'cobertura-1',
          fillingIngredientIds: [],
          estimatedWeightKg: 1,
        },
      ],
    };
    const expectedResult: PriceCalculationResult = {
      layers: [{ floorNumber: 1, weightKg: 1, pricePerKgCombined: 50, subtotal: 50 }],
      assemblyBaseFee: 25,
      totalPrice: 75,
    };
    pricingServiceMock.calculate.mockResolvedValue(expectedResult);

    const result = await controller.calculate(dto);

    expect(pricingServiceMock.calculate).toHaveBeenCalledWith(dto);
    expect(result).toBe(expectedResult);
  });
});
