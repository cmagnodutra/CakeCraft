import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Garante que rotas administrativas sejam inacessiveis ao papel CLIENTE
 * (Secao 6 do RFC - Broken Access Control). Deve ser usado depois do
 * JwtAuthGuard na cadeia de guards, ja que depende de `request.user`
 * estar populado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Falha fechada: rota restrita sem usuario autenticado nunca passa.
    if (!user) {
      return false;
    }

    // Todo Role e uma string, entao Role[] cabe em readonly string[] sem cast.
    // Isso permite comparar com user.role (string vinda do JWT) sem mentir
    // sobre o tipo dele nem acionar no-unsafe-enum-comparison.
    const allowedRoles: readonly string[] = requiredRoles;
    return allowedRoles.includes(user.role);
  }
}
