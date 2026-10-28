import { apiRequest } from './client';
import { ApiError } from './errors';

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

export interface LoginInput {
  email: string;
  password: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
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

/** UC03, passo 3 (RF01). Emite cookies httpOnly de sessao e devolve o usuario. */
export async function loginUser(input: LoginInput): Promise<AuthUser> {
  const { user } = await apiRequest<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: input,
  });
  return user;
}

/**
 * Consulta quem esta autenticado via cookie httpOnly. Um 401 (mesmo apos a
 * tentativa automatica de refresh no cliente) significa visitante sem sessao,
 * e devolve `null` sem erro.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const { user } = await apiRequest<{ user: AuthUser }>('/auth/me');
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

/** Encerra a sessao no servidor (revoga refresh tokens) e limpa os cookies. */
export async function logoutUser(): Promise<void> {
  await apiRequest('/auth/logout', { method: 'POST' });
}

/** UC03, passo 4: dispara o link de recuperacao de senha (resposta sempre neutra). */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

/** UC03, passo 4: redefine a senha usando o token enviado por e-mail. */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  await apiRequest('/auth/reset-password', {
    method: 'POST',
    body: input,
  });
}

/** Secao 6.1 do RFC (LGPD): anonimizacao irreversivel dos dados pessoais. */
export async function anonymizeMyAccount(): Promise<void> {
  await apiRequest('/usuarios/me/anonymize', {
    method: 'DELETE',
  });
}
