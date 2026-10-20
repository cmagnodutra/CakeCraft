import { ApiError, NetworkError, extractMessages } from './errors';

describe('extractMessages (formato de erro da API: string ou array de strings)', () => {
  it('uma mensagem de regra de negocio vira lista de um item', () => {
    expect(extractMessages({ statusCode: 409, message: 'Ja existe uma conta.' })).toEqual([
      'Ja existe uma conta.',
    ]);
  });

  it('varias mensagens de validacao viram a lista, na mesma ordem', () => {
    expect(extractMessages({ statusCode: 400, message: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('ignora itens que nao sao string dentro do array', () => {
    expect(extractMessages({ message: ['a', 2, null, 'b'] })).toEqual(['a', 'b']);
  });

  it.each([null, undefined, 'texto solto', 42, {}, { message: 5 }, { message: null }, []])(
    'corpo inesperado (%j) vira lista vazia, sem lancar erro',
    (body) => {
      expect(extractMessages(body)).toEqual([]);
    },
  );
});

describe('ApiError', () => {
  it('guarda o status HTTP e as mensagens', () => {
    const error = new ApiError(409, ['Ja existe uma conta.']);

    expect(error.status).toBe(409);
    expect(error.messages).toEqual(['Ja existe uma conta.']);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
  });

  it('a mensagem do Error junta as mensagens (ajuda no log, nao e texto de tela)', () => {
    expect(new ApiError(400, ['a', 'b']).message).toBe('a; b');
    expect(new ApiError(502, []).message).toBe('HTTP 502');
  });
});

describe('NetworkError', () => {
  it('e um Error distinguivel de ApiError (nao houve resposta do servidor)', () => {
    const error = new NetworkError();

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.name).toBe('NetworkError');
  });
});
