import { SetMetadata } from '@nestjs/common';

import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Marca uma rota como restrita a determinados papeis.
 * Uso: @Roles(Role.ADMIN)
 * Deve ser combinado com RolesGuard (ver common/guards/roles.guard.ts).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
