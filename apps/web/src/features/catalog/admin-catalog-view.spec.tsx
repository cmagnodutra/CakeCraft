import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { AuthProvider } from '@/features/auth/auth-provider';
import { fetchCurrentUser } from '@/lib/api/auth';
import type { AuthUser } from '@/lib/api/auth';
import {
  createCatalogIngredient,
  deactivateCatalogIngredient,
  fetchAdminCatalog,
  updateCatalogIngredient,
} from '@/lib/api/catalog';
import type { CatalogIngredient } from '@/lib/api/catalog';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { AdminCatalogView } from './admin-catalog-view';

jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/catalog');

const fetchCurrentUserMock = jest.mocked(fetchCurrentUser);
const fetchAdminCatalogMock = jest.mocked(fetchAdminCatalog);
const createMock = jest.mocked(createCatalogIngredient);
const updateMock = jest.mocked(updateCatalogIngredient);
const deactivateMock = jest.mocked(deactivateCatalogIngredient);

const texts = messages.adminCatalog;

const adminUser: AuthUser = {
  id: 'admin-1',
  name: 'Juliana Admin',
  email: 'admin@cakecraft.com.br',
  role: 'ADMIN',
  xp: 0,
  level: 1,
};

const clientUser: AuthUser = {
  id: 'client-1',
  name: 'Mariana Cliente',
  email: 'mariana@example.com',
  role: 'CLIENTE',
  xp: 100,
  level: 1,
};

const initialCatalog: CatalogIngredient[] = [
  {
    id: 'ing-massa',
    name: 'Pão de Ló Tradicional',
    type: 'MASSA',
    pricePerKg: 35,
    active: true,
    isAerated: true,
    allergens: ['gluten', 'ovos'],
  },
  {
    id: 'ing-recheio',
    name: 'Brigadeiro Antigo',
    type: 'RECHEIO',
    pricePerKg: 40,
    active: false,
    isAerated: false,
    allergens: ['leite'],
  },
];

beforeEach(() => {
  fetchCurrentUserMock.mockReset();
  fetchAdminCatalogMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  deactivateMock.mockReset();
});

describe('AdminCatalogView (/admin/catalogo - UC05)', () => {
  it('bloqueia visitante sem sessao e aponta para /entrar sem chamar GET /catalog/admin', async () => {
    fetchCurrentUserMock.mockResolvedValue(null);

    render(
      <AuthProvider>
        <AdminCatalogView />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: texts.unauthenticatedTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: texts.goToLogin })).toHaveAttribute('href', '/entrar');
    expect(fetchAdminCatalogMock).not.toHaveBeenCalled();
  });

  it('bloqueia usuario CLIENTE com aviso de permissao insuficiente sem chamar GET /catalog/admin', async () => {
    fetchCurrentUserMock.mockResolvedValue(clientUser);

    render(
      <AuthProvider>
        <AdminCatalogView />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: texts.forbiddenTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: texts.backHome })).toHaveAttribute('href', '/');
    expect(fetchAdminCatalogMock).not.toHaveBeenCalled();
  });

  it('lista insumos ativos e inativos para ADMIN e filtra por categoria', async () => {
    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchAdminCatalogMock.mockResolvedValue(initialCatalog);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AdminCatalogView />
      </AuthProvider>,
    );

    expect(await screen.findByText('Pão de Ló Tradicional')).toBeInTheDocument();
    expect(screen.getByText('Brigadeiro Antigo')).toBeInTheDocument();
    expect(screen.getByText(texts.badges.aerated)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: texts.filters.COBERTURA }));
    expect(screen.getByText(texts.emptyMessage)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: texts.filters.RECHEIO }));
    expect(screen.getByText('Brigadeiro Antigo')).toBeInTheDocument();
    expect(screen.queryByText('Pão de Ló Tradicional')).not.toBeInTheDocument();
  });

  it('valida formulario e cadastra novo insumo convertendo alergenicos separados por virgula', async () => {
    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchAdminCatalogMock.mockResolvedValue(initialCatalog);
    createMock.mockResolvedValue({
      id: 'ing-novo',
      name: 'Ganache Belga',
      type: 'COBERTURA',
      pricePerKg: 68.5,
      active: true,
      isAerated: false,
      allergens: ['leite', 'soja'],
    });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AdminCatalogView />
      </AuthProvider>,
    );

    await screen.findByText('Pão de Ló Tradicional');
    await user.click(screen.getByRole('button', { name: texts.actions.newIngredient }));

    // Submete invalido primeiro.
    await user.click(screen.getByRole('button', { name: texts.actions.saveNew }));
    expect(screen.getByText(texts.validation.name)).toBeInTheDocument();
    expect(screen.getByText(texts.validation.pricePerKg)).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(texts.form.nameLabel), '  Ganache Belga ');
    await user.selectOptions(screen.getByLabelText(texts.form.typeLabel), 'COBERTURA');
    await user.type(screen.getByLabelText(texts.form.pricePerKgLabel), '68.50');
    await user.type(screen.getByLabelText(texts.form.allergensLabel), ' leite , soja ');
    await user.click(screen.getByRole('button', { name: texts.actions.saveNew }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        name: 'Ganache Belga',
        type: 'COBERTURA',
        pricePerKg: 68.5,
        isAerated: false,
        allergens: ['leite', 'soja'],
      }),
    );
    expect(await screen.findByText('Ganache Belga')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(texts.feedback.created('Ganache Belga'));
  });

  it('permite editar preco/alergenicos, inativar item ativo (DELETE) e reativar item inativo (PATCH)', async () => {
    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchAdminCatalogMock.mockResolvedValue(initialCatalog);
    updateMock
      .mockResolvedValueOnce({ ...initialCatalog[0], pricePerKg: 39.9 })
      .mockResolvedValueOnce({ ...initialCatalog[1], active: true });
    deactivateMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AdminCatalogView />
      </AuthProvider>,
    );

    const massaItem = (await screen.findByText('Pão de Ló Tradicional')).closest('li')!;
    await user.click(within(massaItem).getByRole('button', { name: texts.actions.edit }));

    const priceField = screen.getByLabelText(texts.form.pricePerKgLabel);
    await user.clear(priceField);
    await user.type(priceField, '39.90');
    await user.click(screen.getByRole('button', { name: texts.actions.saveEdit }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('ing-massa', {
        name: 'Pão de Ló Tradicional',
        type: 'MASSA',
        pricePerKg: 39.9,
        isAerated: true,
        allergens: ['gluten', 'ovos'],
      }),
    );

    // Inativa o item ativo via DELETE.
    const updatedMassaItem = screen.getByText('Pão de Ló Tradicional').closest('li')!;
    await user.click(
      within(updatedMassaItem).getByRole('button', { name: texts.actions.deactivate }),
    );
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith('ing-massa'));

    // Reativa o item inativo via PATCH { active: true }.
    const recheioItem = screen.getByText('Brigadeiro Antigo').closest('li')!;
    await user.click(within(recheioItem).getByRole('button', { name: texts.actions.reactivate }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('ing-recheio', { active: true }));
  });

  it.each([
    [new NetworkError(), texts.errors.network],
    [new ApiError(500, ['Internal Server Error']), texts.errors.loadFailed],
  ])('mostra alerta amigavel em pt-BR se a carga do catalogo falhar (%#)', async (err, expected) => {
    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchAdminCatalogMock.mockRejectedValueOnce(err);

    render(
      <AuthProvider>
        <AdminCatalogView />
      </AuthProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });
});
