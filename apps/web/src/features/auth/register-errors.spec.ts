import { messages } from '@/content/messages';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { describeRegisterError } from './register-errors';

const texts = messages.auth.register.errors;

describe('describeRegisterError', () => {
  it('409 (e-mail ja cadastrado) vira erro NO CAMPO e-mail, para o usuario ver onde corrigir', () => {
    expect(
      describeRegisterError(new ApiError(409, ['Ja existe uma conta com este e-mail.'])),
    ).toEqual({
      field: 'email',
      message: texts.emailTaken,
    });
  });

  it('400 (validacao que passou pelo formulario) vira aviso geral, sem campo', () => {
    expect(describeRegisterError(new ApiError(400, ['email must be an email']))).toEqual({
      message: texts.invalidData,
    });
  });

  it('429 (muitas tentativas) pede para aguardar', () => {
    expect(describeRegisterError(new ApiError(429, []))).toEqual({
      message: texts.tooManyRequests,
    });
  });

  it.each([500, 502, 503])('%i (erro do servidor) diz que o problema e do nosso lado', (status) => {
    expect(describeRegisterError(new ApiError(status, []))).toEqual({ message: texts.server });
  });

  it('falha de rede pede para verificar a conexao', () => {
    expect(describeRegisterError(new NetworkError())).toEqual({ message: texts.network });
  });

  it.each([
    new ApiError(404, []),
    new ApiError(418, []),
    new Error('boom'),
    'texto',
    null,
    undefined,
  ])('qualquer outra coisa (%j) vira a mensagem inesperada', (error) => {
    expect(describeRegisterError(error)).toEqual({ message: texts.unexpected });
  });

  it('nunca mostra a mensagem crua da API (ingles e sem acento)', () => {
    const raw = 'Ja existe uma conta com este e-mail.';

    expect(describeRegisterError(new ApiError(409, [raw])).message).not.toBe(raw);
  });

  it('todas as mensagens de erro tem acentuacao de texto de tela e terminam com ponto', () => {
    for (const text of Object.values(texts)) {
      expect(text.endsWith('.')).toBe(true);
    }
  });
});
