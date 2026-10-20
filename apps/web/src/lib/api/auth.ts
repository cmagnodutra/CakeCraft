import { apiRequest } from './client';

/** Papeis do sistema (enum Role do backend). */
export type UserRole = 'CLIENTE' | 'ADMIN';

/** Usuario publico devolvido pela API (nunca inclui senha nem tokens). */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  xp: number;
  level: number;
}

/**
 * Corpo do cadastro. So estes quatro campos: a API usa forbidNonWhitelisted
 * e recusa a requisicao inteira (400) se vier qualquer outro, inclusive
 * `role`, que e justamente o que a protege de mass assignment.
 */
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

/**
 * UC03, passo 2 (RF01). Em caso de sucesso a API ja deixa o usuario logado:
 * os tokens chegam em cookies httpOnly (Set-Cookie), nao no corpo, e o
 * JavaScript nunca os ve.
 */
export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  const { user } = await apiRequest<{ user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: input,
  });
  return user;
}
