import { apiRequest } from './client';
import { ApiError, NetworkError } from './errors';

const fetchMock = jest.fn();

/** Espera a promessa falhar com ApiError e devolve o erro ja tipado. */
async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
  throw new Error('A promessa deveria ter sido rejeitada com ApiError.');
}

/** Resposta minima: o jsdom nao traz Response, so usamos o que o cliente le. */
function respond(status: number, body?: unknown, { invalidJson = false } = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      invalidJson ? Promise.reject(new SyntaxError('Unexpected token <')) : Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api';
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('apiRequest', () => {
  describe('requisicao', () => {
    it('usa a URL base da API e SEMPRE envia credentials: include (autenticacao por cookie httpOnly)', async () => {
      fetchMock.mockResolvedValue(respond(200, { ok: true }));

      await apiRequest('/catalog');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://api.test/api/catalog');
      expect(init.credentials).toBe('include');
    });

    it('nunca envia Authorization: a sessao vai so no cookie httpOnly (decisao do projeto)', async () => {
      fetchMock.mockResolvedValue(respond(200, {}));

      await apiRequest('/catalog');
      await apiRequest('/auth/login', { method: 'POST', body: { email: 'a@b.com' } });

      for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
        expect(init.headers).not.toHaveProperty('Authorization');
        expect(init.headers).not.toHaveProperty('authorization');
      }
    });

    it('e GET por padrao e nao envia corpo nem Content-Type', async () => {
      fetchMock.mockResolvedValue(respond(200, []));

      await apiRequest('/catalog');

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      expect(init.headers).not.toHaveProperty('Content-Type');
    });

    it('envia o corpo como JSON com Content-Type application/json', async () => {
      fetchMock.mockResolvedValue(respond(201, { user: {} }));

      await apiRequest('/auth/register', { method: 'POST', body: { email: 'a@b.com' } });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com' });
    });

    it('aceita caminho sem a barra inicial', async () => {
      fetchMock.mockResolvedValue(respond(200, {}));

      await apiRequest('catalog');

      expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/catalog');
    });

    it('pede JSON na resposta (Accept)', async () => {
      fetchMock.mockResolvedValue(respond(200, {}));

      await apiRequest('/catalog');

      expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
        Accept: 'application/json',
      });
    });
  });

  describe('resposta de sucesso', () => {
    it('devolve o corpo JSON', async () => {
      fetchMock.mockResolvedValue(respond(201, { user: { id: 'u1' } }));

      await expect(apiRequest('/auth/register', { method: 'POST', body: {} })).resolves.toEqual({
        user: { id: 'u1' },
      });
    });

    it('204 (sem corpo) devolve undefined sem tentar ler JSON', async () => {
      fetchMock.mockResolvedValue(respond(204, undefined, { invalidJson: true }));

      await expect(apiRequest('/catalog/1', { method: 'DELETE' })).resolves.toBeUndefined();
    });
  });

  describe('resposta de erro', () => {
    it('lanca ApiError com o status e a mensagem de regra de negocio (string)', async () => {
      fetchMock.mockResolvedValue(
        respond(409, { statusCode: 409, message: 'Ja existe uma conta com este e-mail.' }),
      );

      const error = await failure(apiRequest('/auth/register', { method: 'POST', body: {} }));

      expect(error.status).toBe(409);
      expect(error.messages).toEqual(['Ja existe uma conta com este e-mail.']);
    });

    it('lanca ApiError com varias mensagens de validacao (array)', async () => {
      fetchMock.mockResolvedValue(
        respond(400, {
          statusCode: 400,
          message: ['email must be an email', 'password too short'],
        }),
      );

      const error = await failure(apiRequest('/auth/register', { method: 'POST', body: {} }));

      expect(error.status).toBe(400);
      expect(error.messages).toHaveLength(2);
    });

    it('erro com corpo que nao e JSON (ex.: pagina HTML de um proxy 502) ainda vira ApiError', async () => {
      fetchMock.mockResolvedValue(respond(502, undefined, { invalidJson: true }));

      const error = await failure(apiRequest('/catalog'));

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(502);
      expect(error.messages).toEqual([]);
    });

    it('sucesso com corpo invalido tambem e erro (nao devolve lixo como se fosse dado)', async () => {
      fetchMock.mockResolvedValue(respond(200, undefined, { invalidJson: true }));

      await expect(apiRequest('/catalog')).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('falha de rede', () => {
    it('fetch que rejeita (servidor fora do ar, sem internet, CORS) vira NetworkError', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(apiRequest('/catalog')).rejects.toBeInstanceOf(NetworkError);
    });

    describe('dica para quem desenvolve (a tela mostra so o aviso generico ao usuario)', () => {
      let warn: jest.SpyInstance;

      beforeEach(() => {
        warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      });

      afterEach(() => warn.mockRestore());

      it('em desenvolvimento, o console diz qual URL falhou e como subir a API', async () => {
        await apiRequest('/auth/register', { method: 'POST', body: {} }).catch(() => undefined);

        expect(warn).toHaveBeenCalledTimes(1);
        const text = String(warn.mock.calls[0][0]);
        expect(text).toContain('http://api.test/api/auth/register');
        expect(text).toContain('npm run dev:api');
        expect(text).toContain('CORS_ORIGIN');
      });

      it('em producao, nao escreve nada no console do usuario', async () => {
        jest.replaceProperty(process.env, 'NODE_ENV', 'production');

        await apiRequest('/auth/register', { method: 'POST', body: {} }).catch(() => undefined);

        expect(warn).not.toHaveBeenCalled();
        jest.restoreAllMocks();
      });

      it('erro HTTP (o servidor respondeu) nao dispara a dica de rede', async () => {
        fetchMock.mockResolvedValue(respond(500, { message: 'x' }));

        await apiRequest('/catalog').catch(() => undefined);

        expect(warn).not.toHaveBeenCalled();
      });
    });
  });

  it('em producao sem NEXT_PUBLIC_API_URL falha antes de qualquer requisicao', async () => {
    // A regra de producao ja e coberta em env.spec; aqui so garantimos que o
    // cliente nao dispara fetch com uma URL invalida.
    process.env.NEXT_PUBLIC_API_URL = 'isso nao e url';

    await expect(apiRequest('/catalog')).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('renovacao silenciosa de sessao (401 -> POST /auth/refresh)', () => {
    it('ao receber 401 em rota autenticada, tenta POST /auth/refresh uma vez e repete a requisicao original', async () => {
      fetchMock
        .mockResolvedValueOnce(respond(401, { statusCode: 401, message: 'Unauthorized' }))
        .mockResolvedValueOnce(respond(200, { user: { id: 'u1' } }))
        .mockResolvedValueOnce(respond(200, { user: { id: 'u1', name: 'Mariana' } }));

      const data = await apiRequest('/auth/me');

      expect(data).toEqual({ user: { id: 'u1', name: 'Mariana' } });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/auth/me');
      expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/api/auth/refresh');
      expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('POST');
      expect((fetchMock.mock.calls[1][1] as RequestInit).credentials).toBe('include');
      expect(fetchMock.mock.calls[2][0]).toBe('http://api.test/api/auth/me');
    });

    it('se o refresh falhar (sem cookie ou expirado), devolve o ApiError 401 original sem entrar em loop', async () => {
      fetchMock
        .mockResolvedValueOnce(respond(401, { statusCode: 401, message: 'Unauthorized' }))
        .mockResolvedValueOnce(respond(401, { statusCode: 401, message: 'Refresh expirado' }));

      const error = await failure(apiRequest('/auth/me'));

      expect(error.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('se o refresh cair por falha de rede, devolve o ApiError 401 original', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      fetchMock
        .mockResolvedValueOnce(respond(401, { statusCode: 401, message: 'Unauthorized' }))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const error = await failure(apiRequest('/auth/me'));

      expect(error.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      warn.mockRestore();
    });

    it('nao entra em loop infinito se a requisicao repetida apos refresh continuar respondendo 401', async () => {
      fetchMock
        .mockResolvedValueOnce(respond(401, { statusCode: 401, message: 'Unauthorized' }))
        .mockResolvedValueOnce(respond(200, { user: { id: 'u1' } }))
        .mockResolvedValueOnce(respond(401, { statusCode: 401, message: 'Still unauthorized' }));

      const error = await failure(apiRequest('/usuarios/me/anonymize', { method: 'DELETE' }));

      expect(error.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('deduplica chamadas simultaneas com 401 compartilhando um unico POST /auth/refresh', async () => {
      let resolveRefresh!: (value: Response) => void;
      const refreshPromise = new Promise<Response>((resolve) => {
        resolveRefresh = resolve;
      });

      fetchMock.mockImplementation((url: string) => {
        if (url.endsWith('/auth/refresh')) {
          return refreshPromise;
        }
        // As duas primeiras chamadas falham com 401; as repeticoes passam com 200.
        const previousCallsToUrl = fetchMock.mock.calls.filter(([u]) => u === url).length;
        if (previousCallsToUrl === 1) {
          return Promise.resolve(respond(401, { statusCode: 401, message: 'Unauthorized' }));
        }
        return Promise.resolve(respond(200, { url }));
      });

      const first = apiRequest('/auth/me');
      const second = apiRequest('/catalog/admin');

      await Promise.resolve();
      resolveRefresh(respond(200, { user: { id: 'u1' } }));

      const [res1, res2] = await Promise.all([first, second]);
      expect(res1).toEqual({ url: 'http://api.test/api/auth/me' });
      expect(res2).toEqual({ url: 'http://api.test/api/catalog/admin' });

      const refreshCalls = fetchMock.mock.calls.filter(([u]) =>
        String(u).endsWith('/auth/refresh'),
      );
      expect(refreshCalls).toHaveLength(1);
    });

    it.each([
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
      '/auth/forgot-password',
      '/auth/reset-password',
    ])('nao tenta refresh automatico quando %s responde 401', async (path) => {
      fetchMock.mockResolvedValueOnce(
        respond(401, { statusCode: 401, message: 'Credenciais invalidas.' }),
      );

      const error = await failure(apiRequest(path, { method: 'POST', body: {} }));

      expect(error.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
