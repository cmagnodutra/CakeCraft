import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
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

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

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
   * Sai: manda o navegador apagar os dois cookies. E publico de proposito (sem
   * JwtAuthGuard): se o access token ja expirou, a pessoa ainda precisa
   * conseguir sair. Tambem e idempotente: sem sessao, responde 204 do mesmo
   * jeito.
   *
   * Limite conhecido: isto so limpa os cookies do navegador. Os tokens nao
   * sao revogados no servidor (nao ha refresh token persistido ainda), entao
   * um token roubado vale ate expirar (15 min o de acesso). Revogacao de
   * verdade entra junto da rotacao de refresh token.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions('access'));
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions('refresh'));
  }

  /**
   * Seta access e refresh token como cookies httpOnly - nunca aparecem no
   * corpo da resposta (diferente do codigo de referencia, que devolvia
   * Bearer token no JSON).
   *
   * Sem maxAge explicito de proposito: sem ele, o cookie e de sessao
   * (some quando o browser fecha) mas isso e so cosmetico - a
   * JwtStrategy ja rejeita um token expirado com ignoreExpiration:
   * false, entao um cookie "sobrevivendo" ao token nao concede acesso
   * nenhum.
   */
  private setAuthCookies(res: Response, tokens: TokenPair): void {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, this.cookieOptions('access'));
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, this.cookieOptions('refresh'));
  }

  /**
   * Atributos de cada cookie, num unico lugar. Quem cria (login, cadastro) e
   * quem apaga (logout) usam ESTE metodo: o navegador so remove um cookie se
   * path e flags forem identicos aos de quando ele foi criado, e atributos
   * escritos em dois lugares acabam divergindo.
   *
   * secure e condicional a NODE_ENV, nao sempre 'true': em desenvolvimento
   * local (http://localhost, sem HTTPS) um cookie marcado Secure seria
   * silenciosamente descartado pelo proprio browser, quebrando login em
   * dev. sameSite: 'lax' ja mitiga a maioria dos casos praticos de CSRF
   * mantendo o cookie utilizavel em navegacao normal (GET de outra
   * origem); token de dupla submissao fica como possivel reforco futuro,
   * nao bloqueante (ver PLANO-EXECUCAO, Secao 4.3).
   *
   * O de refresh so e enviado de volta pelo navegador para a rota de
   * refresh (via 'path'), reduzindo a janela de exposicao do token de vida
   * mais longa.
   */
  private cookieOptions(kind: 'access' | 'refresh') {
    const isProduction = this.config.get('NODE_ENV', { infer: true }) === 'production';
    const base = { httpOnly: true, sameSite: 'lax' as const, secure: isProduction };

    return kind === 'refresh' ? { ...base, path: REFRESH_TOKEN_COOKIE_PATH } : base;
  }
}
