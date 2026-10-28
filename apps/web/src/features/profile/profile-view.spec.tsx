import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { AuthProvider } from '@/features/auth/auth-provider';
import { anonymizeMyAccount, fetchCurrentUser, logoutUser } from '@/lib/api/auth';
import type { AuthUser } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { ProfileView } from './profile-view';

jest.mock('@/lib/api/auth');

const fetchCurrentUserMock = jest.mocked(fetchCurrentUser);
const logoutUserMock = jest.mocked(logoutUser);
const anonymizeMyAccountMock = jest.mocked(anonymizeMyAccount);

const texts = messages.profile;

const mariana: AuthUser = {
  id: 'u1',
  name: 'Mariana Silva',
  email: 'mariana@example.com',
  role: 'CLIENTE',
  xp: 350,
  level: 1,
};

beforeEach(() => {
  fetchCurrentUserMock.mockReset();
  logoutUserMock.mockReset();
  anonymizeMyAccountMock.mockReset();
});

describe('ProfileView (/perfil)', () => {
  it('exibe estado de carregamento enquanto a sessao inicial e verificada', () => {
    fetchCurrentUserMock.mockReturnValue(new Promise(() => undefined));

    render(
      <AuthProvider>
        <ProfileView />
      </AuthProvider>,
    );

    expect(screen.getByText(texts.loadingMessage)).toBeInTheDocument();
  });

  it('quando nao ha sessao ativa, convida a entrar (/entrar) ou criar conta (/cadastro)', async () => {
    fetchCurrentUserMock.mockResolvedValue(null);

    render(
      <AuthProvider>
        <ProfileView />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: texts.unauthenticatedTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: texts.goToLogin })).toHaveAttribute('href', '/entrar');
    expect(screen.getByRole('link', { name: texts.goToRegister })).toHaveAttribute(
      'href',
      '/cadastro',
    );
  });

  it('exibe dados cadastrais, barra de progresso do Clube CakeCraft (RN04) e permite encerrar sessao', async () => {
    fetchCurrentUserMock.mockResolvedValue(mariana);
    logoutUserMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <ProfileView />
      </AuthProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: texts.title })).toBeInTheDocument();
    expect(screen.getByText('Mariana Silva')).toBeInTheDocument();
    expect(screen.getByText('mariana@example.com')).toBeInTheDocument();
    expect(screen.getByText(texts.roles.CLIENTE)).toBeInTheDocument();

    // Gamificacao: 350 XP -> Nivel 1, faltam 650 XP para o Nivel 2.
    expect(screen.getByText(texts.gamificationSection.levelBadge(1))).toBeInTheDocument();
    expect(screen.getByText(texts.gamificationSection.xpSummary(350))).toBeInTheDocument();
    expect(
      screen.getByText(texts.gamificationSection.progressDetail(350, 650, 2)),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '350');

    await user.click(screen.getByRole('button', { name: texts.sessionSection.logoutButton }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: texts.unauthenticatedTitle }),
      ).toBeInTheDocument(),
    );
    expect(logoutUserMock).toHaveBeenCalledTimes(1);
  });

  it('executa anonimizacao LGPD em duas etapas (pedir -> cancelar -> pedir -> confirmar) e limpa a sessao', async () => {
    fetchCurrentUserMock.mockResolvedValue({ ...mariana, role: 'ADMIN', xp: 1200, level: 2 });
    anonymizeMyAccountMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <ProfileView />
      </AuthProvider>,
    );

    await screen.findByRole('heading', { level: 1, name: texts.title });
    expect(screen.getByText(texts.roles.ADMIN)).toBeInTheDocument();
    expect(
      screen.getByText(texts.gamificationSection.progressDetail(200, 800, 3)),
    ).toBeInTheDocument();

    // Passo 1: abre confirmacao irreversivel e cancela.
    await user.click(screen.getByRole('button', { name: texts.privacySection.requestButton }));
    expect(screen.getByText(texts.privacySection.confirmWarning)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: texts.privacySection.cancelButton }));
    expect(screen.queryByText(texts.privacySection.confirmWarning)).not.toBeInTheDocument();
    expect(anonymizeMyAccountMock).not.toHaveBeenCalled();

    // Passo 2: abre novamente e confirma.
    await user.click(screen.getByRole('button', { name: texts.privacySection.requestButton }));
    await user.click(screen.getByRole('button', { name: texts.privacySection.confirmButton }));

    const doneHeading = await screen.findByRole('heading', {
      level: 1,
      name: texts.privacySection.anonymizedTitle,
    });
    expect(anonymizeMyAccountMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(texts.privacySection.anonymizedMessage);
    expect(screen.getByRole('link', { name: texts.privacySection.backHome })).toHaveAttribute(
      'href',
      '/',
    );
    await waitFor(() => expect(doneHeading).toHaveFocus());
  });

  it.each([
    [new NetworkError(), texts.errors.network],
    [new ApiError(500, ['Internal Server Error']), texts.errors.anonymizeFailed],
  ])('exibe erro em pt-BR se a anonimizacao falhar e mantem a conta visivel (%#)', async (err, expected) => {
    fetchCurrentUserMock.mockResolvedValue(mariana);
    anonymizeMyAccountMock.mockRejectedValueOnce(err);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <ProfileView />
      </AuthProvider>,
    );

    await screen.findByRole('heading', { level: 1, name: texts.title });
    await user.click(screen.getByRole('button', { name: texts.privacySection.requestButton }));
    await user.click(screen.getByRole('button', { name: texts.privacySection.confirmButton }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(screen.getByText('Mariana Silva')).toBeInTheDocument();
  });
});
