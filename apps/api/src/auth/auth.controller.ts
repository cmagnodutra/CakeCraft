import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthService, PublicUser } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/**
 * Limite estrito contra ataques de forca bruta e abuso de criacao/recuperacao
 * de contas (RNF05 e Secao 6 do RFC).
 */
export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_LIMIT = 10;
export const PASSWORD_RESET_THROTTLE_LIMIT = 5;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookies: AuthCookiesService,
  ) {}

  /** UC03, passo 2 - RF01. */
  @Post('register')
  @Throttle({ default: { ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT } })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const { user, accessToken, refreshToken } = await this.authService.register(dto);
    this.authCookies.setAuthCookies(res, { accessToken, refreshToken });
    return { user };
  }

  /** UC03, passo 3 - RF01. */
  @Post('login')
  @Throttle({ default: { ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const { user, accessToken, refreshToken } = await this.authService.login(dto);
    this.authCookies.setAuthCookies(res, { accessToken, refreshToken });
    return { user };
  }

  /**
   * Rotaciona a sessao via cookie httpOnly `refresh_token` (restrito ao path
   * `/api/auth/refresh`), emitindo novos cookies `access_token` e
   * `refresh_token` sem exigir novo login (Secao 3.2 e Secao 6 do RFC).
   */
  @Post('refresh')
  @Throttle({ default: { ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT } })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const rawRefresh = this.authCookies.extractRefreshToken(req);
    const { user, accessToken, refreshToken } = await this.authService.refresh(rawRefresh);
    this.authCookies.setAuthCookies(res, { accessToken, refreshToken });
    return { user };
  }

  /**
   * Sessao atual, para o frontend saber quem esta logado ao recarregar a
   * pagina (os cookies httpOnly sao invisiveis ao JavaScript). 401 sem sessao
   * valida.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: AuthenticatedUser): Promise<{ user: PublicUser }> {
    return { user: await this.authService.me(current.id) };
  }

  /**
   * Encerra a sessao: revoga os refresh tokens ativos do usuario no servidor
   * (caso haja cookie `access_token` autentico, mesmo expirado) e instrui o
   * navegador a apagar os dois cookies httpOnly. Sempre idempotente (204).
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawAccess = this.authCookies.extractAccessToken(req);
    await this.authService.revokeSessionsFromAccessToken(rawAccess);
    this.authCookies.clearAuthCookies(res);
  }

  /** UC03, passo 4 - dispara e-mail de recuperacao sem revelar se a conta existe. */
  @Post('forgot-password')
  @Throttle({ default: { ttl: AUTH_THROTTLE_TTL_MS, limit: PASSWORD_RESET_THROTTLE_LIMIT } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return {
      message: 'Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.',
    };
  }

  /** UC03, passo 4 - redefine a senha com token de uso unico e revoga sessoes antigas. */
  @Post('reset-password')
  @Throttle({ default: { ttl: AUTH_THROTTLE_TTL_MS, limit: PASSWORD_RESET_THROTTLE_LIMIT } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
