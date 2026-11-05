import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { AuthProvider } from '@/features/auth/auth-provider';
import { fetchCurrentUser } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';
import {
  downloadFinancialCsvText,
  fetchFinancialReport,
} from '@/lib/api/kanban-reports';
import type { FinancialReport } from '@/lib/api/kanban-reports';

import { AdminReportsView } from './admin-reports-view';

jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/kanban-reports');

const fetchCurrentUserMock = jest.mocked(fetchCurrentUser);
const fetchFinancialReportMock = jest.mocked(fetchFinancialReport);
const downloadFinancialCsvTextMock = jest.mocked(downloadFinancialCsvText);

const adminUser = {
  id: 'adm-1',
  name: 'Juliana Gestora',
  email: 'admin@cakecraft.com.br',
  role: 'ADMIN' as const,
  xp: 0,
  level: 1,
};

const sampleReport: FinancialReport = {
  from: '2026-10-01',
  to: '2026-10-31',
  paidOrdersCount: 2,
  totalRevenue: 480,
  averageTicket: 240,
  orders: [
    {
      id: 'abcdef12-3456-4789-8000-111111111111',
      customerName: 'Mariana Silva',
      status: 'PRONTO',
      format: 'REDONDO',
      floorsCount: 2,
      totalPrice: 280,
      paidAt: '2026-10-15T14:00:00.000Z',
      gatewayProvider: 'ASAAS',
      gatewayReference: 'pay_1',
    },
    {
      id: '98765432-3456-4789-8000-222222222222',
      customerName: 'Pedro Souza',
      status: 'EM_PRODUCAO',
      format: 'QUADRADO',
      floorsCount: 1,
      totalPrice: 200,
      paidAt: '2026-10-16T10:30:00.000Z',
      gatewayProvider: 'ASAAS',
      gatewayReference: 'pay_2',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => 'blob:http://localhost/csv');
  URL.revokeObjectURL = jest.fn();
});

describe('AdminReportsView (/admin/relatorios - UC06, RF10)', () => {
  it('bloqueia visitantes e clientes sem papel ADMIN', async () => {
    fetchCurrentUserMock.mockRejectedValueOnce(new ApiError(401, ['Unauthorized']));
    const { unmount } = render(
      <AuthProvider>
        <AdminReportsView />
      </AuthProvider>,
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: messages.adminReports.unauthenticatedTitle,
      }),
    ).toBeInTheDocument();
    expect(fetchFinancialReportMock).not.toHaveBeenCalled();
    unmount();

    fetchCurrentUserMock.mockResolvedValueOnce({ ...adminUser, role: 'CLIENTE' });
    render(
      <AuthProvider>
        <AdminReportsView />
      </AuthProvider>,
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: messages.adminReports.forbiddenTitle,
      }),
    ).toBeInTheDocument();
    expect(fetchFinancialReportMock).not.toHaveBeenCalled();
  });

  it('exibe KPIs (receita, pedidos pagos, ticket medio), filtra por periodo e exporta CSV em 1 clique', async () => {
    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchFinancialReportMock
      .mockResolvedValueOnce(sampleReport)
      .mockResolvedValueOnce({ ...sampleReport, from: '2026-10-05', to: '2026-10-25' });
    downloadFinancialCsvTextMock.mockResolvedValue('\uFEFFpedido_id;valor_brl\r\n');

    const clickAnchorSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AdminReportsView />
      </AuthProvider>,
    );

    expect(await screen.findByText(/R\$\s*480,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*240,00/)).toBeInTheDocument();
    expect(screen.getByText('Mariana Silva')).toBeInTheDocument();
    expect(screen.getByText('#abcdef12')).toBeInTheDocument();

    const fromInput = screen.getByLabelText(messages.adminReports.filterForm.fromLabel);
    const toInput = screen.getByLabelText(messages.adminReports.filterForm.toLabel);

    await user.clear(fromInput);
    await user.type(fromInput, '2026-10-05');
    await user.clear(toInput);
    await user.type(toInput, '2026-10-25');

    await user.click(
      screen.getByRole('button', { name: messages.adminReports.filterForm.applyButton }),
    );
    await waitFor(() =>
      expect(fetchFinancialReportMock).toHaveBeenCalledWith({
        from: '2026-10-05',
        to: '2026-10-25',
      }),
    );

    await user.click(
      screen.getByRole('button', { name: messages.adminReports.filterForm.exportCsvButton }),
    );
    await waitFor(() =>
      expect(downloadFinancialCsvTextMock).toHaveBeenCalledWith({
        from: '2026-10-05',
        to: '2026-10-25',
      }),
    );
    expect(clickAnchorSpy).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(messages.adminReports.feedback.csvExported),
    ).toBeInTheDocument();

    clickAnchorSpy.mockRestore();
  });

  it('trata falhas de rede no carregamento e na exportacao CSV', async () => {
    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchFinancialReportMock.mockRejectedValueOnce(new NetworkError());

    const { unmount } = render(
      <AuthProvider>
        <AdminReportsView />
      </AuthProvider>,
    );

    expect(await screen.findByText(messages.adminReports.errors.network)).toBeInTheDocument();
    unmount();

    fetchFinancialReportMock.mockResolvedValueOnce({ ...sampleReport, orders: [] });
    downloadFinancialCsvTextMock.mockRejectedValueOnce(new ApiError(500, ['Error']));
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AdminReportsView />
      </AuthProvider>,
    );

    expect(await screen.findByText(messages.adminReports.table.empty)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: messages.adminReports.filterForm.exportCsvButton }),
    );
    expect(await screen.findByText(messages.adminReports.errors.exportFailed)).toBeInTheDocument();
  });

  it('aplica atalhos rapidos de periodo contabil (Hoje e Ultimos 7 dias) com 1 clique', async () => {
    fetchCurrentUserMock.mockResolvedValue(adminUser);
    fetchFinancialReportMock
      .mockResolvedValueOnce(sampleReport)
      .mockResolvedValueOnce({ ...sampleReport, from: '2026-11-04', to: '2026-11-04' });

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AdminReportsView />
      </AuthProvider>,
    );

    await screen.findByText(/R\$\s*480,00/);

    await user.click(
      screen.getByRole('button', { name: messages.adminReports.filterForm.presets.TODAY }),
    );

    await waitFor(() => expect(fetchFinancialReportMock).toHaveBeenCalledTimes(2));
  });
});
