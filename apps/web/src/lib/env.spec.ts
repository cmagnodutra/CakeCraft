import { getApiBaseUrl, normalizeApiBaseUrl } from './env';

describe('normalizeApiBaseUrl', () => {
  describe('valor valido', () => {
    it('devolve a URL informada', () => {
      expect(normalizeApiBaseUrl('https://api.cakecraft.com.br/api', true)).toBe(
        'https://api.cakecraft.com.br/api',
      );
    });

    it('remove barras finais, para o cliente poder concatenar caminhos com seguranca', () => {
      expect(normalizeApiBaseUrl('http://localhost:3001/api/', false)).toBe(
        'http://localhost:3001/api',
      );
      expect(normalizeApiBaseUrl('http://localhost:3001/api///', false)).toBe(
        'http://localhost:3001/api',
      );
    });

    it('ignora espacos nas pontas (erro comum ao copiar para o .env)', () => {
      expect(normalizeApiBaseUrl('  http://localhost:3001/api  ', false)).toBe(
        'http://localhost:3001/api',
      );
    });
  });

  describe('variavel ausente', () => {
    it.each([undefined, '', '   '])('em desenvolvimento (%j) usa a API local padrao', (raw) => {
      expect(normalizeApiBaseUrl(raw, false)).toBe('http://localhost:3001/api');
    });

    it.each([undefined, '', '   '])(
      'em producao (%j) falha em vez de apontar para localhost em silencio',
      (raw) => {
        expect(() => normalizeApiBaseUrl(raw, true)).toThrow(/NEXT_PUBLIC_API_URL/);
      },
    );
  });

  describe('valor invalido', () => {
    it('rejeita texto que nao e URL', () => {
      expect(() => normalizeApiBaseUrl('isso nao e url', false)).toThrow(/NEXT_PUBLIC_API_URL/);
    });

    it.each(['ftp://servidor/api', 'javascript:alert(1)', 'file:///etc/passwd'])(
      'rejeita protocolo que nao e http/https (%s)',
      (raw) => {
        expect(() => normalizeApiBaseUrl(raw, false)).toThrow(/http/);
      },
    );
  });
});

describe('getApiBaseUrl', () => {
  const original = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = original;
    }
  });

  it('le NEXT_PUBLIC_API_URL do ambiente', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.cakecraft.com.br/api/';

    expect(getApiBaseUrl()).toBe('https://api.cakecraft.com.br/api');
  });

  it('sem a variavel, no ambiente de teste (nao e producao), usa a API local', () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    expect(getApiBaseUrl()).toBe('http://localhost:3001/api');
  });
});
