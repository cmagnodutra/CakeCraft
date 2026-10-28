import { Controller, Delete, HttpCode, HttpStatus, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthService } from './auth.service';

/**
 * Endpoints de autogestao de dados pessoais do titular (Secao 6.1 do RFC - LGPD).
 * Rota exata definida no RFC: DELETE /api/usuarios/me/anonymize.
 */
@Controller('usuarios')
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookies: AuthCookiesService,
  ) {}

  @Delete('me/anonymize')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async anonymizeMe(
    @CurrentUser() current: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.anonymizeAccount(current.id);
    this.authCookies.clearAuthCookies(res);
  }
}
