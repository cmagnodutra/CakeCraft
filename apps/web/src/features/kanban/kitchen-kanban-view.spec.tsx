import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { AuthProvider } from '@/features/auth/auth-provider';
import { fetchCurrentUser } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';
import {
  fetchKanbanOrders,
  updateKanbanOrderStatus,
} from '@/lib/api/kanban-reports';
import type { KanbanOrderCard } from '@/lib/api/kanban-reports';
import { cancelOrder } from '@/lib/api/orders';
import type { OrderRealtimeEvent } from '@/lib/realtime/orders-socket';
import { subscribeToOrderUpdates } from '@/lib/realtime/orders-socket';

import { KitchenKanbanView } from './kitchen-kanban-view';

jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/kanban-reports');
jest.mock('@/lib/api/orders', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/orders')>('@/lib/api/orders');
  return {
    ...actual,
    cancelOrder: jest.fn(),
  };
});
jest.mock('@/lib/realtime/orders-socket');

const fetchCurrentUserMock = jest.mocked(fetchCurrentUser);
const fetchKanbanOrdersMock = jest.mocked(fetchKanbanOrders);
const updateKanbanOrderStatusMock = jest.mocked(updateKanbanOrderStatus);
const cancelOrderMock = jest.mocked(cancelOrder);
const subscribeToOrderUpdatesMock = jest.mocked(subscribeToOrderUpdates);

const adminUser = {
  id: 'adm-1',
  name: 'Chef Roberto',
  email: 'admin@cakecraft.com.br',
  role: 'ADMIN' as const,
  xp: 0,
  level: 1,
};

function makeCard(overrides: Partial<KanbanOrderCard> = {}): KanbanOrderCard {
  return {
    id: '12345678-aaaa-4bbb-8ccc-111111111111',
    userId: 'cust-1',
    customerName: 'Mariana Silva',
    status: 'EM_ESPERA',
    totalPrice: 250,
    toppingMessage: 'Parabéns!',
    riceImageUrl: '/api/uploads/rice-paper/11111111-1111-4111-8111-111111111111.png',
    deliveryAddress: 'Rua das Flores, 42',
    paidAt: '2026-10-29T19:00:00.000Z',
    createdAt: '2026-10-29T18:55:00.000Z',
    updatedAt: '2026-10-29T19:00:00.000Z',
    cakeConfiguration: {
      id: 'cfg-1',
      format: 'REDONDO',
      floorsCount: 1,
      colorHex: '#E8B4B8',
      dietaryFlags: ['lactose'],
      layers: [
        {
          id: 'l-1',
          floorNumber: 1,
          estimatedWeightKg: 1.5,
          doughName: 'Massa de Chocolate',
          coverageName: 'Glacê Vegetal',
          fillingNames: ['Geleia de Frutas'],
        },
      ],
    },
    items: [],
    ...overrides,
  };
}

let socketCallback: ((event: OrderRealtimeEvent) => void) | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  socketCallback = undefined;
  subscribeToOrderUpdatesMock.mockImplementation((cb) => {
    socketCallback = cb;
    return () => undefined;
  });
});

describe('KitchenKanbanView (/admin/producao - UC04, RF08)', () => {
  it('bloqueia visitantes e clientes sem papel ADMIN', async () => {
    fetchCurrentUserMock.mockRejectedValueOnce(new ApiError(401, ['Unauthorized']));
    const { unmount } = render(
      <AuthProvider>
        <KitchenKanbanView />
      </AuthProvider>,
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: messages.adminKanban.unauthenticatedTitle,
      }),
    ).toBeInTheDocument();
    expect(fetchKanbanOrdersMock).not.toHaveBeenCalled();
    unmount();

    fetchCurrentUserMock.mockResolvedValueOnce({
      ...adminUser,
      role: 'CLIENTE',
    });
    render(
      <AuthProvider>
        <KitchenKanbanView />
      </AuthProvider>,
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: messages.adminKanban.forbiddenTitle,
      }),
    ).toBeInTheDocument();
    expect(fetchKanbanOrdersMock).not.toHaveBeenCalled();
  });

  it('exibe colunas, alertas de alergenicos, avanca etapas ate PRONTO -> ENTREGUE e sincroniza via WebSocket', async () => {
    const initialCard = makeCard({ status: 'EM_ESPERA' });
    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchKanbanOrdersMock.mockResolvedValue([initialCard]);

    updateKanbanOrderStatusMock
      .mockResolvedValueOnce(makeCard({ status: 'EM_PRODUCAO' }))
      .mockResolvedValueOnce(makeCard({ status: 'FINALIZACAO' }))
      .mockResolvedValueOnce(makeCard({ status: 'PRONTO' }))
      .mockResolvedValueOnce(makeCard({ status: 'ENTREGUE' }));

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <KitchenKanbanView />
      </AuthProvider>,
    );

    expect(await screen.findByText('#12345678')).toBeInTheDocument();
    expect(screen.getByText(/lactose/i)).toBeInTheDocument();
    expect(screen.getByText(/Massa de Chocolate/)).toBeInTheDocument();

    // EM_ESPERA -> EM_PRODUCAO
    await user.click(
      screen.getByRole('button', { name: messages.adminKanban.actions.startProduction }),
    );
    await waitFor(() =>
      expect(updateKanbanOrderStatusMock).toHaveBeenCalledWith(initialCard.id, 'EM_PRODUCAO'),
    );

    // EM_PRODUCAO -> FINALIZACAO
    await user.click(
      screen.getByRole('button', { name: messages.adminKanban.actions.moveToFinishing }),
    );
    await waitFor(() =>
      expect(updateKanbanOrderStatusMock).toHaveBeenCalledWith(initialCard.id, 'FINALIZACAO'),
    );

    // FINALIZACAO -> PRONTO (dispara XP e notificacao)
    await user.click(
      screen.getByRole('button', { name: messages.adminKanban.actions.markReady }),
    );
    expect(
      await screen.findByText(messages.adminKanban.feedback.markedReady('12345678')),
    ).toBeInTheDocument();

    // PRONTO -> ENTREGUE (remove do quadro ativo)
    await user.click(
      screen.getByRole('button', { name: messages.adminKanban.actions.confirmDelivered }),
    );
    expect(
      await screen.findByText(messages.adminKanban.feedback.delivered('12345678')),
    ).toBeInTheDocument();
    expect(screen.queryByText('#12345678')).not.toBeInTheDocument();

    // Evento WebSocket recarrega a fila automaticamente quando um novo PIX e pago
    fetchKanbanOrdersMock.mockResolvedValueOnce([
      makeCard({ id: '99999999-aaaa-4bbb-8ccc-222222222222', status: 'EM_ESPERA' }),
    ]);
    act(() => {
      socketCallback?.({
        type: 'ORDER_PAID',
        orderId: '99999999-aaaa-4bbb-8ccc-222222222222',
        userId: 'cust-2',
        status: 'EM_ESPERA',
        updatedAt: '2026-10-29T21:10:00.000Z',
      });
    });

    expect(await screen.findByText('#99999999')).toBeInTheDocument();
  });

  it('permite ao ADMIN cancelar e estornar pedido em EM_ESPERA e trata erro de rede', async () => {
    const waitingCard = makeCard({ status: 'EM_ESPERA' });
    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchKanbanOrdersMock.mockResolvedValueOnce([waitingCard]);
    cancelOrderMock.mockResolvedValueOnce({} as never);

    const user = userEvent.setup();

    const { unmount } = render(
      <AuthProvider>
        <KitchenKanbanView />
      </AuthProvider>,
    );

    await screen.findByText('#12345678');
    await user.click(
      screen.getByRole('button', { name: messages.adminKanban.actions.cancelAndRefund }),
    );

    await waitFor(() => expect(cancelOrderMock).toHaveBeenCalledWith(waitingCard.id));
    expect(
      await screen.findByText(messages.adminKanban.feedback.cancelled('12345678')),
    ).toBeInTheDocument();
    expect(screen.queryByText('#12345678')).not.toBeInTheDocument();
    unmount();

    fetchKanbanOrdersMock.mockRejectedValueOnce(new NetworkError());
    render(
      <AuthProvider>
        <KitchenKanbanView />
      </AuthProvider>,
    );
    expect(await screen.findByText(messages.adminKanban.errors.network)).toBeInTheDocument();
  });

  it('filtra pedidos da cozinha por busca textual e por modalidade (entrega vs retirada)', async () => {
    const deliveryCard = makeCard({
      id: '11111111-aaaa-4bbb-8ccc-111111111111',
      customerName: 'Mariana Costa',
      deliveryAddress: 'Rua das Flores, 42',
    });
    const pickupCard = makeCard({
      id: '22222222-aaaa-4bbb-8ccc-222222222222',
      customerName: 'Carlos Eduardo',
      deliveryAddress: null,
    });

    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchKanbanOrdersMock.mockResolvedValueOnce([deliveryCard, pickupCard]);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <KitchenKanbanView />
      </AuthProvider>,
    );

    await screen.findByText('#11111111');
    expect(screen.getByText('#22222222')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: messages.adminKanban.modalities.PICKUP }),
    );
    expect(screen.queryByText('#11111111')).not.toBeInTheDocument();
    expect(screen.getByText('#22222222')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.adminKanban.modalities.ALL }));
    const searchInput = screen.getByRole('searchbox', {
      name: messages.adminKanban.searchAriaLabel,
    });
    await user.type(searchInput, 'Mariana');
    expect(screen.getByText('#11111111')).toBeInTheDocument();
    expect(screen.queryByText('#22222222')).not.toBeInTheDocument();
  });
});
