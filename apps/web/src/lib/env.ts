/**
 * Configuracao de ambiente do frontend.
 *
 * Fica separado da logica de rede para ser testavel sem mexer em
 * process.env nem em fetch.
 */

const DEFAULT_API_URL = 'http://localhost:3001/api';
const ENV_NAME = 'NEXT_PUBLIC_API_URL';

/**
 * Valida e normaliza a URL base da API.
 *
 * - Em desenvolvimento, variavel ausente cai na API local padrao.
 * - Em producao, variavel ausente e ERRO: um deploy esquecido nao pode
 *   apontar para localhost em silencio (o usuario veria "falha de rede" e
 *   nao a causa real).
 * - So aceita http/https; qualquer outro protocolo (javascript:, file:,
 *   ftp:) e rejeitado.
 * - Remove barras finais, para o cliente concatenar '/auth/login' sem
 *   gerar '//'.
 */
export function normalizeApiBaseUrl(raw: string | undefined, isProduction: boolean): string {
  const value = raw?.trim() ?? '';

  if (value === '') {
    if (isProduction) {
      throw new Error(`${ENV_NAME} nao esta definida. Ela e obrigatoria em producao.`);
    }
    return DEFAULT_API_URL;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${ENV_NAME} nao e uma URL valida: "${value}".`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${ENV_NAME} deve usar http ou https (recebido: "${url.protocol}").`);
  }

  return value.replace(/\/+$/, '');
}

/**
 * URL base da API para o ambiente atual.
 *
 * O Next so troca NEXT_PUBLIC_* pelo valor real no build se a expressao
 * aparecer escrita literalmente como process.env.NEXT_PUBLIC_API_URL
 * (acesso dinamico, como process.env[nome], nao funciona no navegador).
 * Por isso a leitura fica aqui, em vez de dentro de normalizeApiBaseUrl.
 *
 * E funcao, e nao constante de modulo, de proposito: assim o erro de
 * configuracao so aparece quando alguem de fato usa a API, e nao derruba
 * o import de paginas que nao dependem dela.
 */
export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NODE_ENV === 'production',
  );
}
