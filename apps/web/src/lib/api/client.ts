import { getApiBaseUrl } from '@/lib/env';

import { ApiError, NetworkError, extractMessages } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

/**
 * Rotas de credenciais onde um 401 significa falha de credencial (ou do
 * proprio refresh), e NAO um access_token expirado que mereca tentativa de
 * renovacao silenciosa.
 */
const NO_REFRESH_PATHS = new Set([
  'auth/login',
  'auth/register',
  'auth/refresh',
  'auth/logout',
  'auth/forgot-password',
  'auth/reset-password',
]);

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Unico ponto do frontend que fala com a API.
 *
 * - credentials: 'include' SEMPRE: a autenticacao e por cookie httpOnly
 *   (access_token e refresh_token), que o navegador so envia em requisicoes
 *   entre origens (localhost:3000 -> localhost:3001) com essa opcao. Sem ela
 *   o login "funciona" mas a requisicao seguinte chega sem sessao.
 * - Nao ha header Authorization nem token em localStorage (decisao do
 *   projeto: cookie httpOnly protege contra XSS).
 * - Renovacao silenciosa: quando uma rota autenticada responde 401, tenta
 *   uma unica chamada compartilhada a POST /auth/refresh e repete a requisicao
 *   original caso a sessao seja renovada.
 * - Erros viram ApiError (o servidor respondeu) ou NetworkError (nao houve
 *   resposta); a tela decide o texto em pt-BR.
 */
export async function apiRequest<T = unknown>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  // Valida a configuracao antes de qualquer rede.
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.replace(/^\/+/, '');
  const url = `${baseUrl}/${normalizedPath}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  };

  let response = await performFetch(url, init);

  if (response.status === 401 && !NO_REFRESH_PATHS.has(normalizedPath)) {
    const refreshed = await tryRefreshSession(baseUrl);
    if (refreshed) {
      response = await performFetch(url, init);
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractMessages(await readJson(response)));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    // Status de sucesso com corpo ilegivel: nao devolver lixo como se fosse dado.
    throw new ApiError(response.status, []);
  }
}

async function performFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    warnNetworkFailure(url);
    throw new NetworkError();
  }
}

/**
 * Compartilha uma unica chamada de renovacao entre requisicoes concorrentes
 * que receberam 401 ao mesmo tempo, evitando que a segunda apresente um
 * refresh_token recem-rotacionado e acione a deteccao de reuso da API.
 */
async function tryRefreshSession(baseUrl: string): Promise<boolean> {
  if (!refreshInFlight) {
    const refreshUrl = `${baseUrl}/auth/refresh`;
    refreshInFlight = fetch(refreshUrl, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => {
        warnNetworkFailure(refreshUrl);
        return false;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

/** Le o corpo de um erro sem nunca lancar: o corpo pode nao ser JSON (ex.: HTML de proxy). */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Dica so para quem desenvolve: a tela mostra ao usuario apenas o aviso
 * generico de conexao, entao o console diz o que de fato verificar. As causas
 * mais comuns em desenvolvimento sao a API nao estar rodando (ou ter
 * recusado subir por falta do apps/api/.env) e o CORS_ORIGIN nao bater com o
 * endereco em que o frontend esta aberto (localhost x 127.0.0.1).
 * Em producao nao escreve nada: o usuario nao precisa ver isso.
 */
function warnNetworkFailure(url: string): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  console.warn(
    `[CakeCraft] Nao foi possivel alcancar ${url}. Verifique: ` +
      '(1) a API esta rodando? (npm run dev:api, com o Docker de pe e o apps/api/.env criado); ' +
      '(2) o CORS_ORIGIN da API e igual ao endereco desta pagina? ' +
      '(abra pelo mesmo host: localhost ou 127.0.0.1, nao os dois).',
  );
}
