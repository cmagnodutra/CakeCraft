import { apiRequest } from './client';
import { ApiError, NetworkError } from './errors';
import {
  downloadFinancialCsvText,
  fetchFinancialReport,
  fetchKanbanOrders,
  updateKanbanOrderStatus,
} from './kanban-reports';

jest.mock('./client');

const apiRequestMock = jest.mocked(apiRequest);
const fetchMock = jest.fn();

beforeEach(() => {
  apiRequestMock.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api';
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('cliente de API do Kanban (UC04 / RF08) e Relatorios (UC06 / RF10)', () => {
  it('fetchKanbanOrders e updateKanbanOrderStatus chamam as rotas administrativas do Kanban', async () => {
    apiRequestMock.mockResolvedValueOnce([]);
    await expect(fetchKanbanOrders()).resolves.toEqual([]);
    expect(apiRequestMock).toHaveBeenCalledWith('/kanban/orders');

    const updatedCard = { id: 'ord-1', status: 'PRONTO' };
    apiRequestMock.mockResolvedValueOnce(updatedCard);
    await expect(updateKanbanOrderStatus('ord-1', 'PRONTO')).resolves.toEqual(updatedCard);
    expect(apiRequestMock).toHaveBeenCalledWith('/kanban/orders/ord-1/status', {
      method: 'PATCH',
      body: { status: 'PRONTO' },
    });
  });

  it('fetchFinancialReport monta a querystring de periodo opcional', async () => {
    const sampleReport = {
      from: '2026-10-01',
      to: '2026-10-31',
      paidOrdersCount: 2,
      totalRevenue: 400,
      averageTicket: 200,
      orders: [],
    };
    apiRequestMock.mockResolvedValue(sampleReport);

    await expect(fetchFinancialReport()).resolves.toEqual(sampleReport);
    expect(apiRequestMock).toHaveBeenCalledWith('/reports/financial');

    await expect(
      fetchFinancialReport({ from: '2026-10-01', to: '2026-10-31' }),
    ).resolves.toEqual(sampleReport);
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/reports/financial?from=2026-10-01&to=2026-10-31',
    );
  });

  it('downloadFinancialCsvText envia credentials: include e trata erros HTTP e de rede', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('\uFEFFpedido_id;valor_brl\r\n'),
    });

    const csv = await downloadFinancialCsvText({ from: '2026-10-01', to: '2026-10-31' });
    expect(csv).toContain('pedido_id;valor_brl');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/reports/financial/csv?from=2026-10-01&to=2026-10-31',
      expect.objectContaining({ credentials: 'include' }),
    );

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });
    await expect(downloadFinancialCsvText()).rejects.toBeInstanceOf(ApiError);

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(downloadFinancialCsvText()).rejects.toBeInstanceOf(NetworkError);
  });
});
