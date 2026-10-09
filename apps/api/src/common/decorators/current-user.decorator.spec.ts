import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { getAuthenticatedUser } from './current-user.decorator';

function makeContext(user?: { id: string; email: string; role: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('getAuthenticatedUser', () => {
  it('devolve o usuario que o JwtStrategy colocou no request', () => {
    const user = { id: 'u1', email: 'mariana@example.com', role: 'CLIENTE' };

    expect(getAuthenticatedUser(makeContext(user))).toBe(user);
  });

  it('lanca 401 quando nao ha usuario (rota sem JwtAuthGuard)', () => {
    expect(() => getAuthenticatedUser(makeContext(undefined))).toThrow(UnauthorizedException);
  });
});
