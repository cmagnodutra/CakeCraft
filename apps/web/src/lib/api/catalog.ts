import { apiRequest } from './client';

export type IngredientType = 'MASSA' | 'RECHEIO' | 'COBERTURA';

export interface CatalogIngredient {
  id: string;
  name: string;
  type: IngredientType;
  pricePerKg: number;
  active: boolean;
  isAerated: boolean;
  allergens: string[];
}

export interface CreateIngredientInput {
  name: string;
  type: IngredientType;
  pricePerKg: number;
  isAerated?: boolean;
  allergens?: string[];
}

export interface UpdateIngredientInput extends Partial<CreateIngredientInput> {
  active?: boolean;
}

/** RF02: lista publica de insumos ativos (servida via cache Redis 7). */
export async function fetchPublicCatalog(): Promise<CatalogIngredient[]> {
  return apiRequest<CatalogIngredient[]>('/catalog');
}

/** UC05: lista administrativa completa (ativos + inativos). Exige papel ADMIN. */
export async function fetchAdminCatalog(): Promise<CatalogIngredient[]> {
  return apiRequest<CatalogIngredient[]>('/catalog/admin');
}

/** UC05: cadastra novo insumo e invalida o cache publico no Redis. */
export async function createCatalogIngredient(
  input: CreateIngredientInput,
): Promise<CatalogIngredient> {
  return apiRequest<CatalogIngredient>('/catalog', {
    method: 'POST',
    body: input,
  });
}

/** UC05: edita insumo existente (preco, nome, categoria, alergenicos ou active). */
export async function updateCatalogIngredient(
  id: string,
  input: UpdateIngredientInput,
): Promise<CatalogIngredient> {
  return apiRequest<CatalogIngredient>(`/catalog/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

/** UC05: inativa logicamente sem excluir (preserva historico de pedidos). */
export async function deactivateCatalogIngredient(id: string): Promise<void> {
  await apiRequest(`/catalog/${id}`, {
    method: 'DELETE',
  });
}
