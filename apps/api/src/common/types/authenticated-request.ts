import { Request } from 'express';

/**
 * Usuario que o JwtStrategy.validate() coloca em request.user depois de
 * verificar a assinatura do token. `role` e string porque vem do payload
 * do JWT; o RolesGuard compara com o enum Role.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Request do Express com `user` tipado. E opcional (`?`) de proposito: antes
 * de o JwtAuthGuard rodar, ou numa rota publica, o campo nao existe, e quem
 * le precisa tratar essa ausencia em vez de assumir que ele esta la.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
