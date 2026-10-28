import {
  createCatalogIngredient,
  deactivateCatalogIngredient,
  fetchAdminCatalog,
  fetchPublicCatalog,
  updateCatalogIngredient,
} from './catalog';
import { apiRequest } from './client';

jest.mock('./client');

const apiRequestMock = jest.mocked(apiRequest);

const chantilly = {
  id: 'ing-1',
  name: 'Chantilly',
  type: 'COBERTURA' as const,
  pricePerKg: 50,
  active: true,
  isAerated: false,
  allergens: ['leite'],
};

beforeEach(() => apiRequestMock.mockReset());

describe('cliente de API do catalogo (RF02 / UC05)', () => {
  it('fetchPublicCatalog faz GET em /catalog', async () => {
    apiRequestMock.mockResolvedValue([chantilly]);

    await expect(fetchPublicCatalog()).resolves.toEqual([chantilly]);
    expect(apiRequestMock).toHaveBeenCalledWith('/catalog');
  });

  it('fetchAdminCatalog faz GET em /catalog/admin', async () => {
    apiRequestMock.mockResolvedValue([chantilly]);

    await expect(fetchAdminCatalog()).resolves.toEqual([chantilly]);
    expect(apiRequestMock).toHaveBeenCalledWith('/catalog/admin');
  });

  it('createCatalogIngredient faz POST em /catalog com o payload tipado', async () => {
    apiRequestMock.mockResolvedValue(chantilly);

    const created = await createCatalogIngredient({
      name: 'Chantilly',
      type: 'COBERTURA',
      pricePerKg: 50,
      isAerated: false,
      allergens: ['leite'],
    });

    expect(apiRequestMock).toHaveBeenCalledWith('/catalog', {
      method: 'POST',
      body: {
        name: 'Chantilly',
        type: 'COBERTURA',
        pricePerKg: 50,
        isAerated: false,
        allergens: ['leite'],
      },
    });
    expect(created).toEqual(chantilly);
  });

  it('updateCatalogIngredient faz PATCH em /catalog/:id', async () => {
    apiRequestMock.mockResolvedValue({ ...chantilly, pricePerKg: 55 });

    const updated = await updateCatalogIngredient('ing-1', { pricePerKg: 55 });

    expect(apiRequestMock).toHaveBeenCalledWith('/catalog/ing-1', {
      method: 'PATCH',
      body: { pricePerKg: 55 },
    });
    expect(updated.pricePerKg).toBe(55);
  });

  it('deactivateCatalogIngredient faz DELETE em /catalog/:id', async () => {
    apiRequestMock.mockResolvedValue(undefined);

    await expect(deactivateCatalogIngredient('ing-1')).resolves.toBeUndefined();
    expect(apiRequestMock).toHaveBeenCalledWith('/catalog/ing-1', {
      method: 'DELETE',
    });
  });
});
