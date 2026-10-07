import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { AppEnvironment } from '../config/env.validation';
import { AuthService, PublicUser, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * O cookie de refresh so e enviado pelo browser de volta pra esta rota
 * (via 'path'), em vez de em toda requisicao a API - reduz a janela de
 * exposicao do token de vida mais longa.
 */
const REFRESH_TOKEN_COOKIE_PATH = '/api/auth/refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppEnvironment, true>,
  ) {}

  /** UC03, passo 2 - RF01. */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const { user, accessToken, refreshToken } = await this.authService.register(dto);
    this.setAuthCookies(res, { accessToken, refreshToken });
    return { user };
  }

  /** UC03, passo 3 - RF01. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const { user, accessToken, refreshToken } = await this.authService.login(dto);
    this.setAuthCookies(res, { accessToken, refreshToken });
    return { user };
  }

  /**
   * Seta access e refresh token como cookies httpOnly - nunca aparecem no
   * corpo da resposta (diferente do codigo de referencia, que devolvia
   * Bearer token no JSON).
   *
   * secure e condicional a NODE_ENV, nao sempre 'true': em desenvolvimento
   * local (http://localhost, sem HTTPS) um cookie marcado Secure seria
   * silenciosamente descartado pelo proprio browser, quebrando login em
   * dev. sameSite: 'lax' ja mitiga a maioria dos casos praticos de CSRF
   * mantendo o cookie utilizavel em navegacao normal (GET de outra
   * origem); token de dupla submissao fica como possivel reforco futuro,
   * nao bloqueante (ver PLANO-EXECUCAO, Secao 4.3).
   *
   * Sem maxAge explicito de proposito: sem ele, o cookie e de sessao
   * (some quando o browser fecha) mas isso e so cosmetico - a
   * JwtStrategy ja rejeita um token expirado com ignoreExpiration:
   * false, entao um cookie "sobrevivendo" ao token nao concede acesso
   * nenhum.
   */
  private setAuthCookies(res: Response, tokens: TokenPair): void {
    const isProduction = this.config.get('NODE_ENV', { infer: true }) === 'production';

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  }
}
