import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { AuthProvider } from '@/features/auth/auth-provider';
import { fetchCurrentUser } from '@/lib/api/auth';
import { fetchPublicCatalog } from '@/lib/api/catalog';
import type { CatalogIngredient } from '@/lib/api/catalog';
import { ApiError, NetworkError } from '@/lib/api/errors';
import {
  calculateCakePrice,
  createOrder,
  uploadRicePaperImage,
} from '@/lib/api/orders';
import type { CustomerOrder } from '@/lib/api/orders';

import { BUILDER_DRAFT_STORAGE_KEY, CakeBuilderView } from './cake-builder-view';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/catalog');
jest.mock('@/lib/api/orders', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/orders')>('@/lib/api/orders');
  return {
    ...actual,
    calculateCakePrice: jest.fn(),
    uploadRicePaperImage: jest.fn(),
    createOrder: jest.fn(),
  };
});

const fetchCurrentUserMock = jest.mocked(fetchCurrentUser);
const fetchPublicCatalogMock = jest.mocked(fetchPublicCatalog);
const calculateCakePriceMock = jest.mocked(calculateCakePrice);
const uploadRicePaperImageMock = jest.mocked(uploadRicePaperImage);
const createOrderMock = jest.mocked(createOrder);

const sampleCatalog: CatalogIngredient[] = [
  {
    id: 'massa-chocolate',
    name: 'Massa de Chocolate Estruturada',
    type: 'MASSA',
    pricePerKg: 38,
    active: true,
    isAerated: false,
    allergens: ['gluten', 'ovos'],
  },
  {
    id: 'massa-pao-de-lo',
    name: 'Pão de Ló Aerado',
    type: 'MASSA',
    pricePerKg: 34,
    active: true,
    isAerated: true,
    allergens: ['gluten', 'ovos'],
  },
  {
    id: 'massa-arroz',
    name: 'Massa de Farinha de Arroz Vegana',
    type: 'MASSA',
    pricePerKg: 46,
    active: true,
    isAerated: false,
    allergens: [],
  },
  {
    id: 'recheio-brigadeiro',
    name: 'Brigadeiro Belga',
    type: 'RECHEIO',
    pricePerKg: 55,
    active: true,
    isAerated: false,
    allergens: ['leite'],
  },
  {
    id: 'recheio-frutas',
    name: 'Redução de Frutas Vermelhas',
    type: 'RECHEIO',
    pricePerKg: 48,
    active: true,
    isAerated: false,
    allergens: [],
  },
  {
    id: 'cob-chantilly',
    name: 'Chantilly Artesanal',
    type: 'COBERTURA',
    pricePerKg: 50,
    active: true,
    isAerated: false,
    allergens: ['leite'],
  },
  {
    id: 'cob-merengue',
    name: 'Glacê Vegetal sem Alergênicos',
    type: 'COBERTURA',
    pricePerKg: 54,
    active: true,
    isAerated: false,
    allergens: [],
  },
];

beforeEach(() => {
  pushMock.mockReset();
  fetchCurrentUserMock.mockReset();
  fetchPublicCatalogMock.mockReset();
  calculateCakePriceMock.mockReset();
  uploadRicePaperImageMock.mockReset();
  createOrderMock.mockReset();
  window.sessionStorage.clear();

  fetchPublicCatalogMock.mockResolvedValue(sampleCatalog);
  calculateCakePriceMock.mockResolvedValue({
    layers: [{ floorNumber: 1, weightKg: 1.5, pricePerKgCombined: 143, subtotal: 214.5 }],
    assemblyBaseFee: 25,
    totalPrice: 239.5,
  });
});

describe('CakeBuilderView (UC01, RF02-RF07, RN01-RN02)', () => {
  it('carrega o catalogo, calcula o orcamento em tempo real (RN02) e preserva rascunho para visitante deslogado', async () => {
    fetchCurrentUserMock.mockRejectedValue(new ApiError(401, ['Unauthorized']));

    render(
      <AuthProvider>
        <CakeBuilderView />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.builder.title }),
    ).toBeInTheDocument();

    expect(await screen.findByText(/R\$\s*239,50/)).toBeInTheDocument();
    expect(screen.getByText(messages.builder.quoteSection.guestNotice)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: messages.builder.quoteSection.loginToCheckout }),
    ).toHaveAttribute('href', '/entrar');

    const stored = window.sessionStorage.getItem(BUILDER_DRAFT_STORAGE_KEY);
    expect(stored).not.toBeNull();
  });

  it('aplica RN01 ao subir para 3 andares substituindo massa aerada por estruturada automaticamente', async () => {
    fetchCurrentUserMock.mockResolvedValue({
      id: 'u1',
      name: 'Mariana',
      email: 'mariana@example.com',
      role: 'CLIENTE',
      xp: 0,
      level: 1,
    });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <CakeBuilderView />
      </AuthProvider>,
    );

    const doughSelect = await screen.findByLabelText<HTMLSelectElement>(
      messages.builder.floorsSection.doughLabel,
    );

    // Em 1 andar, seleciona Pao de Lo Aerado normalmente
    await user.selectOptions(doughSelect, 'massa-pao-de-lo');
    expect(doughSelect.value).toBe('massa-pao-de-lo');

    // Sobe para 3 andares -> RN01 substitui massa aerada e exibe aviso
    const floorsSelect = screen.getByLabelText(messages.builder.structureSection.floorsLabel);
    await user.selectOptions(floorsSelect, '3');

    expect(
      await screen.findByText(messages.builder.floorsSection.aeratedAutoAdjusted),
    ).toBeInTheDocument();

    const allDoughSelects = screen.getAllByLabelText<HTMLSelectElement>(
      messages.builder.floorsSection.doughLabel,
    );
    expect(allDoughSelects).toHaveLength(3);
    expect(allDoughSelects[0]?.value).toBe('massa-chocolate');
  });

  it('detecta conflito de alergenicos (RF06), sugere substituto compativel e bloqueia envio ate corrigir', async () => {
    fetchCurrentUserMock.mockResolvedValue({
      id: 'u1',
      name: 'Mariana',
      email: 'mariana@example.com',
      role: 'CLIENTE',
      xp: 0,
      level: 1,
    });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <CakeBuilderView />
      </AuthProvider>,
    );

    await screen.findByText(/R\$\s*239,50/);
    expect(
      screen.getByText(messages.builder.quoteSection.totalWeightLabel),
    ).toBeInTheDocument();
    expect(screen.getByText(/~15 fatias de 100g/)).toBeInTheDocument();

    // Marca restricao "Sem lactose / leite": Brigadeiro Belga e Chantilly contem 'leite'
    await user.click(screen.getByLabelText(messages.builder.dietarySection.options.lactose));

    expect(
      await screen.findByText(messages.builder.dietarySection.conflictTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sugestão compatível: Redução de Frutas Vermelhas/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sugestão compatível: Glacê Vegetal sem Alergênicos/),
    ).toBeInTheDocument();

    const submitButton = screen.getByRole('button', {
      name: messages.builder.quoteSection.submitOrder,
    });
    expect(submitButton).toBeDisabled();
  });

  it('faz upload de arte de papel de arroz (RF05), cria o pedido (UC01) e redireciona para /meus-pedidos', async () => {
    fetchCurrentUserMock.mockResolvedValue({
      id: 'u1',
      name: 'Mariana',
      email: 'mariana@example.com',
      role: 'CLIENTE',
      xp: 0,
      level: 1,
    });
    uploadRicePaperImageMock.mockResolvedValue({
      url: '/api/uploads/rice-paper/11111111-1111-4111-8111-111111111111.png',
      mimeType: 'image/png',
      sizeBytes: 512,
    });
    createOrderMock.mockResolvedValue({
      id: 'order-abc-123',
      userId: 'u1',
      status: 'AGUARDANDO_PAGAMENTO',
      totalPrice: 239.5,
      toppingMessage: 'Parabéns, Marina!',
      riceImageUrl: '/api/uploads/rice-paper/11111111-1111-4111-8111-111111111111.png',
      deliveryAddress: 'Rua das Flores, 42',
      createdAt: '2026-10-29T21:00:00.000Z',
      updatedAt: '2026-10-29T21:00:00.000Z',
      cakeConfiguration: null,
      items: [],
      payment: null,
    } satisfies CustomerOrder);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <CakeBuilderView />
      </AuthProvider>,
    );

    await screen.findByText(/R\$\s*239,50/);
    expect(
      screen.getByText(messages.builder.quoteSection.totalWeightLabel),
    ).toBeInTheDocument();
    expect(screen.getByText(/~15 fatias de 100g/)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(messages.builder.personalizationSection.toppingMessageLabel),
      'Parabéns, Marina!',
    );
    await user.type(
      screen.getByLabelText(messages.builder.personalizationSection.deliveryAddressLabel),
      'Rua das Flores, 42',
    );

    const fileInput = screen.getByLabelText(messages.builder.personalizationSection.ricePaperLabel);
    const pngFile = new File(['png-bytes'], 'topo.png', { type: 'image/png' });
    await user.upload(fileInput, pngFile);

    expect(
      await screen.findByText(messages.builder.personalizationSection.ricePaperUploaded),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: messages.builder.quoteSection.submitOrder }),
    );

    await waitFor(() => {
      expect(createOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'REDONDO',
          toppingMessage: 'Parabéns, Marina!',
          deliveryAddress: 'Rua das Flores, 42',
          riceImageUrl: '/api/uploads/rice-paper/11111111-1111-4111-8111-111111111111.png',
        }),
      );
    });
    expect(window.sessionStorage.getItem(BUILDER_DRAFT_STORAGE_KEY)).toBeNull();
    expect(pushMock).toHaveBeenCalledWith('/meus-pedidos?novo=order-abc-123');
  });

  it('exibe mensagens claras em falhas de rede no catalogo, upload recusado e erro ao criar pedido', async () => {
    fetchCurrentUserMock.mockResolvedValue({
      id: 'u1',
      name: 'Mariana',
      email: 'mariana@example.com',
      role: 'CLIENTE',
      xp: 0,
      level: 1,
    });
    fetchPublicCatalogMock.mockRejectedValueOnce(new NetworkError());

    const { unmount } = render(
      <AuthProvider>
        <CakeBuilderView />
      </AuthProvider>,
    );

    expect(await screen.findByText(messages.builder.errors.network)).toBeInTheDocument();
    unmount();

    // Agora com catalogo valido, testa falha de upload e falha de criacao de pedido
    fetchPublicCatalogMock.mockResolvedValue(sampleCatalog);
    uploadRicePaperImageMock.mockRejectedValueOnce(new ApiError(400, ['Invalid magic bytes']));
    createOrderMock.mockRejectedValueOnce(new ApiError(422, ['Conflict']));
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <CakeBuilderView />
      </AuthProvider>,
    );

    await screen.findByText(/R\$\s*239,50/);
    expect(
      screen.getByText(messages.builder.quoteSection.totalWeightLabel),
    ).toBeInTheDocument();
    expect(screen.getByText(/~15 fatias de 100g/)).toBeInTheDocument();

    const fileInput = screen.getByLabelText(messages.builder.personalizationSection.ricePaperLabel);
    await user.upload(fileInput, new File(['bad'], 'fake.png', { type: 'image/png' }));
    expect(await screen.findByText(messages.builder.errors.uploadFailed)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: messages.builder.quoteSection.submitOrder }),
    );
    expect(await screen.findByText(messages.builder.errors.orderFailed)).toBeInTheDocument();
  });
});
