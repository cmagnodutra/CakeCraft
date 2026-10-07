import { Test, TestingModule } from '@nestjs/testing';

import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

describe('CatalogController', () => {
  let controller: CatalogController;

  const catalogServiceMock = {
    findAllActive: jest.fn(),
    findAllForAdmin: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: catalogServiceMock }],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
  });

  it('GET / delega para findAllActive()', async () => {
    const ativos = [{ id: 'a', name: 'Chantilly' }];
    catalogServiceMock.findAllActive.mockResolvedValue(ativos);

    const result = await controller.findAllActive();

    expect(catalogServiceMock.findAllActive).toHaveBeenCalled();
    expect(result).toBe(ativos);
  });

  it('GET /admin delega para findAllForAdmin() (inclui itens inativos)', async () => {
    const todos = [{ id: 'a' }, { id: 'b', active: false }];
    catalogServiceMock.findAllForAdmin.mockResolvedValue(todos);

    const result = await controller.findAllForAdmin();

    expect(catalogServiceMock.findAllForAdmin).toHaveBeenCalled();
    expect(result).toBe(todos);
  });

  it('POST / delega para create() com o DTO recebido', async () => {
    const dto: CreateIngredientDto = {
      name: 'Brigadeiro',
      type: 'RECHEIO' as CreateIngredientDto['type'],
      pricePerKg: 25,
    };
    const criado = { id: 'novo', ...dto };
    catalogServiceMock.create.mockResolvedValue(criado);

    const result = await controller.create(dto);

    expect(catalogServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(criado);
  });

  it('PATCH /:id delega para update() com o id da rota e o DTO do corpo', async () => {
    const dto: UpdateIngredientDto = { pricePerKg: 30 };
    const atualizado = { id: 'existente', pricePerKg: 30 };
    catalogServiceMock.update.mockResolvedValue(atualizado);

    const result = await controller.update('existente', dto);

    expect(catalogServiceMock.update).toHaveBeenCalledWith('existente', dto);
    expect(result).toBe(atualizado);
  });

  it('DELETE /:id delega para deactivate() com o id da rota (inativacao logica)', async () => {
    const inativado = { id: 'existente', active: false };
    catalogServiceMock.deactivate.mockResolvedValue(inativado);

    const result = await controller.deactivate('existente');

    expect(catalogServiceMock.deactivate).toHaveBeenCalledWith('existente');
    expect(result).toBe(inativado);
  });
});
