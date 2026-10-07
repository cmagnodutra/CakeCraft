import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard padrao de autenticacao - delega para a JwtStrategy ('jwt').
 * Aplicar com @UseGuards(JwtAuthGuard) nas rotas que exigem login.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
