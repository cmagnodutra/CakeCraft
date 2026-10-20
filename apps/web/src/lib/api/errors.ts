/**
 * Erros do cliente de API.
 *
 * Duas familias, de proposito distintas, porque a tela reage diferente:
 * - ApiError: o servidor respondeu com status de erro (409, 400, 500...).
 * - NetworkError: nao houve resposta (servidor fora do ar, sem internet,
 *   CORS bloqueado). A tela diz "verifique sua conexao", nao "dados invalidos".
 */

/**
 * Le as mensagens do formato de erro da API. O contrato diz que `message`
 * e uma string (regra de negocio) ou um array de strings (validacao do
 * class-validator, uma por campo). Qualquer outra forma vira lista vazia:
 * um proxy ou um erro inesperado pode devolver qualquer corpo, e isto nunca
 * deve lancar excecao dentro do tratamento de erro.
 */
export function extractMessages(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return [];
  }

  const { message } = body;

  if (typeof message === 'string') {
    return [message];
  }
  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    // Texto para log e depuracao. O que o usuario le vem do mapeamento da
    // tela (pt-BR), nunca daqui: a API devolve mensagens sem acento e em ingles.
    super(messages.length > 0 ? messages.join('; ') : `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Sem resposta do servidor.');
    this.name = 'NetworkError';
  }
}
