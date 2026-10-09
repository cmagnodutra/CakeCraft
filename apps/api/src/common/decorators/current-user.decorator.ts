import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AuthenticatedRequest, AuthenticatedUser } from '../types/authenticated-request';

/**
 * Logica pura do decorator, separada para ser testavel sem montar o
 * maquinario de decorators do Nest. Lanca 401 se nao ha usuario: usar
 * @CurrentUser() numa rota sem JwtAuthGuard e um erro de configuracao, e
 * falhar com 401 e mais seguro do que devolver undefined em silencio.
 */
export function getAuthenticatedUser(ctx: ExecutionContext): AuthenticatedUser {
  const { user } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

  if (!user) {
    throw new UnauthorizedException();
  }

  return user;
}

/**
 * Extrai o usuario autenticado (populado pelo JwtStrategy) do request.
 * Uso: @CurrentUser() user: AuthenticatedUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => getAuthenticatedUser(ctx),
);
