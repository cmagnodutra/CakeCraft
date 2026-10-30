import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { AuthProvider } from '@/features/auth/auth-provider';
import { fetchCurrentUser } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';
import {
  cancelOrder,
  fetchMyOrders,
  regenerateOrderPix,
} from '@/lib/api/orders';
import type { CustomerOrder } from '@/lib/api/orders';

import { MyOrdersView } from './my-orders-view';

let mockNovoParam: string | null = null;

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'novo' ? mockNovoParam : null),
  }),
}));

jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/orders', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/orders')>('@/lib/api/orders');
  return {
    ...actual,
    fetchMyOrders: jest.fn(),
    cancelOrder: jest.fn(),
    regenerateOrderPix: jest.fn(),
  };
});

const fetchCurrentUserMock = jest.mocked(fetchCurrentUser);
const fetchMyOrdersMock = jest.mocked(fetchMyOrders);
const cancelOrderMock = jest.mocked(cancelOrder);
const regenerateOrderPixMock = jest.mocked(regenerateOrderPix);

const authenticatedCustomer = {
  id: 'u1',
  name: 'Mariana Silva',
  email: 'mariana@example.com',
  role: 'CLIENTE' as const,
  xp: 200,
  level: 1,
};

function makeSampleOrder(overrides: Partial<CustomerOrder> = {}): CustomerOrder {
  return {
    id: 'abcdef12-3456-4789-8000-111111111111',
    userId: 'u1',
    status: 'AGUARDANDO_PAGAMENTO',
    totalPrice: 239.5,
    toppingMessage: 'Parabéns, Marina!',
    riceImageUrl: '/api/uploads/rice-paper/11111111-1111-4111-8111-111111111111.png',
    deliveryAddress: 'Rua das Palmeiras, 100',
    createdAt: '2026-10-29T20:00:00.000Z',
    updatedAt: '2026-10-29T20:00:00.000Z',
    cakeConfiguration: {
      id: 'cfg-1',
      format: 'REDONDO',
      floorsCount: 2,
      colorHex: '#E8B4B8',
      dietaryFlags: ['lactose'],
      layers: [],
    },
    items: [
      {
        id: 'item-1',
        ingredientId: 'ing-1',
        ingredientNameSnapshot: 'Massa de Chocolate Estruturada',
        pricePerKgSnapshot: 38,
        weightKg: 1.5,
        subtotal: 57,
      },
    ],
    payment: {
      id: 'pay-1',
      gatewayProvider: 'ASAAS',
      gatewayReference: 'pay_asaas_1',
      qrCode: 'data:image/png;base64,AAAA',
      copyPasteCode: '00020126580014br.gov.bcb.pix0136asaas-sandbox',
      status: 'PENDENTE',
      expiresAt: '2026-10-29T20:15:00.000Z',
      paidAt: null,
      refundedAt: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  mockNovoParam = null;
  fetchCurrentUserMock.mockReset();
  fetchMyOrdersMock.mockReset();
  cancelOrderMock.mockReset();
  regenerateOrderPixMock.mockReset();
});

describe('MyOrdersView (/meus-pedidos)', () => {
  it('orienta visitante deslogado a entrar na conta', async () => {
    fetchCurrentUserMock.mockRejectedValue(new ApiError(401, ['Unauthorized']));

    render(
      <AuthProvider>
        <MyOrdersView />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: messages.myOrders.unauthenticatedTitle,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages.myOrders.goToLogin })).toHaveAttribute(
      'href',
      '/entrar',
    );
  });

  it('exibe estado vazio com atalho para /builder quando o cliente nao possui pedidos', async () => {
    fetchCurrentUserMock.mockResolvedValue(authenticatedCustomer);
    fetchMyOrdersMock.mockResolvedValue([]);

    render(
      <AuthProvider>
        <MyOrdersView />
      </AuthProvider>,
    );

    expect(await screen.findByText(messages.myOrders.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages.myOrders.goToBuilder })).toHaveAttribute(
      'href',
      '/builder',
    );
  });

  it('exibe QR Code PIX, permite copiar o codigo Copia e Cola e permite cancelar pedido pendente', async () => {
    const order = makeSampleOrder();
    mockNovoParam = order.id;
    fetchCurrentUserMock.mockResolvedValue(authenticatedCustomer);
    fetchMyOrdersMock.mockResolvedValue([order]);
    cancelOrderMock.mockResolvedValue({
      ...order,
      status: 'CANCELADO',
      payment: order.payment ? { ...order.payment, status: 'EXPIRADO' } : null,
    });

    const user = userEvent.setup();
    const writeTextSpy = jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <MyOrdersView />
      </AuthProvider>,
    );

    expect(await screen.findByText(messages.myOrders.createdBanner)).toBeInTheDocument();
    expect(screen.getByText('Pedido #abcdef12')).toBeInTheDocument();
    expect(screen.getByAltText(messages.myOrders.pix.qrAlt('abcdef12'))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.myOrders.pix.copyButton }));
    expect(writeTextSpy).toHaveBeenCalledWith('00020126580014br.gov.bcb.pix0136asaas-sandbox');
    expect(await screen.findByText(messages.myOrders.pix.copiedFeedback)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: messages.myOrders.actions.cancelOrder }),
    );
    await waitFor(() => expect(cancelOrderMock).toHaveBeenCalledWith(order.id));
    expect(
      await screen.findByText(messages.myOrders.actions.cancelledFeedback),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.myOrders.status.CANCELADO)).toBeInTheDocument();
  });

  it('permite regenerar um novo QR Code PIX quando o pagamento de 15 minutos expirou (Secao 3.2)', async () => {
    const expiredOrder = makeSampleOrder({
      payment: {
        id: 'pay-exp',
        gatewayProvider: 'ASAAS',
        gatewayReference: 'pay_old',
        qrCode: null,
        copyPasteCode: null,
        status: 'EXPIRADO',
        expiresAt: '2026-10-29T19:00:00.000Z',
        paidAt: null,
        refundedAt: null,
      },
    });

    fetchCurrentUserMock.mockResolvedValue(authenticatedCustomer);
    fetchMyOrdersMock.mockResolvedValue([expiredOrder]);
    regenerateOrderPixMock.mockResolvedValue(
      makeSampleOrder({
        payment: {
          id: 'pay-exp',
          gatewayProvider: 'ASAAS',
          gatewayReference: 'pay_new',
          qrCode: 'RAWBASE64PNG',
          copyPasteCode: '000201NEWPIX',
          status: 'PENDENTE',
          expiresAt: '2026-10-29T21:30:00.000Z',
          paidAt: null,
          refundedAt: null,
        },
      }),
    );

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MyOrdersView />
      </AuthProvider>,
    );

    expect(await screen.findByText(messages.myOrders.pix.expiredNotice)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: messages.myOrders.pix.regenerateButton }),
    );

    await waitFor(() => expect(regenerateOrderPixMock).toHaveBeenCalledWith(expiredOrder.id));
    expect(
      await screen.findByText(messages.myOrders.pix.regeneratedFeedback),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('000201NEWPIX')).toBeInTheDocument();
  });

  it('trata falhas de rede ao carregar pedidos', async () => {
    fetchCurrentUserMock.mockResolvedValue(authenticatedCustomer);
    fetchMyOrdersMock.mockRejectedValue(new NetworkError());

    render(
      <AuthProvider>
        <MyOrdersView />
      </AuthProvider>,
    );

    expect(await screen.findByText(messages.myOrders.errors.network)).toBeInTheDocument();
  });
});
