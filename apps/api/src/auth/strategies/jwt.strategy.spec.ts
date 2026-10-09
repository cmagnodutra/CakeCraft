import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { extractFromCookie, JwtStrategy } from './jwt.strategy';

const requestWithCookies = (cookies: unknown): Request => ({ cookies }) as unknown as Request;

describe('extractFromCookie', () => {
  it('le o token do cookie httpOnly access_token', () => {
    expect(extractFromCookie(requestWithCookies({ access_token: 'abc.def.ghi' }))).toBe(
      'abc.def.ghi',
    );
  });

  it('devolve null quando o cookie nao existe', () => {
    expect(extractFromCookie(requestWithCookies({ outro: 'x' }))).toBeNull();
  });

  it('devolve null quando o cookie-parser nao populou req.cookies', () => {
    expect(extractFromCookie(requestWithCookies(undefined))).toBeNull();
  });

  it('devolve null quando o valor do cookie nao e string (ex.: cookie JSON do cookie-parser)', () => {
    expect(extractFromCookie(requestWithCookies({ access_token: { a: 1 } }))).toBeNull();
  });
});

describe('JwtStrategy.validate', () => {
  it('converte o payload do JWT em AuthenticatedUser (sub vira id)', () => {
    const config = { getOrThrow: () => 'segredo-de-teste' } as unknown as ConfigService;
    const strategy = new JwtStrategy(config);

    const user = strategy.validate({ sub: 'u1', email: 'mariana@example.com', role: 'CLIENTE' });

    expect(user).toEqual({ id: 'u1', email: 'mariana@example.com', role: 'CLIENTE' });
  });
});
