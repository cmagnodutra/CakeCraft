import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Roles } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './roles.guard';

/**
 * Controllers de mentira decorados com o @Roles REAL. Assim o teste exercita
 * a cadeia completa (decorator grava metadado -> Reflector le -> guard decide)
 * em vez de simular o metadado na mao.
 */
class RotasSemRestricao {
  aberta(): void {}
}

class RotasDeMetodo {
  @Roles(Role.ADMIN)
  somenteAdmin(): void {}

  @Roles(Role.ADMIN, Role.CLIENTE)
  adminOuCliente(): void {}

  @Roles()
  semPapeis(): void {}
}

@Roles(Role.ADMIN)
class RotasDeClasse {
  herdaDaClasse(): void {}

  @Roles(Role.CLIENTE, Role.ADMIN)
  metodoSobrescreve(): void {}
}

function makeContext(
  cls: new () => object,
  handlerName: string,
  user?: { role?: string },
): ExecutionContext {
  const prototype = cls.prototype as Record<string, () => void>;
  return {
    getHandler: () => prototype[handlerName],
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(new Reflector());
  });

  describe('rota sem @Roles', () => {
    it('permite o acesso, mesmo sem usuario autenticado', () => {
      expect(guard.canActivate(makeContext(RotasSemRestricao, 'aberta'))).toBe(true);
    });
  });

  describe('rota com @Roles(ADMIN)', () => {
    it('permite um usuario ADMIN', () => {
      const ctx = makeContext(RotasDeMetodo, 'somenteAdmin', { role: 'ADMIN' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('bloqueia um usuario CLIENTE (Broken Access Control, secao 6 do RFC)', () => {
      const ctx = makeContext(RotasDeMetodo, 'somenteAdmin', { role: 'CLIENTE' });
      expect(guard.canActivate(ctx)).toBe(false);
    });

    it('bloqueia quando nao ha usuario no request (guard de login ausente)', () => {
      const ctx = makeContext(RotasDeMetodo, 'somenteAdmin', undefined);
      expect(guard.canActivate(ctx)).toBe(false);
    });

    it('bloqueia um papel desconhecido vindo do token', () => {
      const ctx = makeContext(RotasDeMetodo, 'somenteAdmin', { role: 'SUPERUSER' });
      expect(guard.canActivate(ctx)).toBe(false);
    });

    it('bloqueia quando o usuario nao tem papel definido', () => {
      const ctx = makeContext(RotasDeMetodo, 'somenteAdmin', {});
      expect(guard.canActivate(ctx)).toBe(false);
    });
  });

  describe('rota com mais de um papel permitido', () => {
    it.each(['ADMIN', 'CLIENTE'])('permite o papel %s', (role) => {
      const ctx = makeContext(RotasDeMetodo, 'adminOuCliente', { role });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('@Roles() sem argumentos', () => {
    it('equivale a nenhuma restricao (comportamento atual, documentado aqui)', () => {
      const ctx = makeContext(RotasDeMetodo, 'semPapeis', { role: 'CLIENTE' });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('@Roles aplicado na classe', () => {
    it('metodo sem @Roles herda a restricao da classe', () => {
      const bloqueado = makeContext(RotasDeClasse, 'herdaDaClasse', { role: 'CLIENTE' });
      const liberado = makeContext(RotasDeClasse, 'herdaDaClasse', { role: 'ADMIN' });

      expect(guard.canActivate(bloqueado)).toBe(false);
      expect(guard.canActivate(liberado)).toBe(true);
    });

    it('@Roles do metodo sobrescreve o da classe (getAllAndOverride)', () => {
      const ctx = makeContext(RotasDeClasse, 'metodoSobrescreve', { role: 'CLIENTE' });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
